/** Extracted module: src/board/BoardEngine.js lines 599-1437 — DO NOT rewrite business logic */
/* ─── BOARD ENGINE ──────────────────────────────────────── */
const BoardEngine = {
  /* ── Pointer / Drag state ── */
  drawing: false,
  startPos: null,
  dragObj: null,
  dragOffset: { x: 0, y: 0 },
  activePointerId: null,
  pointers: new Map(), // multi-touch for pinch
  lastPinchDist: 0,
  panStart: null,
  spaceHeld: false,
  isBoardOnly: false,
  polygonPoints: [],
  polygonMode: false,

  /* Camera: world is always 0..1 field; camera applies zoom/pan on viewport */
  camera: { x: 0, y: 0, zoom: 1 },
  /** Межі газону в нормалізованих координатах (з урахуванням радіуса фішки ~2%) */
  FIELD_MIN: 0.03,
  FIELD_MAX: 0.97,
  clampWorld(x, y) {
    return {
      x: clamp(x, this.FIELD_MIN, this.FIELD_MAX),
      y: clamp(y, this.FIELD_MIN, this.FIELD_MAX)
    };
  },
  clampPan() {
    const z = this.camera.zoom || 1;
    // не даємо полю зникнути: pan обмежений
    const lim = Math.max(0, 0.5 - 0.5 / z) + 0.15;
    this.camera.x = clamp(this.camera.x || 0, -lim, lim);
    this.camera.y = clamp(this.camera.y || 0, -lim, lim);
  },


  init() {
    const c = document.getElementById('fieldContainer');
    if (!c) return;
    c.style.touchAction = 'none';
    c.style.userSelect = 'none';
    // Unified Pointer Events — primary interaction path
    c.addEventListener('pointerdown', e => this.onPointerDown(e), { passive: false });
    c.addEventListener('pointermove', e => this.onPointerMove(e), { passive: false });
    c.addEventListener('pointerup', e => this.onPointerUp(e));
    c.addEventListener('pointercancel', e => this.onPointerUp(e));
    c.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());
    // Resize
    if (window.ResizeObserver) {
      new ResizeObserver(() => { this.applyCamera(); this.renderTokens(); this.renderDrawings(); }).observe(c);
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { this.fitField(); this.render(); }, 200);
    });
    window.addEventListener('resize', () => {
      this.applyCamera();
    });
    }
    // Space for pan
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !isInput(e.target)) { this.spaceHeld = true; e.preventDefault(); }
    });
    document.addEventListener('keyup', e => {
      if (e.code === 'Space') this.spaceHeld = false;
    });
    // Fullscreen change
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && this.isBoardOnly) {
        // keep CSS board-only even if browser FS exits; user must press EXIT
      }
    });
  },

  /* ── Coordinate system ──
     World: x,y in 0..1 relative to full pitch
     Screen: convert via container rect + camera
  */
  /**
   * Екран → світ 0..1.
   * Використовуємо getBoundingClientRect() саме #fieldStage (після CSS transform),
   * щоб стрілки/дотик збігалися з візуальним газоном при будь-якому zoom/pan.
   */
  screenToWorld(clientX, clientY) {
    const stage = document.getElementById('fieldStage') || document.getElementById('fieldContainer');
    if (!stage) return { x: 0.5, y: 0.5 };
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    const wx = (clientX - r.left) / w;
    const wy = (clientY - r.top) / h;
    return { x: clamp(wx, -0.02, 1.02), y: clamp(wy, -0.02, 1.02) };
  },

  /** Прив'язати старт стрілки до центру найближчої фішки / м'яча */
  snapToToken(wx, wy, maxDist) {
    maxDist = maxDist == null ? 0.045 : maxDist;
    const s = Store.get();
    let best = null, bestD = maxDist;
    (s.activeBoard.objects || []).forEach(o => {
      if (!['player', 'opponent', 'ball'].includes(o.type)) return;
      const d = Math.hypot((o.x || 0) - wx, (o.y || 0) - wy);
      if (d < bestD) { bestD = d; best = o; }
    });
    return best ? { x: best.x, y: best.y, token: best } : { x: wx, y: wy, token: null };
  },

  nextActionStep() {
    const stepTypes = ['arrow', 'arrowDash', 'pass', 'run', 'dribble', 'press', 'shot'];
    const steps = (Store.get().activeBoard.objects || [])
      .filter(o => stepTypes.includes(o.type))
      .map(o => o.step || 0);
    return (steps.length ? Math.max(...steps) : 0) + 1;
  },

  getActionPathsSorted() {
    const stepTypes = ['arrow', 'arrowDash', 'pass', 'run', 'dribble', 'press', 'shot'];
    return (Store.get().activeBoard.objects || [])
      .filter(o => o.x2 != null && stepTypes.includes(o.type))
      .slice()
      .sort((a, b) => (a.step || 999) - (b.step || 999) || 0);
  },

  strokeColorFor(type, explicit) {
    if (explicit) return explicit;
    const palette = (Store.get().activeBoard && Store.get().activeBoard.drawColor) || null;
    if (palette) return palette;
    const map = {
      pass: '#3498db', run: '#f1c40f', dribble: '#9b59b6',
      shot: '#e67e22', press: '#e74c3c', arrow: '#ecf0f1', arrowDash: '#95a5a6'
    };
    return map[type] || '#f1c40f';
  },

  worldToScreenPct(wx, wy) {
    // Позиції у % поля; масштаб/pan застосовується до всього field-stage
    return { left: (wx ?? 0) * 100, top: (wy ?? 0) * 100 };
  },

  /** Масштаб і зсув усього поля (розмітка + фішки + стрілки разом) */
  applyCamera() {
    const stage = document.getElementById('fieldStage');
    const c = document.getElementById('fieldContainer');
    if (!stage || !c) return;
    const z = Math.max(0.4, Math.min(5, this.camera.zoom || 1));
    this.camera.zoom = z;
    const w = c.clientWidth || 1;
    const h = c.clientHeight || 1;
    // pan у світових одиницях → пікселі відносно центру контейнера
    const tx = -this.camera.x * w * z;
    const ty = -this.camera.y * h * z;
    stage.style.transformOrigin = '50% 50%';
    stage.style.willChange = 'transform';
    stage.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${z})`;
    this.updateZoomIndicator();
  },

  /** Вписати поле в доступну область main */
  fitField() {
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.applyCamera();
    this.renderTokens();
    this.renderDrawings();
  },
  zoomFit() { this.fitField(); },
  resetCamera() { this.fitField(); },
  setZoom(z) {
    this.camera.zoom = Math.max(0.4, Math.min(5, Number(z) || 1));
    this.applyCamera();
    this.renderTokens();
  },
  zoomIn() { this.setZoom((this.camera.zoom || 1) * 1.15); },
  zoomOut() { this.setZoom((this.camera.zoom || 1) / 1.15); },

  /* ── History ── */
  getState() {
    return { objects: JSON.parse(JSON.stringify(Store.get().activeBoard.objects)), camera: { ...this.camera } };
  },

  pushHistory() {
    const s = Store.get();
    const b = s.activeBoard;
    const snap = JSON.stringify({ objects: b.objects, camera: this.camera });
    b.history = b.history.slice(0, b.historyIdx + 1);
    b.history.push(snap);
    b.historyIdx = b.history.length - 1;
    if (b.history.length > 100) { b.history.shift(); b.historyIdx--; }
    StorageManager.saveDebounced();
  },

  undo() {
    const b = Store.get().activeBoard;
    if (b.historyIdx <= 0) return;
    b.historyIdx--;
    try {
      const snap = JSON.parse(b.history[b.historyIdx]);
      b.objects = snap.objects || snap;
      if (snap.camera) this.camera = snap.camera;
    } catch (_) {}
    this.render();
    Toast.show('↩ Скасовано');
  },

  redo() {
    const b = Store.get().activeBoard;
    if (b.historyIdx >= b.history.length - 1) return;
    b.historyIdx++;
    try {
      const snap = JSON.parse(b.history[b.historyIdx]);
      b.objects = snap.objects || snap;
      if (snap.camera) this.camera = snap.camera;
    } catch (_) {}
    this.render();
    Toast.show('↪ Повторено');
  },

  /* ── FULLSCREEN / BOARD-ONLY MODE ── */
  enterFullscreen() {
    this.isBoardOnly = true;
    document.body.classList.add('board-fs-nav');
    document.body.classList.add('board-only-mode');
    App.navigate('board');
    // Telegram Mini App fullscreen (if available)
    if (typeof TelegramManager !== 'undefined' && TelegramManager.isTelegram) {
      TelegramManager.requestFullscreen();
      TelegramManager.lockLandscape();
    }
    // Browser Fullscreen API (best effort)
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req) {
      try { req.call(el); } catch (_) {}
    }
    // Ensure board is visible and sized
    setTimeout(() => this.render(), 100);
    Toast.show('Лише дошка — ESC або ВИХІД', 'ok');
  },

  exitFullscreen() {
    this.isBoardOnly = false;
    document.body.classList.remove('board-fs-nav');
    document.body.classList.remove('board-only-mode');
    if (typeof TelegramManager !== 'undefined') { TelegramManager.exitFullscreen(); TelegramManager.unlockOrientation(); }
    if (document.fullscreenElement) {
      const ex = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (ex) try { ex.call(document); } catch (_) {}
    }
    setTimeout(() => this.render(), 100);
  },

  toggleFullscreen() {
    if (this.isBoardOnly) this.exitFullscreen();
    else this.enterFullscreen();
  },

  /* ── POINTER DOWN ── */
  onPointerDown(e) {
    // Ignore secondary buttons except middle for pan
    if (e.button === 2) return;
    e.preventDefault();

    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger: start pinch, cancel any drag
    if (this.pointers.size >= 2) {
      this.dragObj = null;
      this.drawing = false;
      const pts = [...this.pointers.values()];
      this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.panStart = {
        mx: (pts[0].x + pts[1].x) / 2,
        my: (pts[0].y + pts[1].y) / 2,
        camX: this.camera.x,
        camY: this.camera.y
      };
      return;
    }

    // Middle mouse or Space+drag → pan
    if (e.button === 1 || this.spaceHeld) {
      this.panStart = { x: e.clientX, y: e.clientY, camX: this.camera.x, camY: this.camera.y };
      return;
    }

    const world = this.screenToWorld(e.clientX, e.clientY);
    const s = Store.get();
    const tool = s.activeBoard.tool;
    const target = e.target.closest('.pt, .ball, .eq');

    /* ── IMMEDIATE DRAG: touch player → attach now ── */
    if (target && (tool === 'select' || tool === 'player' || tool === 'opponent' || !tool)) {
      const id = target.dataset.id;
      const obj = s.activeBoard.objects.find(o => o.id === id);
      if (obj) {
        s.activeBoard.selectedId = id;
        this.dragObj = obj;
        this.activePointerId = e.pointerId;
        // Offset so chip stays under finger, no jump to center
        this.dragOffset = {
          x: world.x - obj.x,
          y: world.y - obj.y
        };
        try { target.setPointerCapture(e.pointerId); } catch (_) {}
        try { TelegramManager.haptic('medium'); } catch (_) {}
        target.classList.add('dragging');
        // Visual select only — NO full app rerender, NO save
        this.renderTokens();
        return;
      }
    }

    // Tool actions
    if (tool === 'player' || tool === 'opponent') {
      const pp = this.clampWorld(world.x, world.y);
      if (tool === 'opponent') {
        const num = s.activeBoard.objects.filter(o => o.type === 'opponent').length + 1;
        s.activeBoard.objects.push({
          id: uid(), type: 'opponent',
          x: pp.x, y: pp.y, number: num, label: '',
          team: 'opp', playerId: null,
          rotation: 0, locked: false, visible: true
        });
        this.pushHistory();
        this.render();
        try { TelegramManager.haptic('medium'); } catch (_) {}
        return;
      }
      // Власна команда — вибір зі складу
      this.openRosterPicker(pp.x, pp.y);
      return;
    }

    if (tool === 'ball') {
      s.activeBoard.objects = s.activeBoard.objects.filter(o => o.type !== 'ball');
      const bp = this.clampWorld(world.x, world.y);
      s.activeBoard.objects.push({ id: uid(), type: 'ball', x: bp.x, y: bp.y, locked: false, visible: true });
      this.pushHistory();
      this.render();
      return;
    }

    if (['cone','mannequin','pole','ladder','minigoal','hoop','flag','bib'].includes(tool)) {
      const ep = this.clampWorld(world.x, world.y);
      s.activeBoard.objects.push({ id: uid(), type: tool, x: ep.x, y: ep.y, rotation: 0, locked: false, visible: true });
      this.pushHistory();
      this.render();
      return;
    }

    if (tool === 'polygon') {
      this.polygonPoints.push({ x: world.x, y: world.y });
      this.polygonMode = true;
      this.renderDrawings();
      // Double-tap close: if last two points very close
      if (this.polygonPoints.length >= 3) {
        const a = this.polygonPoints[this.polygonPoints.length - 1];
        const b = this.polygonPoints[this.polygonPoints.length - 2];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 0.02) {
          this.polygonPoints.pop();
          this.closePolygon();
        }
      }
      return;
    }

    if (['arrow', 'arrowDash', 'pass', 'run', 'dribble', 'press', 'shot', 'zone', 'circle', 'ellipse', 'freehand'].includes(tool)) {
      this.drawing = true;
      const isShape = ['zone', 'circle', 'ellipse', 'freehand'].includes(tool);
      const snap = isShape ? { x: world.x, y: world.y, token: null } : this.snapToToken(world.x, world.y);
      this.startPos = { x: snap.x, y: snap.y };
      this._snapToken = snap.token || null;
      this.activePointerId = e.pointerId;
      try {
        const c = document.getElementById('fieldContainer');
        c.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (tool === 'freehand') {
        this._freehand = [{ x: world.x, y: world.y }];
      }
      return;
    }

    if (tool === 'text') {
      Modal.prompt('Текст', '', text => {
        if (text) {
          const tp = this.clampWorld(world.x, world.y);
          s.activeBoard.objects.push({ id: uid(), type: 'text', x: tp.x, y: tp.y, label: text, locked: false, visible: true });
          this.pushHistory();
          this.render();
        }
      });
      return;
    }

    // Select empty space → deselect
    if (tool === 'select') {
      s.activeBoard.selectedId = null;
      this.renderTokens();
    }
  },

  /* ── POINTER MOVE — ZERO LAG path ── */
  onPointerMove(e) {
    e.preventDefault();
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch zoom + two-finger pan
    if (this.pointers.size >= 2) {
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.lastPinchDist > 0) {
        const scale = dist / this.lastPinchDist;
        this.camera.zoom = clamp(this.camera.zoom * scale, 0.5, 4);
      }
      this.lastPinchDist = dist;
      if (this.panStart) {
        const c = document.getElementById('fieldContainer');
        const r = c.getBoundingClientRect();
        const mx = (pts[0].x + pts[1].x) / 2;
        const my = (pts[0].y + pts[1].y) / 2;
        const dx = (mx - this.panStart.mx) / r.width / this.camera.zoom;
        const dy = (my - this.panStart.my) / r.height / this.camera.zoom;
        this.camera.x = this.panStart.camX - dx;
        this.camera.y = this.panStart.camY - dy;
      }
      this.renderTokens();
      this.renderDrawings();
      this.updateZoomIndicator();
      return;
    }

    // Single-finger / mouse pan
    if (this.panStart && !this.dragObj && !this.drawing) {
      const c = document.getElementById('fieldContainer');
      const r = c.getBoundingClientRect();
      const dx = (e.clientX - this.panStart.x) / r.width / this.camera.zoom;
      const dy = (e.clientY - this.panStart.y) / r.height / this.camera.zoom;
      this.camera.x = this.panStart.camX - dx;
      this.camera.y = this.panStart.camY - dy;
      this.clampPan();
      this.applyCamera();
      this.renderTokens();
      this.renderDrawings();
      return;
    }

    /* ── DRAG: player follows finger continuously ── */
    if (this.dragObj && (this.activePointerId === null || this.activePointerId === e.pointerId)) {
      const world = this.screenToWorld(e.clientX, e.clientY);
      const pos = this.clampWorld(world.x - this.dragOffset.x, world.y - this.dragOffset.y);
      this.dragObj.x = pos.x;
      this.dragObj.y = pos.y;
      // ONLY update token positions — no history, no storage, no other views
      this._updateTokenDOM(this.dragObj);
      return;
    }

    // Freehand drawing trail
    if (this.drawing && this._freehand) {
      const world = this.screenToWorld(e.clientX, e.clientY);
      this._freehand.push({ x: world.x, y: world.y });
      this._previewFreehand();
    }
  },

  /* Fast DOM-only position update during drag */
  _updateTokenDOM(obj) {
    const el = document.querySelector(`[data-id="${obj.id}"]`);
    if (!el) return;
    const pct = this.worldToScreenPct(obj.x, obj.y);
    el.style.left = pct.left + '%';
    el.style.top = pct.top + '%';
  },

  /* ── POINTER UP ── */
  onPointerUp(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) {
      this.lastPinchDist = 0;
      this.panStart = null;
    }

    // Commit drag
    if (this.dragObj) {
      const el = document.querySelector(`[data-id="${this.dragObj.id}"]`);
      if (el) {
        el.classList.remove('dragging');
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      this.dragObj = null;
      this.activePointerId = null;
      this.pushHistory(); // commit once on release
      return;
    }

    if (this.panStart) {
      this.panStart = null;
      return;
    }

    if (!this.drawing || !this.startPos) {
      this.drawing = false;
      return;
    }

    const world = this.screenToWorld(e.clientX, e.clientY);
    const s = Store.get();
    const tool = s.activeBoard.tool;

    if (['arrow', 'arrowDash', 'pass', 'run', 'dribble', 'press', 'shot'].includes(tool)) {
      if (Math.hypot(world.x - this.startPos.x, world.y - this.startPos.y) > 0.015) {
        const stepTypes = ['arrow', 'arrowDash', 'pass', 'run', 'dribble', 'press', 'shot'];
        const nextStep = s.activeBoard.objects.filter(o => stepTypes.includes(o.type) && o.step != null).length
          ? Math.max(...s.activeBoard.objects.filter(o => stepTypes.includes(o.type) && o.step != null).map(o => o.step || 0)) + 1
          : 1;
        s.activeBoard.objects.push({
          id: uid(), type: tool,
          x: this.startPos.x, y: this.startPos.y,
          x2: this.clampWorld(world.x, world.y).x, y2: this.clampWorld(world.x, world.y).y,
          color: this.strokeColorFor(tool),
          step: nextStep,
          locked: false, visible: true
        });
        this.pushHistory();
      }
    } else if (tool === 'zone') {
      const x = Math.min(this.startPos.x, world.x);
      const y = Math.min(this.startPos.y, world.y);
      const w = Math.abs(world.x - this.startPos.x);
      const h = Math.abs(world.y - this.startPos.y);
      if (w > 0.02 && h > 0.02) {
        s.activeBoard.objects.push({
          id: uid(), type: 'zone', shape: 'rect',
          x, y, w, h, fill: 'rgba(200,168,75,0.25)', opacity: 0.4,
          label: '', locked: false, visible: true
        });
        this.pushHistory();
      }
    } else if (tool === 'circle' || tool === 'ellipse') {
      const r = Math.hypot(world.x - this.startPos.x, world.y - this.startPos.y);
      if (r > 0.015) {
        s.activeBoard.objects.push({
          id: uid(), type: 'zone', shape: tool === 'ellipse' ? 'ellipse' : 'circle',
          x: this.startPos.x, y: this.startPos.y, r,
          rx: r, ry: tool === 'ellipse' ? r * 0.6 : r,
          fill: 'rgba(52,152,219,0.2)', opacity: 0.35,
          label: '', locked: false, visible: true
        });
        this.pushHistory();
      }
    } else if (tool === 'freehand' && this._freehand && this._freehand.length > 3) {
      // Close freehand into polygon zone
      s.activeBoard.objects.push({
        id: uid(), type: 'zone', shape: 'polygon',
        points: this._freehand.slice(),
        fill: 'rgba(46,204,113,0.2)', opacity: 0.3,
        label: '', locked: false, visible: true
      });
      this._freehand = null;
      this.pushHistory();
    }

    this.drawing = false;
    this.startPos = null;
    this.activePointerId = null;
    this.render();
  },

  closePolygon() {
    if (this.polygonPoints.length < 3) return;
    const s = Store.get();
    s.activeBoard.objects.push({
      id: uid(), type: 'zone', shape: 'polygon',
      points: this.polygonPoints.slice(),
      fill: 'rgba(200,168,75,0.25)', opacity: 0.4,
      label: 'Zone', locked: false, visible: true
    });
    this.polygonPoints = [];
    this.polygonMode = false;
    this.pushHistory();
    this.render();
    Toast.show('Polygon zone створено', 'ok');
  },

  onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoom = clamp(this.camera.zoom * delta, 0.5, 4);
    this.render();
    this.updateZoomIndicator();
  },

  setZoom(z) {
    this.camera.zoom = clamp(z, 0.5, 4);
    this.render();
    this.updateZoomIndicator();
  },

  resetCamera() {
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.applyCamera();
    this.render();
    this.updateZoomIndicator();
  },

  updateZoomIndicator() {
    let el = document.getElementById('zoomInd');
    if (!el) {
      const ba = document.getElementById('boardArea');
      if (!ba) return;
      el = document.createElement('div');
      el.id = 'zoomInd';
      el.className = 'zoom-indicator';
      ba.appendChild(el);
    }
    el.textContent = Math.round(this.camera.zoom * 100) + '%';
  },

  deleteSelected() {
    const s = Store.get();
    if (!s.activeBoard.selectedId) return;
    s.activeBoard.objects = s.activeBoard.objects.filter(o => o.id !== s.activeBoard.selectedId);
    s.activeBoard.selectedId = null;
    this.pushHistory();
    this.render();
  },

  clear() {
    Modal.confirm('Очистити дошку?', () => {
      Store.get().activeBoard.objects = [];
      Store.get().activeBoard.selectedId = null;
      this.polygonPoints = [];
      this.pushHistory();
      this.render();
      Toast.show('Очищено');
    });
  },


  openRosterPicker(x, y) {
    const s = Store.get();
    const used = new Set(
      (s.activeBoard.objects || [])
        .filter(o => o.type === 'player' && o.playerId)
        .map(o => o.playerId)
    );
    const available = (s.players || []).filter(p => !used.has(p.id));
    if (!available.length) {
      const num = s.activeBoard.objects.filter(o => o.type === 'player').length + 1;
      const pos = this.clampWorld(x, y);
      s.activeBoard.objects.push({
        id: uid(), type: 'player', x: pos.x, y: pos.y, number: num, label: '',
        team: 'own', playerId: null, rotation: 0, locked: false, visible: true
      });
      this.pushHistory();
      this.render();
      Toast.show('Немає вільних гравців у складі — додано анонімну фішку', 'warn');
      return;
    }
    const list = available.map(p => {
      const r = p.readiness != null ? p.readiness : (p.condition != null ? p.condition : 80);
      const st = p.status === 'injured' ? ' 🩹' : (p.status === 'available' ? '' : ' · ' + p.status);
      return `<button type="button" class="btn btn-s roster-pick" style="width:100%;margin:4px 0;text-align:left;min-height:44px"
        data-pick-player="${p.id}">
        <strong>#${p.number}</strong> ${sanitize(p.firstName)} ${sanitize(p.lastName)}${st}
        <span style="float:right;color:var(--muted);font-size:12px">${sanitize(p.position)} · ${r}%</span>
      </button>`;
    }).join('');
    Modal.open(
      'Склад МЕТАЛІСТ ШТУТГАРТ',
      `<p class="note-sm" style="margin-bottom:8px">Оберіть гравця для фішки на дошці</p>
       <div style="max-height:50vh;overflow:auto">${list}</div>`,
      [{ label: 'Скасувати', cls: 'btn-s', action: 'cancel' }]
    );
    const self = this;
    setTimeout(() => {
      document.querySelectorAll('[data-pick-player]').forEach(btn => {
        btn.addEventListener('click', () => {
          self.placeRosterPlayer(btn.getAttribute('data-pick-player'), x, y);
          Modal.close();
        });
      });
    }, 30);
  },

  placeRosterPlayer(playerId, x, y) {
    const s = Store.get();
    const p = (s.players || []).find(pl => pl.id === playerId);
    if (!p) return;
    const pos = this.clampWorld(x, y);
    const readiness = p.readiness != null ? p.readiness : (p.condition != null ? p.condition : 80);
    s.activeBoard.objects.push({
      id: uid(), type: 'player',
      x: pos.x, y: pos.y,
      number: p.number,
      label: p.lastName || '',
      team: 'own',
      playerId: p.id,
      readiness,
      rotation: 0, locked: false, visible: true
    });
    this.pushHistory();
    this.render();
    try { TelegramManager.haptic('medium'); } catch (_) {}
    Toast.show('#' + p.number + ' ' + p.firstName + ' ' + p.lastName + ' · ' + readiness + '%', 'ok');
  },

  applyScheme(name, forceTeam) {
    const scheme = SCHEMES[name];
    if (!scheme) return;
    const s = Store.get();
    const tool = s.activeBoard.tool || 'select';
    // Режим суперника або явний forceTeam
    const asOpp = forceTeam === 'opp' || forceTeam === 'opponent' || tool === 'opponent';
    if (asOpp) {
      // прибрати лише суперників, свою команду залишити
      s.activeBoard.objects = s.activeBoard.objects.filter(o => o.type !== 'opponent');
      scheme.forEach(([num, x, y], i) => {
        // дзеркало по вертикалі (атака назустріч)
        const p = this.clampWorld(x, 1 - y);
        s.activeBoard.objects.push({
          id: uid(), type: 'opponent', x: p.x, y: p.y,
          number: i + 1, // автонумерація суперника з 1
          label: '', team: 'opp', playerId: null,
          rotation: 0, locked: false, visible: true
        });
      });
      this.pushHistory();
      this.render();
      Toast.show('Суперник: схема ' + name + ' (дзеркало)', 'ok');
      return;
    }
    // Своя команда — замінити своїх гравців
    s.activeBoard.objects = s.activeBoard.objects.filter(o => o.type !== 'player');
    scheme.forEach(([num, x, y]) => {
      const p = this.clampWorld(x, y);
      // спроба прив'язати гравця зі складу за номером
      const roster = (s.players || []).find(pl => pl.number === num);
      s.activeBoard.objects.push({
        id: uid(), type: 'player', x: p.x, y: p.y, number: num,
        label: roster ? (roster.lastName || '') : '',
        team: 'own',
        playerId: roster ? roster.id : null,
        readiness: roster ? (roster.readiness != null ? roster.readiness : roster.condition) : null,
        position: roster ? roster.position : null,
        status: roster ? roster.status : null,
        rotation: 0, locked: false, visible: true
      });
    });
    this.pushHistory();
    this.render();
    Toast.show('Схема ' + name, 'ok');
  },

  saveBoard() {
    Modal.prompt('Назва схеми', 'Схема ' + new Date().toLocaleString('uk-UA'), name => {
      if (!name) return;
      const s = Store.get();
      s.boards.push({
        id: uid(), name,
        objects: JSON.parse(JSON.stringify(s.activeBoard.objects)),
        camera: Object.assign({}, this.camera),
        createdAt: new Date().toISOString()
      });
      StorageManager.save();
      Toast.show('Збережено', 'ok');
    });
  },

  loadBoard(id) {
    const s = Store.get();
    const b = s.boards.find(x => x.id === id);
    if (!b) return;
    s.activeBoard.objects = JSON.parse(JSON.stringify(b.objects));
    if (b.camera) this.camera = Object.assign({}, b.camera);
    this.pushHistory();
    App.navigate('board');
    this.render();
    Toast.show('Завантажено: ' + b.name, 'ok');
  },

  /* ═══ Анімація фішок уздовж стрілок / рухів ═══ */
  _animTracks: [],
  _animStartTs: 0,
  _animPausedAt: 0,
  _animElapsed: 0,
  _animRaf: null,

  _easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },
  _objDist(ox, oy, x, y) {
    const dx = ox - x, dy = oy - y;
    return Math.sqrt(dx * dx + dy * dy);
  },
  /** Усі рухомі об'єкти на дошці */
  _movableTypes() {
    return ['player', 'opponent', 'ball', 'cone', 'mannequin', 'pole', 'ladder', 'minigoal', 'hoop', 'flag', 'bib'];
  },

  _pointInZone(px, py, z) {
    if (!z) return false;
    if (z.type === 'circle' && z.r != null) {
      const dx = px - z.x, dy = py - z.y;
      return Math.sqrt(dx * dx + dy * dy) <= z.r;
    }
    if (z.type === 'zone' || z.type === 'rect') {
      const x1 = Math.min(z.x, z.x2 != null ? z.x2 : z.x), x2 = Math.max(z.x, z.x2 != null ? z.x2 : z.x);
      const y1 = Math.min(z.y, z.y2 != null ? z.y2 : z.y), y2 = Math.max(z.y, z.y2 != null ? z.y2 : z.y);
      return px >= x1 && px <= x2 && py >= y1 && py <= y2;
    }
    if (z.type === 'polygon' && Array.isArray(z.points) && z.points.length >= 3) {
      // ray casting
      let inside = false;
      const pts = z.points;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
        const inter = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi);
        if (inter) inside = !inside;
      }
      return inside;
    }
    return false;
  },

  /**
   * Треки анімації:
   * - будь-яка стрілка (run/dribble/arrow/…) → найближча фішка (не лише м'яч)
   * - pass/shot → м'яч + опційно пасуючий
   * - press → усі фішки в зоні біля старту рухаються вектором пресингу
   */
  _buildAnimTracks() {
    const b = Store.get().activeBoard;
    const pathTypes = ['arrow', 'pass', 'run', 'dribble', 'arrowDash', 'shot', 'press'];
    const paths = b.objects
      .filter(o => o.x2 != null && pathTypes.includes(o.type))
      .slice()
      .sort((a, b) => (a.step || 999) - (b.step || 999));
    const movables = b.objects.filter(o => this._movableTypes().includes(o.type));
    const zones = b.objects.filter(o => ['zone', 'circle', 'polygon', 'rect'].includes(o.type));
    const tracks = [];
    const used = new Set();

    const nearest = (x, y, maxD, filterFn) => {
      let best = null, bestD = maxD;
      movables.forEach(m => {
        if (used.has(m.id)) return;
        if (filterFn && !filterFn(m)) return;
        const d = this._objDist(m.x, m.y, x, y);
        if (d < bestD) { bestD = d; best = m; }
      });
      return best;
    };

    // 1) Пресинг — груповий зсув
    paths.filter(p => p.type === 'press').forEach(p => {
      const vx = (p.x2 - p.x), vy = (p.y2 - p.y);
      const len = Math.sqrt(vx * vx + vy * vy) || 0.01;
      // зона: коло навколо старту або наявна zone, що містить старт
      let targets = movables.filter(m => {
        if (m.type === 'ball') return false;
        return this._objDist(m.x, m.y, p.x, p.y) < 0.14;
      });
      zones.forEach(z => {
        if (this._pointInZone(p.x, p.y, z) || this._objDist(z.x, z.y, p.x, p.y) < 0.2) {
          movables.forEach(m => {
            if (m.type === 'ball') return;
            if (this._pointInZone(m.x, m.y, z) && !targets.includes(m)) targets.push(m);
          });
        }
      });
      if (!targets.length) {
        const one = nearest(p.x, p.y, 0.15, m => m.type !== 'ball');
        if (one) targets = [one];
      }
      targets.forEach((m, i) => {
        used.add(m.id);
        // синхронний вектор з невеликим розкидом
        const spread = (i - (targets.length - 1) / 2) * 0.012;
        const nx = -vy / len * spread, ny = vx / len * spread;
        const end = this.clampWorld(m.x + vx + nx, m.y + vy + ny);
        tracks.push({
          kind: 'press', objId: m.id, path: p,
          x0: m.x, y0: m.y,
          x1: end.x, y1: end.y,
          duration: Math.max(500, len * 2600)
        });
      });
    });

    // 2) Рух / ведення / стрілка — будь-яка фішка
    paths.filter(p => ['run', 'dribble', 'arrow', 'arrowDash'].includes(p.type)).forEach(p => {
      const m = nearest(p.x, p.y, 0.14, null);
      if (!m) return;
      used.add(m.id);
      const len = this._objDist(p.x, p.y, p.x2, p.y2);
      tracks.push({
        kind: 'move', objId: m.id, path: p,
        x0: m.x, y0: m.y, x1: p.x2, y1: p.y2,
        duration: Math.max(450, len * 2700)
      });
    });

    // 3) Пас / удар — м'яч + короткий рух пасуючого
    paths.filter(p => p.type === 'pass' || p.type === 'shot').forEach(p => {
      const ball = movables.find(m => m.type === 'ball' && !used.has(m.id)) || movables.find(m => m.type === 'ball');
      const len = this._objDist(p.x, p.y, p.x2, p.y2);
      if (ball) {
        tracks.push({
          kind: 'ball', objId: ball.id, path: p,
          x0: p.x, y0: p.y, x1: p.x2, y1: p.y2,
          duration: Math.max(350, len * 2000)
        });
      }
      const passer = nearest(p.x, p.y, 0.1, m => m.type === 'player' || m.type === 'opponent');
      if (passer && p.type === 'pass') {
        used.add(passer.id);
        tracks.push({
          kind: 'move', objId: passer.id, path: p,
          x0: passer.x, y0: passer.y,
          x1: passer.x + (p.x2 - p.x) * 0.06,
          y1: passer.y + (p.y2 - p.y) * 0.06,
          duration: Math.max(300, len * 800)
        });
      }
    });

    return tracks;
  },

  _applyStepOnly(stepNum) {
    const b = Store.get().activeBoard;
    // restore base
    b.objects.forEach(o => {
      if (o._ox != null) { o.x = o._ox; o.y = o._oy; }
    });
    if (!this._animTracks.length) {
      b.objects.forEach(o => { o._ox = o.x; o._oy = o.y; });
      this._animTracks = this._buildAnimTracks();
    }
    this._animTracks.forEach(tr => {
      const obj = b.objects.find(o => o.id === tr.objId);
      if (!obj) return;
      const st = tr.step != null ? tr.step : ((tr.path && tr.path.step) || 0);
      if (st < stepNum) {
        obj.x = tr.x1; obj.y = tr.y1;
      } else if (st === stepNum) {
        // mid of step
        obj.x = (tr.x0 + tr.x1) / 2; obj.y = (tr.y0 + tr.y1) / 2;
      } else {
        obj.x = tr.x0; obj.y = tr.y0;
      }
    });
    this._updateTokenPositionsLive && this._updateTokenPositionsLive();
    this.renderTokens();
    const el = document.getElementById('stepInd');
    if (el) el.textContent = 'Крок ' + stepNum;
  },

  animStepNext() {
    const b = Store.get().activeBoard;
    b.anim.playing = false;
    if (!this._animTracks.length) {
      b.objects.forEach(o => { o._ox = o.x; o._oy = o.y; });
      this._animTracks = this._buildAnimTracks();
    }
    if (!this._animTracks.length) {
      Toast.show('Немає кроків для показу', 'warn');
      return;
    }
    const steps = [...new Set(this._animTracks.map(tr => tr.step != null ? tr.step : (tr.path && tr.path.step) || 0))].sort((a,b)=>a-b);
    this._stepIdx = Math.min((this._stepIdx || 0) + 1, steps.length - 1);
    this._applyStepOnly(steps[this._stepIdx]);
    Toast.show('Крок ' + steps[this._stepIdx], 'ok');
  },

  animStepPrev() {
    const b = Store.get().activeBoard;
    b.anim.playing = false;
    if (!this._animTracks.length) {
      b.objects.forEach(o => { o._ox = o.x; o._oy = o.y; });
      this._animTracks = this._buildAnimTracks();
    }
    if (!this._animTracks.length) return;
    const steps = [...new Set(this._animTracks.map(tr => tr.step != null ? tr.step : (tr.path && tr.path.step) || 0))].sort((a,b)=>a-b);
    this._stepIdx = Math.max((this._stepIdx || 0) - 1, 0);
    this._applyStepOnly(steps[this._stepIdx]);
    Toast.show('Крок ' + steps[this._stepIdx], 'ok');
  },

  animPlay() {
    const b = Store.get().activeBoard;
    if (b.anim.playing) return;
    // зберегти початкові позиції
    b.objects.forEach(o => { o._ox = o.x; o._oy = o.y; });
    this._animTracks = this._buildAnimTracks();
    b.anim.paths = this._animTracks.map(t => t.path);
    if (!this._animTracks.length) {
      Toast.show('Немає стрілок руху/передач для анімації. Намалюйте ⇒ ⇢ ∿ ⚡', 'warn');
      return;
    }
    b.anim.playing = true;
    b.anim.frame = 0;
    this._stepIdx = 0;
    this._animElapsed = 0;
    this._animStartTs = performance.now();
    this._animPausedAt = 0;
    // Послідовність за step: кроки з одним step — паралельно, наступний step — після
    const byStep = {};
    this._animTracks.forEach(tr => {
      const st = (tr.path && tr.path.step) || 0;
      if (!byStep[st]) byStep[st] = [];
      byStep[st].push(tr);
    });
    let t0 = 0;
    Object.keys(byStep).map(Number).sort((a, b) => a - b).forEach(st => {
      const group = byStep[st];
      const maxDur = Math.max(...group.map(tr => tr.duration), 400);
      group.forEach(tr => { tr.start = t0; tr.step = st; });
      t0 += maxDur * 0.92;
    });
    this._animTotal = Math.max(...this._animTracks.map(tr => tr.start + tr.duration), 1000);
    document.getElementById('playersLayer')?.classList.add('animating');
    Toast.show('Анімація: ' + this._animTracks.length + ' рухів', 'ok');
    this._animLoop();
  },

  _animLoop() {
    const b = Store.get().activeBoard;
    if (!b.anim.playing) return;
    const now = performance.now();
    const speed = b.anim.speed || 1;
    const elapsed = (now - this._animStartTs) * speed;
    this._animElapsed = elapsed;
    b.anim.frame = Math.min(1, elapsed / this._animTotal);

    this._animTracks.forEach(tr => {
      const obj = b.objects.find(o => o.id === tr.objId);
      if (!obj) return;
      const local = (elapsed - tr.start) / tr.duration;
      if (local < 0) {
        obj.x = tr.x0; obj.y = tr.y0;
        return;
      }
      if (local >= 1) {
        obj.x = tr.x1; obj.y = tr.y1;
        return;
      }
      const te = this._easeInOut(local);
      obj.x = tr.x0 + (tr.x1 - tr.x0) * te;
      obj.y = tr.y0 + (tr.y1 - tr.y0) * te;
    });

    this._updateTokenPositionsLive();
    this._updateAnimProgress(b.anim.frame);

    if (elapsed >= this._animTotal) {
      // цикл
      this._animStartTs = performance.now();
      // скинути на старт треків
      this._animTracks.forEach(tr => {
        const obj = b.objects.find(o => o.id === tr.objId);
        if (obj) { obj.x = tr.x0; obj.y = tr.y0; }
      });
    }
    this._animRaf = requestAnimationFrame(() => this._animLoop());
  },

  /** Оновлення DOM без повного re-render (плавніше) */
  _updateTokenPositionsLive() {
    const layer = document.getElementById('playersLayer');
    if (!layer) return;
    const b = Store.get().activeBoard;
    layer.querySelectorAll('[data-id]').forEach(el => {
      const obj = b.objects.find(o => o.id === el.dataset.id);
      if (!obj) return;
      const pct = this.worldToScreenPct(obj.x, obj.y);
      el.style.left = pct.left + '%';
      el.style.top = pct.top + '%';
    });
  },

  _updateAnimProgress(frame) {
    let el = document.getElementById('animProgress');
    if (!el) {
      const c = document.getElementById('fieldContainer');
      if (!c) return;
      el = document.createElement('div');
      el.id = 'animProgress';
      el.className = 'anim-progress';
      c.appendChild(el);
    }
    el.style.display = 'block';
    el.style.width = Math.round(frame * 100) + '%';
  },

  animPause() {
    const b = Store.get().activeBoard;
    if (!b.anim.playing) return;
    b.anim.playing = false;
    if (this._animRaf) cancelAnimationFrame(this._animRaf);
    this._animPausedAt = this._animElapsed;
    Toast.show('Пауза анімації', 'ok');
  },
  animStop() {
    const b = Store.get().activeBoard;
    b.anim.playing = false;
    if (this._animRaf) cancelAnimationFrame(this._animRaf);
    this._animRaf = null;
    b.objects.forEach(o => {
      if (o._ox != null) { o.x = o._ox; o.y = o._oy; delete o._ox; delete o._oy; }
    });
    document.getElementById('playersLayer')?.classList.remove('animating');
    const bar = document.getElementById('animProgress');
    if (bar) bar.style.display = 'none';
    this.renderTokens();
    Toast.show('Анімацію зупинено', 'ok');
  },
  animRestart() {
    this.animStop();
    requestAnimationFrame(() => this.animPlay());
  },

  drawField(view) {
    const svg = document.getElementById('fieldSvg');
    const ds = document.getElementById('drawSvg');
    if (!svg) return;
    const W = 680, H = 1050;
    let vb = `0 0 ${W} ${H}`;
    if (view === 'half') vb = `0 0 ${W} ${H / 2}`;
    else if (view === 'third') vb = `0 0 ${W} ${H / 3}`;
    else if (view === 'def-third') vb = `0 ${H * 2 / 3} ${W} ${H / 3}`;
    else if (view === 'penalty' || view === 'box') vb = `${W * 0.15} ${H * 0.7} ${W * 0.7} ${H * 0.3}`;
    else if (view === 'own') vb = `0 ${H * 0.5} ${W} ${H * 0.5}`;
    else if (view === 'opp') vb = `0 0 ${W} ${H * 0.5}`;
    else if (view === 'center') vb = `0 ${H * 0.25} ${W} ${H * 0.5}`;
    svg.setAttribute('viewBox', vb);
    if (ds) ds.setAttribute('viewBox', vb);
    let grass = '';
    for (let i = 0; i < 12; i++) {
      grass += `<rect x="0" y="${i * (H / 12)}" width="${W}" height="${H / 12}" fill="${i % 2 === 0 ? '#1a5c2e' : '#1e6b35'}"/>`;
    }
    const L = 'rgba(255,255,255,0.85)';
    svg.innerHTML = grass +
      `<rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="${L}" stroke-width="2"/>` +
      `<line x1="20" y1="${H / 2}" x2="${W - 20}" y2="${H / 2}" stroke="${L}" stroke-width="2"/>` +
      `<circle cx="${W / 2}" cy="${H / 2}" r="91.5" fill="none" stroke="${L}" stroke-width="2"/>` +
      `<circle cx="${W / 2}" cy="${H / 2}" r="3" fill="${L}"/>` +
      `<rect x="${W / 2 - 201.5}" y="20" width="403" height="165" fill="none" stroke="${L}" stroke-width="2"/>` +
      `<rect x="${W / 2 - 91.5}" y="20" width="183" height="55" fill="none" stroke="${L}" stroke-width="2"/>` +
      `<circle cx="${W / 2}" cy="130" r="3" fill="${L}"/>` +
      `<rect x="${W / 2 - 201.5}" y="${H - 185}" width="403" height="165" fill="none" stroke="${L}" stroke-width="2"/>` +
      `<rect x="${W / 2 - 91.5}" y="${H - 75}" width="183" height="55" fill="none" stroke="${L}" stroke-width="2"/>` +
      `<circle cx="${W / 2}" cy="${H - 130}" r="3" fill="${L}"/>` +
      `<rect x="${W / 2 - 36.6}" y="5" width="73.2" height="15" fill="none" stroke="${L}" stroke-width="2"/>` +
      `<rect x="${W / 2 - 36.6}" y="${H - 20}" width="73.2" height="15" fill="none" stroke="${L}" stroke-width="2"/>` +
      /* Watermark — background only, no pointer events, not in undo */
      `<text class="pitch-watermark" x="${W / 2}" y="${H / 2 - 36}" text-anchor="middle" dominant-baseline="auto" ` +
      `fill="rgba(255,255,255,0.15)" font-family="system-ui,-apple-system,Segoe UI,sans-serif" ` +
      `font-weight="700" font-size="38" letter-spacing="2" pointer-events="none" style="user-select:none">Metalist Stuttgart</text>`;
  },

  /** Розмір фішки відносно видимої висоти поля (розмітка ~105м, гравець ~1.7%) */
  tokenMetrics() {
    const c = document.getElementById('fieldContainer');
    const h = (c && c.clientHeight) || 600;
    // діаметр відносно розмітки поля (zoom масштабує весь stage)
    const player = Math.max(14, Math.min(48, h * 0.028));
    const ball = Math.max(8, player * 0.42);
    const cone = Math.max(10, player * 0.55);
    const equip = Math.max(12, player * 0.7);
    return { player, ball, cone, equip, font: Math.max(8, player * 0.32) };
  },

  renderTokens() {
    const layer = document.getElementById('playersLayer');
    if (!layer) return;
    const s = Store.get();
    const m = this.tokenMetrics();
    layer.style.setProperty('--tok', m.player + 'px');
    layer.style.setProperty('--tok-font', m.font + 'px');
    layer.style.setProperty('--ball-sz', m.ball + 'px');
    const equipTypes = ['cone','mannequin','pole','ladder','minigoal','hoop','flag','bib'];
    const objs = s.activeBoard.objects.filter(o =>
      o.type === 'player' || o.type === 'opponent' || o.type === 'ball' || equipTypes.includes(o.type)
    );
    const sel = s.activeBoard.selectedId;
    let html = '';
    objs.forEach(o => {
      const pct = this.worldToScreenPct(o.x, o.y);
      const L = `left:${pct.left}%;top:${pct.top}%;transform:translate(-50%,-50%);pointer-events:all;cursor:grab;z-index:10;touch-action:none;position:absolute`;
      if (o.type === 'ball') {
        html += `<div class="ball" data-id="${o.id}" style="left:${pct.left}%;top:${pct.top}%;width:${m.ball}px;height:${m.ball}px"></div>`;
        return;
      }
      if (o.type === 'cone') {
        const bw = m.cone * 0.55, bh = m.cone;
        html += `<div class="eq cone" data-id="${o.id}" style="${L};width:0;height:0;border-left:${bw}px solid transparent;border-right:${bw}px solid transparent;border-bottom:${bh}px solid #e67e22"></div>`;
        return;
      }
      if (o.type === 'mannequin') {
        html += `<div class="eq mannequin" data-id="${o.id}" style="${L};width:${m.equip * 0.55}px;height:${m.equip}px;background:#95a5a6;border-radius:3px 3px 0 0"></div>`;
        return;
      }
      if (o.type === 'pole') {
        html += `<div class="eq pole" data-id="${o.id}" style="${L};width:${Math.max(4,m.equip*0.12)}px;height:${m.equip*1.2}px;background:#f39c12;border-radius:2px" title="Стійка"></div>`;
        return;
      }
      if (o.type === 'ladder') {
        html += `<div class="eq ladder" data-id="${o.id}" style="${L};width:${m.equip*1.1}px;height:${m.equip*0.45}px;background:repeating-linear-gradient(90deg,#e74c3c 0 3px,transparent 3px 8px);border:1px solid #c0392b;border-radius:2px" title="Драбинка"></div>`;
        return;
      }
      if (o.type === 'minigoal') {
        html += `<div class="eq minigoal" data-id="${o.id}" style="${L};width:${m.equip*1.4}px;height:${m.equip*0.9}px;border:2px solid #ecf0f1;border-bottom:none;border-radius:2px 2px 0 0;background:rgba(255,255,255,0.08)" title="Міні-ворота"></div>`;
        return;
      }
      if (o.type === 'hoop') {
        html += `<div class="eq hoop" data-id="${o.id}" style="${L};width:${m.equip}px;height:${m.equip}px;border:3px solid #9b59b6;border-radius:50%;background:transparent" title="Обруч"></div>`;
        return;
      }
      if (o.type === 'flag') {
        html += `<div class="eq flag" data-id="${o.id}" style="${L};width:${m.equip*0.15}px;height:${m.equip};background:#27ae60;box-shadow:4px -${m.equip*0.3}px 0 -1px #e74c3c" title="Прапорець"></div>`;
        return;
      }
      if (o.type === 'bib') {
        html += `<div class="eq bib" data-id="${o.id}" style="${L};width:${m.equip*0.7}px;height:${m.equip*0.55}px;background:#1abc9c;border-radius:4px;opacity:0.85" title="Манішка"></div>`;
        return;
      }
      const isGk = o.number === 1 || (o.team === 'own' && (() => {
        const pl = Store.get().players.find(p => p.id === o.playerId);
        return pl && pl.position === 'GK';
      })());
      const cls = 'pt ' + (o.team === 'opp' ? 'opp' : (isGk ? 'gk' : 'own')) + (sel === o.id ? ' sel' : '');
      let readiness = o.readiness;
      if (readiness == null && o.playerId) {
        const pl = Store.get().players.find(p => p.id === o.playerId);
        if (pl) readiness = pl.readiness != null ? pl.readiness : pl.condition;
      }
      const ringColor = readiness == null ? 'transparent'
        : readiness >= 80 ? '#2ecc71' : readiness >= 50 ? '#f1c40f' : '#e74c3c';
      const ring = readiness != null
        ? `<svg class="pt-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="3"/><circle cx="18" cy="18" r="16" fill="none" stroke="${ringColor}" stroke-width="3" stroke-dasharray="${(readiness/100)*100.5} 100.5" stroke-linecap="round" transform="rotate(-90 18 18)"/></svg>`
        : '';
      // Дані зі складу
      let pl = null;
      if (o.playerId) pl = Store.get().players.find(p => p.id === o.playerId);
      const posCode = o.position || (pl && pl.position) || (o.team === 'opp' ? '' : '');
      const status = o.status || (pl && pl.status) || '';
      const isInjured = status === 'injured';
      const isReserve = status === 'reserve' || (pl && pl.group === 'reserve');
      const statusBadge = isInjured
        ? '<span class="pt-badge pt-inj" title="Травма">✚</span>'
        : (isReserve ? '<span class="pt-badge pt-res" title="Резерв">R</span>' : '');
      const posBadge = posCode ? `<span class="pt-pos">${sanitize(posCode)}</span>` : '';
      const titleName = (o.label || ('#' + (o.number || ''))) + (posCode ? ' · ' + posCode : '');
      const titleExtra = (readiness != null ? ` · готовність ${readiness}%` : '') + (isInjured ? ' · ТРАВМА' : '') + (isReserve ? ' · резерв' : '');
      const label = o.label ? `<span class="tn">${sanitize(o.label)}</span>` : '';
      const extraCls = (isInjured ? ' injured' : '') + (isReserve ? ' reserve' : '');
      html += `<div class="${cls}${extraCls}" data-id="${o.id}" style="left:${pct.left}%;top:${pct.top}%;width:${m.player}px;height:${m.player}px;font-size:${m.font}px" title="${sanitize(titleName + titleExtra)}">${ring}${statusBadge}${posBadge}<span class="pt-num">${o.number || ''}</span>${label}</div>`;
    });
    layer.innerHTML = html;
    // Re-bind dblclick / contextmenu without inline handlers
    layer.querySelectorAll('.pt').forEach(el => {
      el.addEventListener('dblclick', () => {
        const obj = s.activeBoard.objects.find(o => o.id === el.dataset.id);
        if (!obj) return;
        Modal.prompt("Ім\'я / номер", obj.label || String(obj.number || ''), v => {
          if (v !== null) {
            obj.label = v;
            if (!isNaN(+v)) obj.number = +v;
            this.renderTokens();
            this.pushHistory();
          }
        });
      });
      el.addEventListener('contextmenu', ev => {
        ev.preventDefault();
        s.activeBoard.objects = s.activeBoard.objects.filter(x => x.id !== el.dataset.id);
        this.pushHistory();
        this.render();
      });
    });
  },

  renderDrawings() {
    const svg = document.getElementById('drawSvg');
    if (!svg) return;
    const s = Store.get();
    const W = 680, H = 1050;
    const tx = v => v * W, ty = v => v * H;
    // Apply camera transform to SVG group
    const z = this.camera.zoom || 1;
    const cx = this.camera.x || 0, cy = this.camera.y || 0;
    // For drawings we keep world coords in SVG viewBox; camera is applied via CSS transform on tokens.
    // Drawings use world 0..1 mapped to SVG — camera pan/zoom for drawings approximated by re-render tokens primarily.
    let html = `<defs>
      <marker id="ah" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#f1c40f"/></marker>
      <marker id="ahb" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#3498db"/></marker>
      <marker id="ahr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#e74c3c"/></marker>
      <marker id="ahg" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#2ecc71"/></marker>
      <marker id="ahw" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#fff"/></marker>
    </defs>`;

    s.activeBoard.objects.forEach(o => {
      if (['arrow', 'arrowDash', 'pass', 'run', 'dribble', 'press', 'shot'].includes(o.type) && o.x2 != null) {
        let col = o.color || this.strokeColorFor(o.type), mk = 'ah', dash = '', sw = 3;
        if (o.type === 'pass') { col = o.color || '#3498db'; mk = 'ahb'; }
        else if (o.type === 'press') { col = o.color || '#e74c3c'; mk = 'ahr'; }
        else if (o.type === 'run') { col = '#2ecc71'; mk = 'ahg'; dash = 'stroke-dasharray="10,6"'; }
        else if (o.type === 'dribble') { col = '#9b59b6'; mk = 'ah'; dash = 'stroke-dasharray="4,4"'; }
        else if (o.type === 'shot') { col = '#fff'; mk = 'ahw'; sw = 4; }
        else if (o.type === 'arrowDash') { dash = 'stroke-dasharray="8,6"'; }
        html += `<line x1="${tx(o.x)}" y1="${ty(o.y)}" x2="${tx(o.x2)}" y2="${ty(o.y2)}" stroke="${col}" stroke-width="${sw}" marker-end="url(#${mk})" ${dash}/>`;
        if (o.step != null) {
          const mx = (tx(o.x) + tx(o.x2)) / 2, my = (ty(o.y) + ty(o.y2)) / 2;
          html += `<circle cx="${mx}" cy="${my}" r="11" fill="rgba(13,17,23,0.85)" stroke="${col}" stroke-width="1.5"/>`;
          html += `<text x="${mx}" y="${my + 4}" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" font-family="system-ui,sans-serif">${o.step}</text>`;
        }
      } else if (o.type === 'zone') {
        if (o.shape === 'rect' || (!o.shape && o.w)) {
          html += `<rect x="${tx(o.x)}" y="${ty(o.y)}" width="${tx(o.w || 0)}" height="${ty(o.h || 0)}" fill="${o.fill || 'rgba(200,168,75,0.25)'}" stroke="#c8a84b" stroke-width="2" stroke-dasharray="6,4" opacity="${o.opacity || 0.4}"/>`;
          if (o.label) html += `<text x="${tx(o.x + (o.w || 0) / 2)}" y="${ty(o.y) + 16}" fill="#fff" font-size="14" text-anchor="middle" font-weight="600">${sanitize(o.label)}</text>`;
        } else if (o.shape === 'circle' || o.shape === 'ellipse') {
          const rx = tx(o.rx || o.r || 0.05), ry = ty(o.ry || o.r || 0.05);
          html += `<ellipse cx="${tx(o.x)}" cy="${ty(o.y)}" rx="${rx}" ry="${ry}" fill="${o.fill || 'rgba(52,152,219,0.2)'}" stroke="#3498db" stroke-width="2" opacity="${o.opacity || 0.35}"/>`;
        } else if (o.shape === 'polygon' && o.points && o.points.length) {
          const pts = o.points.map(p => tx(p.x) + ',' + ty(p.y)).join(' ');
          html += `<polygon points="${pts}" fill="${o.fill || 'rgba(200,168,75,0.25)'}" stroke="#c8a84b" stroke-width="2" stroke-dasharray="6,4" opacity="${o.opacity || 0.4}"/>`;
          if (o.label) {
            const cx = o.points.reduce((a, p) => a + p.x, 0) / o.points.length;
            const cy = o.points.reduce((a, p) => a + p.y, 0) / o.points.length;
            html += `<text x="${tx(cx)}" y="${ty(cy)}" fill="#fff" font-size="14" text-anchor="middle" font-weight="600">${sanitize(o.label)}</text>`;
          }
        }
      } else if (o.type === 'text') {
        html += `<text x="${tx(o.x)}" y="${ty(o.y)}" fill="#fff" font-size="16" font-weight="600" text-anchor="middle">${sanitize(o.label)}</text>`;
      }
    });

    // Live polygon points
    if (this.polygonPoints.length) {
      const pts = this.polygonPoints.map(p => tx(p.x) + ',' + ty(p.y)).join(' ');
      html += `<polyline points="${pts}" fill="none" stroke="#c8a84b" stroke-width="2" stroke-dasharray="4,4"/>`;
      this.polygonPoints.forEach(p => {
        html += `<circle cx="${tx(p.x)}" cy="${ty(p.y)}" r="5" fill="#c8a84b"/>`;
      });
    }

    svg.innerHTML = html;
  },

  _previewFreehand() {
    // lightweight preview during freehand
    this.renderDrawings();
  },

  render() {
    const s = Store.get();
    // Утримати всі об'єкти в межах газону
    (s.activeBoard.objects || []).forEach(o => {
      if (typeof o.x === 'number' && typeof o.y === 'number') {
        const p = this.clampWorld(o.x, o.y);
        o.x = p.x; o.y = p.y;
      }
      if (typeof o.x2 === 'number' && typeof o.y2 === 'number') {
        o.x2 = clamp(o.x2, 0, 1);
        o.y2 = clamp(o.y2, 0, 1);
      }
    });
    this.applyCamera();
    this.drawField(s.activeBoard.fieldView || 'full');
    this.renderTokens();
    this.renderDrawings();
    this.updateZoomIndicator();
  },


  /** Захопити кадр дошки в canvas (для GIF) */
  async _captureBoardFrame(w, h) {
    const stage = document.getElementById('fieldStage') || document.getElementById('fieldContainer');
    if (!stage) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a1f12';
    ctx.fillRect(0, 0, w, h);
    try {
      // foreignObject SVG serialize of stage
      const data = new XMLSerializer().serializeToString(stage);
      // Prefer html2canvas-free approach: draw field SVG + tokens approx
      const fieldSvg = document.getElementById('fieldSvg');
      const drawSvg = document.getElementById('drawSvg');
      if (fieldSvg) {
        const xml = new XMLSerializer().serializeToString(fieldSvg);
        const img = await this._svgToImage(xml, w, h);
        if (img) ctx.drawImage(img, 0, 0, w, h);
      }
      if (drawSvg) {
        const xml2 = new XMLSerializer().serializeToString(drawSvg);
        const img2 = await this._svgToImage(xml2, w, h);
        if (img2) ctx.drawImage(img2, 0, 0, w, h);
      }
      // tokens as circles
      const s = Store.get();
      const m = this.tokenMetrics();
      (s.activeBoard.objects || []).forEach(o => {
        if (!['player', 'opponent', 'ball'].includes(o.type)) return;
        const px = (o.x || 0) * w, py = (o.y || 0) * h;
        ctx.beginPath();
        if (o.type === 'ball') {
          ctx.fillStyle = '#fff';
          ctx.arc(px, py, Math.max(4, m.ball / 2), 0, Math.PI * 2);
        } else {
          ctx.fillStyle = o.team === 'opp' ? '#e74c3c' : (o.number === 1 ? '#f1c40f' : '#2980b9');
          ctx.arc(px, py, Math.max(6, m.player / 2), 0, Math.PI * 2);
        }
        ctx.fill();
        if (o.type !== 'ball' && o.number != null) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px system-ui,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(o.number), px, py);
        }
      });
    } catch (e) {
      console.warn('[gif frame]', e);
    }
    return ctx.getImageData(0, 0, w, h);
  },

  _svgToImage(svgXml, w, h) {
    return new Promise(resolve => {
      try {
        const blob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      } catch (_) { resolve(null); }
    });
  },

  async exportGifStatic() {
    Toast.show('Знімок GIF…', 'ok');
    const W = 340, H = 524;
    this.renderTokens();
    this.renderDrawings();
    await new Promise(r => requestAnimationFrame(r));
    const frame = await this._captureBoardFrame(W, H);
    if (!frame) {
      Toast.show('Не вдалося зняти поле', 'err');
      return;
    }
    try {
      const blob = GifEncoder.encode([frame], W, H, 100);
      await this._shareOrDownloadBlob(blob, 'metalist-board-static.gif');
    } catch (e) {
      Toast.show('Помилка GIF: ' + (e.message || e), 'err');
    }
  },

  async _shareOrDownloadBlob(blob, filename) {
    const file = new File([blob], filename, { type: 'image/gif' });
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'МЕТАЛІСТ ШТУТГАРТ', text: 'Тактична схема' });
        Toast.show('GIF надіслано', 'ok');
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      Toast.show('GIF збережено', 'ok');
    } catch (e2) {
      // data URL fallback
      const reader = new FileReader();
      reader.onload = () => {
        const a = document.createElement('a');
        a.href = reader.result;
        a.download = filename;
        a.click();
        Toast.show('GIF збережено', 'ok');
      };
      reader.readAsDataURL(blob);
    }
  },

  async exportGif() {
    Toast.show('Готуємо GIF…', 'ok');
    const b = Store.get().activeBoard;
    b.objects.forEach(o => { o._ox = o.x; o._oy = o.y; });
    this._animTracks = this._buildAnimTracks();
    if (!this._animTracks.length) {
      // Статичний GIF — поточна розстановка
      await this.exportGifStatic();
      return;
    }
    const W = 320, H = 494; // ~68:105
    const frames = [];
    const steps = [...new Set(this._animTracks.map(tr => tr.step != null ? tr.step : (tr.path && tr.path.step) || 0))].sort((a,b)=>a-b);
    // start frame
    b.objects.forEach(o => { if (o._ox != null) { o.x = o._ox; o.y = o._oy; } });
    this.renderTokens();
    frames.push(await this._captureBoardFrame(W, H));
    for (const st of steps) {
      // end of each step
      this._animTracks.forEach(tr => {
        const obj = b.objects.find(o => o.id === tr.objId);
        if (!obj) return;
        const s = tr.step != null ? tr.step : ((tr.path && tr.path.step) || 0);
        if (s <= st) { obj.x = tr.x1; obj.y = tr.y1; }
        else { obj.x = tr.x0; obj.y = tr.y0; }
      });
      this.renderTokens();
      await new Promise(r => requestAnimationFrame(r));
      frames.push(await this._captureBoardFrame(W, H));
    }
    // restore
    b.objects.forEach(o => {
      if (o._ox != null) { o.x = o._ox; o.y = o._oy; delete o._ox; delete o._oy; }
    });
    this.renderTokens();

    const valid = frames.filter(Boolean);
    if (!valid.length) {
      Toast.show('Не вдалося зняти кадри', 'err');
      return;
    }
    try {
      const blob = GifEncoder.encode(valid, W, H, 60);
      await this._shareOrDownloadBlob(blob, 'metalist-tactics.gif');
    } catch (e) {
      console.error(e);
      Toast.show('Помилка GIF: ' + (e.message || e), 'err');
    }
  },

  renderToolbar() {
    const el = document.getElementById('boardToolbar');
    if (!el) return;
    const tool = Store.get().activeBoard.tool;
    const collapsed = el.classList.contains('btb-collapsed') || localStorage.getItem('ms_btb_collapsed') === '1';
    if (collapsed) el.classList.add('btb-collapsed');
    else el.classList.remove('btb-collapsed');
    el.innerHTML = `
      <div class="tg btb-chrome" title="Керування панеллю">
        <button type="button" class="tb tb-exit" data-action="exit-board" title="Вихід з дошки">✕</button>
        <button type="button" class="tb" data-action="toggle-toolbar-collapse" title="Згорнути / розгорнути панель">↕</button>
        <button type="button" class="tb" data-action="lock-toolbar" title="Зафіксувати панель">🔒</button>
        <button type="button" class="tb" data-action="toggle-fullscreen" title="На весь екран">⛶</button>
        <button type="button" class="tb" data-action="zoom-fit" title="Вписати поле">⊡</button>
      </div>
      <div class="btb-rows">
      <div class="tg">
        <button class="tb" data-action="toggle-present" title="Режим показу">▶ Показ</button>
      </div>
      <div class="tg">
        <button class="tb ${tool==='select'?'on':''}" data-tool="select" title="Вибір">↖</button>
        <button class="tb ${tool==='player'?'on':''}" data-tool="player" title="Гравець">●</button>
        <button class="tb ${tool==='opponent'?'on':''}" data-tool="opponent" title="Суперник">○</button>
        <button class="tb ${tool==='ball'?'on':''}" data-tool="ball" title="М\'яч">⚽</button>
      </div>
      <div class="tg">
        <button class="tb ${tool==='pass'?'on':''}" data-tool="pass" title="Передача (пас)">⇒</button>
        <button class="tb ${tool==='run'?'on':''}" data-tool="run" title="Рух без м'яча">⇢</button>
        <button class="tb ${tool==='dribble'?'on':''}" data-tool="dribble" title="Ведення">∿</button>
        <button class="tb ${tool==='shot'?'on':''}" data-tool="shot" title="Удар">⚡</button>
        <button class="tb ${tool==='press'?'on':''}" data-tool="press" title="Пресинг">⬇</button>
        <button class="tb ${tool==='arrow'?'on':''}" data-tool="arrow" title="Стрілка">→</button>
      </div>
      <div class="tg" title="Колір стрілки">
        <button type="button" class="tb color-swatch ${(Store.get().activeBoard.drawColor||'')==='#ecf0f1'?'on':''}" data-action="set-draw-color" data-color="#ecf0f1" title="Білий" style="background:#ecf0f1"></button>
        <button type="button" class="tb color-swatch ${(Store.get().activeBoard.drawColor||'')==='#3498db'?'on':''}" data-action="set-draw-color" data-color="#3498db" title="Блакитний (пас)" style="background:#3498db"></button>
        <button type="button" class="tb color-swatch ${(Store.get().activeBoard.drawColor||'')==='#2ecc71'?'on':''}" data-action="set-draw-color" data-color="#2ecc71" title="Зелений" style="background:#2ecc71"></button>
        <button type="button" class="tb color-swatch ${(Store.get().activeBoard.drawColor||'')==='#f1c40f'?'on':''}" data-action="set-draw-color" data-color="#f1c40f" title="Жовтий (рух)" style="background:#f1c40f"></button>
        <button type="button" class="tb color-swatch ${(Store.get().activeBoard.drawColor||'')==='#e67e22'?'on':''}" data-action="set-draw-color" data-color="#e67e22" title="Помаранчевий" style="background:#e67e22"></button>
        <button type="button" class="tb color-swatch ${(Store.get().activeBoard.drawColor||'')==='#e74c3c'?'on':''}" data-action="set-draw-color" data-color="#e74c3c" title="Червоний (пресинг)" style="background:#e74c3c"></button>
        <button type="button" class="tb color-swatch ${(Store.get().activeBoard.drawColor||'')==='#9b59b6'?'on':''}" data-action="set-draw-color" data-color="#9b59b6" title="Фіолетовий (ведення)" style="background:#9b59b6"></button>
      </div>
      <div class="tg">
        <button class="tb ${tool==='zone'?'on':''}" data-tool="zone" title="Зона (прямокутник)">▢</button>
        <button class="tb ${tool==='circle'?'on':''}" data-tool="circle" title="Зона (коло)">○</button>
        <button class="tb ${tool==='polygon'?'on':''}" data-tool="polygon" title="Зона (багатокутник)">⬠</button>
        <button class="tb ${tool==='freehand'?'on':''}" data-tool="freehand" title="Зона (вільна)">✎</button>
        <button class="tb ${tool==='cone'?'on':''}" data-tool="cone" title="Фішка (конус)">△</button>
        <button class="tb ${tool==='mannequin'?'on':''}" data-tool="mannequin" title="Манекен">▣</button>
        <button class="tb ${tool==='pole'?'on':''}" data-tool="pole" title="Стійка">│</button>
        <button class="tb ${tool==='ladder'?'on':''}" data-tool="ladder" title="Координаційна драбинка">≡</button>
        <button class="tb ${tool==='minigoal'?'on':''}" data-tool="minigoal" title="Міні-ворота">⊓</button>
        <button class="tb ${tool==='hoop'?'on':''}" data-tool="hoop" title="Обруч">◯</button>
        <button class="tb ${tool==='flag'?'on':''}" data-tool="flag" title="Прапорець кутовий">⚑</button>
        <button class="tb ${tool==='bib'?'on':''}" data-tool="bib" title="Манішка">▦</button>
        <button class="tb ${tool==='text'?'on':''}" data-tool="text" title="Текст">T</button>
      </div>
      <div class="tg">
        <select id="fieldViewSel" style="padding:3px 6px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px">
          <option value="full">Повне поле</option><option value="half">Половина</option><option value="third">Атакувальна третина</option><option value="def-third">Оборонна третина</option><option value="penalty">Штрафний майданчик</option>
          <option value="box">Штрафний (box)</option><option value="own">Своя третина</option><option value="opp">Чужа третина</option>
        </select>
      </div>
      <div class="tg">
        <select id="schemeSel" style="padding:3px 6px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px">
          <option value="">Формація...</option>
          ${Object.keys(SCHEMES).map(k => `<option value="${k}">${k}</option>`).join('')}
        </select>
      </div>
      <div class="tg">
        <button class="tb" data-action="zoom-out" title="Зменшити">−</button>
        <button class="tb" data-action="zoom-fit" title="Вписати поле">⊡</button>
        <button class="tb" data-action="zoom-in" title="Збільшити">+</button>
      </div>
      <div class="tg" title="Анімація та кроки">
        <button class="tb" data-action="anim-play" title="Відтворити">▶</button>
        <button class="tb" data-action="anim-pause" title="Пауза">⏸</button>
        <button class="tb" data-action="anim-stop" title="Стоп">⏹</button>
        <button class="tb" data-action="anim-step-prev" title="Попередній крок">⏮</button>
        <button class="tb" data-action="anim-step-next" title="Наступний крок">⏭</button>
        <span id="stepInd" class="step-ind" title="Поточний крок">—</span>
        <input type="range" id="animSpeed" min="0.25" max="2" step="0.25" value="1" style="width:50px" title="Швидкість">
        <button class="tb" data-action="export-gif" title="GIF анімований / статичний">GIF</button>
        <button class="tb" data-action="export-gif-static" title="Статичний знімок GIF">📷</button>
      </div>
      <div class="tg">
        <button class="tb" data-action="board-undo" title="Скасувати">↩</button>
        <button class="tb" data-action="board-redo" title="Повторити">↪</button>
        <button class="tb" data-action="board-clear" title="Очистити">🗑</button>
        <button class="tb" data-action="board-save" title="Зберегти схему">💾</button>
      </div>
      </div>`;
    const fv = document.getElementById('fieldViewSel');
    if (fv) {
      fv.value = Store.get().activeBoard.fieldView || 'full';
      fv.onchange = () => {
        Store.get().activeBoard.fieldView = fv.value;
        BoardEngine.drawField(fv.value);
        BoardEngine.renderTokens();
        BoardEngine.renderDrawings();
        BoardEngine.fitField();
      };
    }
    const ss = document.getElementById('schemeSel');
    if (ss) ss.onchange = () => { if (ss.value) BoardEngine.applyScheme(ss.value); };
    const sp = document.getElementById('animSpeed');
    if (sp) sp.oninput = () => { Store.get().activeBoard.anim.speed = parseFloat(sp.value) || 1; };
  }
};


