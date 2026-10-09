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
      new ResizeObserver(() => this.renderTokens()).observe(c);
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
  screenToWorld(clientX, clientY) {
    const c = document.getElementById('fieldContainer');
    if (!c) return { x: 0.5, y: 0.5 };
    const r = c.getBoundingClientRect();
    // local 0..1 in visible container
    let lx = (clientX - r.left) / Math.max(1, r.width);
    let ly = (clientY - r.top) / Math.max(1, r.height);
    // apply inverse camera
    const z = this.camera.zoom || 1;
    const wx = (lx - 0.5) / z + 0.5 + this.camera.x;
    const wy = (ly - 0.5) / z + 0.5 + this.camera.y;
    return { x: clamp(wx, 0, 1), y: clamp(wy, 0, 1) };
  },

  worldToScreenPct(wx, wy) {
    const z = this.camera.zoom || 1;
    const sx = ((wx - this.camera.x - 0.5) * z + 0.5) * 100;
    const sy = ((wy - this.camera.y - 0.5) * z + 0.5) * 100;
    return { left: sx, top: sy };
  },

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
    Toast.show('↩ Undo');
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
    Toast.show('↪ Redo');
  },

  /* ── FULLSCREEN / BOARD-ONLY MODE ── */
  enterFullscreen() {
    this.isBoardOnly = true;
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
        target.classList.add('dragging');
        // Visual select only — NO full app rerender, NO save
        this.renderTokens();
        return;
      }
    }

    // Tool actions
    if (tool === 'player' || tool === 'opponent') {
      const num = s.activeBoard.objects.filter(o => o.type === 'player' || o.type === 'opponent').length + 1;
      s.activeBoard.objects.push({
        id: uid(), type: tool === 'opponent' ? 'opponent' : 'player',
        x: world.x, y: world.y, number: num, label: '',
        team: tool === 'opponent' ? 'opp' : 'own', playerId: null,
        rotation: 0, locked: false, visible: true
      });
      this.pushHistory();
      this.render();
      return;
    }

    if (tool === 'ball') {
      s.activeBoard.objects = s.activeBoard.objects.filter(o => o.type !== 'ball');
      s.activeBoard.objects.push({ id: uid(), type: 'ball', x: world.x, y: world.y, locked: false, visible: true });
      this.pushHistory();
      this.render();
      return;
    }

    if (['cone','mannequin','pole','ladder','minigoal','hoop','flag','bib'].includes(tool)) {
      s.activeBoard.objects.push({ id: uid(), type: tool, x: world.x, y: world.y, rotation: 0, locked: false, visible: true });
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
      this.startPos = world;
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
          s.activeBoard.objects.push({ id: uid(), type: 'text', x: world.x, y: world.y, label: text, locked: false, visible: true });
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
      this.renderTokens();
      this.renderDrawings();
      return;
    }

    /* ── DRAG: player follows finger continuously ── */
    if (this.dragObj && (this.activePointerId === null || this.activePointerId === e.pointerId)) {
      const world = this.screenToWorld(e.clientX, e.clientY);
      this.dragObj.x = clamp(world.x - this.dragOffset.x, -0.02, 1.02);
      this.dragObj.y = clamp(world.y - this.dragOffset.y, -0.02, 1.02);
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
        s.activeBoard.objects.push({
          id: uid(), type: tool,
          x: this.startPos.x, y: this.startPos.y,
          x2: world.x, y2: world.y,
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

  applyScheme(name) {
    const scheme = SCHEMES[name];
    if (!scheme) return;
    const s = Store.get();
    s.activeBoard.objects = s.activeBoard.objects.filter(o => o.type !== 'player' && o.type !== 'opponent');
    scheme.forEach(([num, x, y]) => {
      s.activeBoard.objects.push({
        id: uid(), type: 'player', x, y, number: num,
        label: '', team: 'own', playerId: null, rotation: 0, locked: false, visible: true
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

  /* Animation */
  animPlay() {
    const b = Store.get().activeBoard;
    if (b.anim.playing) return;
    b.anim.paths = b.objects.filter(o => ['arrow', 'pass', 'run', 'dribble', 'arrowDash', 'shot'].includes(o.type));
    b.anim.playing = true;
    b.anim.frame = 0;
    b.objects.forEach(o => { o._ox = o.x; o._oy = o.y; });
    this._animLoop();
  },
  _animLoop() {
    const b = Store.get().activeBoard;
    if (!b.anim.playing) return;
    b.anim.frame += 0.006 * (b.anim.speed || 1);
    if (b.anim.frame > 1) b.anim.frame = 0;
    const ball = b.objects.find(o => o.type === 'ball');
    if (ball && b.anim.paths.length) {
      const idx = Math.floor(b.anim.frame * b.anim.paths.length) % b.anim.paths.length;
      const p = b.anim.paths[idx];
      if (p && p.x2 != null) {
        const t = (b.anim.frame * b.anim.paths.length) % 1;
        // ease
        const te = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        ball.x = p.x + (p.x2 - p.x) * te;
        ball.y = p.y + (p.y2 - p.y) * te;
      }
    }
    b.objects.filter(o => o.type === 'player' || o.type === 'opponent').forEach((o, i) => {
      if (o._ox == null) return;
      o.x = o._ox + Math.sin(b.anim.frame * Math.PI * 2 + i) * 0.006;
      o.y = o._oy + Math.cos(b.anim.frame * Math.PI * 2 + i * 0.7) * 0.004;
    });
    this.renderTokens();
    requestAnimationFrame(() => this._animLoop());
  },
  animPause() { Store.get().activeBoard.anim.playing = false; },
  animStop() {
    const b = Store.get().activeBoard;
    b.anim.playing = false;
    b.objects.forEach(o => {
      if (o._ox != null) { o.x = o._ox; o.y = o._oy; delete o._ox; delete o._oy; }
    });
    this.renderTokens();
  },
  animRestart() { this.animStop(); this.animPlay(); },

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
    const z = (this.camera && this.camera.zoom) || 1;
    // базовий діаметр гравця ≈ 2.8% висоти поля * zoom
    const player = Math.max(14, Math.min(52, h * 0.028 * z));
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
      const isGk = o.number === 1;
      const cls = 'pt ' + (o.team === 'opp' ? 'opp' : (isGk ? 'gk' : 'own')) + (sel === o.id ? ' sel' : '');
      const label = o.label ? `<span class="tn">${sanitize(o.label)}</span>` : '';
      html += `<div class="${cls}" data-id="${o.id}" style="left:${pct.left}%;top:${pct.top}%;width:${m.player}px;height:${m.player}px;font-size:${m.font}px" title="${sanitize(o.label || '#' + o.number)}">${o.number || ''}${label}</div>`;
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
        let col = '#f1c40f', mk = 'ah', dash = '', sw = 3;
        if (o.type === 'pass') { col = '#3498db'; mk = 'ahb'; }
        else if (o.type === 'press') { col = '#e74c3c'; mk = 'ahr'; }
        else if (o.type === 'run') { col = '#2ecc71'; mk = 'ahg'; dash = 'stroke-dasharray="10,6"'; }
        else if (o.type === 'dribble') { col = '#9b59b6'; mk = 'ah'; dash = 'stroke-dasharray="4,4"'; }
        else if (o.type === 'shot') { col = '#fff'; mk = 'ahw'; sw = 4; }
        else if (o.type === 'arrowDash') { dash = 'stroke-dasharray="8,6"'; }
        html += `<line x1="${tx(o.x)}" y1="${ty(o.y)}" x2="${tx(o.x2)}" y2="${ty(o.y2)}" stroke="${col}" stroke-width="${sw}" marker-end="url(#${mk})" ${dash}/>`;
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
    this.drawField(s.activeBoard.fieldView || 'full');
    this.renderTokens();
    this.renderDrawings();
    this.updateZoomIndicator();
  },

  renderToolbar() {
    const el = document.getElementById('boardToolbar');
    if (!el) return;
    const tool = Store.get().activeBoard.tool;
    el.innerHTML = `
      <div class="tg" title="Панелі">
        <button class="tb" data-action="toggle-nav" title="Навігація">☰</button>
        <button class="tb" data-action="toggle-tools" title="Панель інструментів">🧰</button>
        <button class="tb" data-action="toggle-props" title="Властивості">☰│</button>
        <button class="tb" data-action="show-all-panels" title="Показати всі панелі">▦</button>
        <button class="tb" data-action="toggle-fullscreen" title="На весь екран">⛶</button>
      </div>
      <div class="tg">
        <button class="tb" data-action="toggle-present" title="Режим показу">▶ Показ</button>
        <button class="tb" data-action="toggle-fullscreen" title="Fullscreen Board">⛶</button>
      </div>
      <div class="tg">
        <button class="tb ${tool==='select'?'on':''}" data-tool="select" title="Вибір">↖</button>
        <button class="tb ${tool==='player'?'on':''}" data-tool="player" title="Гравець">●</button>
        <button class="tb ${tool==='opponent'?'on':''}" data-tool="opponent" title="Суперник">○</button>
        <button class="tb ${tool==='ball'?'on':''}" data-tool="ball" title="М\'яч">⚽</button>
      </div>
      <div class="tg">
        <button class="tb ${tool==='pass'?'on':''}" data-tool="pass" title="Передача">⇒</button>
        <button class="tb ${tool==='run'?'on':''}" data-tool="run" title="Рух">⇢</button>
        <button class="tb ${tool==='dribble'?'on':''}" data-tool="dribble" title="Ведення">∿</button>
        <button class="tb ${tool==='shot'?'on':''}" data-tool="shot" title="Удар">⚡</button>
        <button class="tb ${tool==='press'?'on':''}" data-tool="press" title="Пресинг">⬇</button>
        <button class="tb ${tool==='arrow'?'on':''}" data-tool="arrow" title="Стрілка">→</button>
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
          <option value="full">Повне поле</option><option value="half">Half</option><option value="third">Атакувальна третина</option><option value="def-third">Оборонна третина</option><option value="penalty">Штрафний майданчик</option>
          <option value="box">Box</option><option value="own">Own</option><option value="opp">Opp</option>
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
      <div class="tg">
        <button class="tb" data-action="anim-play" title="Відтворити">▶</button>
        <button class="tb" data-action="anim-pause" title="Пауза">⏸</button>
        <button class="tb" data-action="anim-stop" title="Стоп">⏹</button>
        <input type="range" id="animSpeed" min="0.25" max="2" step="0.25" value="1" style="width:50px" title="Швидкість">
      </div>
      <div class="tg">
        <button class="tb" data-action="board-undo" title="Скасувати">↩</button>
        <button class="tb" data-action="board-redo" title="Повторити">↪</button>
        <button class="tb" data-action="board-clear" title="Очистити">🗑</button>
        <button class="tb" data-action="board-save" title="Зберегти схему">💾</button>
      </div>`;
    const fv = document.getElementById('fieldViewSel');
    if (fv) {
      fv.value = Store.get().activeBoard.fieldView || 'full';
      fv.onchange = () => { Store.get().activeBoard.fieldView = fv.value; BoardEngine.drawField(fv.value); };
    }
    const ss = document.getElementById('schemeSel');
    if (ss) ss.onchange = () => { if (ss.value) BoardEngine.applyScheme(ss.value); };
    const sp = document.getElementById('animSpeed');
    if (sp) sp.oninput = () => { Store.get().activeBoard.anim.speed = parseFloat(sp.value) || 1; };
  }
};


