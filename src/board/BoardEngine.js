/** Extracted module: src/board/BoardEngine.js lines 599-1437 — DO NOT rewrite business logic */
/* ─── BOARD ENGINE ──────────────────────────────────────── */
const BoardEngine = {
  /** Колір воротаря — завжди окремий, не з палітри */
  GK_CHIP_COLOR: '#f1c40f',

  /* ── Pointer / Drag state ── */
  drawing: false,
  startPos: null,
  dragObj: null,
  dragOffset: { x: 0, y: 0 },
  activePointerId: null,
  /** Drag з лавки на поле */
  benchDragId: null,
  benchGhost: null,
  /** Тап по запасним → наступний тап по полю ставить його */
  pendingFromBenchId: null,
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
  FIELD_MIN: 0.01,
  FIELD_MAX: 0.99,
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


  /** Скинути «залиплі» жести — головний захист від зависання дошки */
  resetInteractionState(reason) {
    try {
      this.pointers.clear();
      this.dragObj = null;
      this.activePointerId = null;
      this.drawing = false;
      this.startPos = null;
      this.panStart = null;
      this.lastPinchDist = 0;
      this._freehand = null;
      this.benchDragId = null;
      if (this.benchGhost && this.benchGhost.parentNode) {
        try { this.benchGhost.parentNode.removeChild(this.benchGhost); } catch (_) {}
      }
      this.benchGhost = null;
      document.querySelectorAll('.pt.dragging, .ball.dragging').forEach(el => el.classList.remove('dragging'));
      const panel = document.getElementById('benchPanel');
      if (panel) panel.classList.remove('drop-target');
    } catch (_) {}
    if (reason) try { console.debug('[board] resetInteraction', reason); } catch (_) {}
  },

  init() {
    const c = document.getElementById('fieldContainer');
    if (!c) return;
    if (c.dataset.beBound === '1') {
      // повторна ініціалізація — лише скинути стан, не дублювати listeners
      this.resetInteractionState('reinit');
      this.applyCamera();
      return;
    }
    c.dataset.beBound = '1';
    c.style.touchAction = 'none';
    c.style.userSelect = 'none';
    c.style.webkitUserSelect = 'none';
    // Unified Pointer Events — primary interaction path
    c.addEventListener('pointerdown', e => this.onPointerDown(e), { passive: false });
    c.addEventListener('pointermove', e => this.onPointerMove(e), { passive: false });
    c.addEventListener('pointerup', e => this.onPointerUp(e));
    c.addEventListener('pointercancel', e => this.onPointerUp(e));
    c.addEventListener('lostpointercapture', e => this.onPointerUp(e));
    c.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());
    // Глобальна сітка безпеки: pointerup поза контейнером / втрата фокусу
    if (!this._globalPointerBound) {
      this._globalPointerBound = true;
      const safeUp = (e) => {
        if (this.pointers.size || this.dragObj || this.panStart || this.drawing || this.benchDragId) {
          this.onPointerUp(e);
        }
      };
      document.addEventListener('pointerup', safeUp, true);
      document.addEventListener('pointercancel', safeUp, true);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.resetInteractionState('hidden');
      });
      window.addEventListener('blur', () => this.resetInteractionState('blur'));
    }
    this._bindBenchPanelOnce();
    // Resize
    if (window.ResizeObserver) {
      new ResizeObserver(() => { this._sizeStageToPitch && this._sizeStageToPitch(); this.applyCamera(); this.renderTokens(); this.renderDrawings(); }).observe(c);
      // Freeze guard: clear stuck multi-touch state that leaves zoom indicator active without movement
      if (!this._freezeGuard) {
        this._freezeGuard = setInterval(() => {
          try {
            if (this.pointers && this.pointers.size && !this.dragObj && !this.panStart && !this.drawing && !this.benchDragId) {
              // no recent activity — clear
              if (!this._lastPtrTs || (Date.now() - this._lastPtrTs > 1200)) {
                this.pointers.clear();
                this.lastPinchDist = 0;
                this.updateZoomIndicator && this.updateZoomIndicator();
              }
            }
          } catch (_) {}
        }, 800);
      }
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { this.fitField(); this.render(); }, 200);
    });
    window.addEventListener('resize', () => {
      this.applyCamera();
    });
    }
    // Space for pan
    document.addEventListener('keydown', e => {
      if (e.code === 'Escape') { this.resetInteractionState('escape'); this.applyCamera(); return; }
      if (e.code === 'Space' && !isInput(e.target)) { this.spaceHeld = true; e.preventDefault(); }
    });
    document.addEventListener('keyup', e => {
      if (e.code === 'Space') this.spaceHeld = false;
    });
    // Fullscreen change
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && this.isBoardOnly) {
        // ESC у браузері — знімаємо лише native FS, CSS board-only лишається до ⛶
        try { this.renderToolbar && this.renderToolbar(); } catch (_) {}
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
      if (o.onBench) return;
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

  /** Вписати поле в контейнер зі збереженням пропорцій 68:105 (як viewBox).
   *  Критично: stage має ті самі пропорції, що й SVG, інакше % фішок ≠ розмітка. */
  fitField() {
    this.camera = { x: 0, y: 0, zoom: 1 };
    this._sizeStageToPitch();
    this.applyCamera();
    requestAnimationFrame(() => {
      this._sizeStageToPitch();
      this.applyCamera();
      this.renderTokens();
      this.renderDrawings && this.renderDrawings();
    });
    this.renderTokens();
    this.renderDrawings();
  },

  _sizeStageToPitch() {
    try {
      const c = document.getElementById('fieldContainer');
      const stage = document.getElementById('fieldStage');
      if (!c || !stage) return;
      const cw = Math.max(1, c.clientWidth || 1);
      const ch = Math.max(1, c.clientHeight || 1);
      // Official pitch ratio 68m × 105m → width/height
      const AR = 68 / 105;
      let w, h;
      if (cw / ch > AR) {
        h = ch;
        w = h * AR;
      } else {
        w = cw;
        h = w / AR;
      }
      w = Math.max(120, Math.round(w));
      h = Math.max(180, Math.round(h));
      // Inline !important-equivalent: clear conflicting CSS inset/100%
      stage.style.cssText = [
        'position:absolute',
        'width:' + w + 'px',
        'height:' + h + 'px',
        'left:' + Math.round((cw - w) / 2) + 'px',
        'top:' + Math.round((ch - h) / 2) + 'px',
        'right:auto',
        'bottom:auto',
        'inset:auto',
        'max-width:none',
        'max-height:none',
        'margin:0',
        'box-sizing:border-box',
        'aspect-ratio:68/105',
        'overflow:visible',
        'transform-origin:50% 50%'
      ].join(';');
      // SVG must fill stage exactly (no letterbox) so % chips == markings
      const svg = document.getElementById('fieldSvg');
      const draw = document.getElementById('drawSvg');
      [svg, draw].forEach(el => {
        if (!el) return;
        el.setAttribute('preserveAspectRatio', 'none');
        el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      });
      const layer = document.getElementById('playersLayer');
      if (layer) {
        layer.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none';
      }
      this._stageW = w;
      this._stageH = h;
    } catch (_) {}
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
    Toast.show(typeof t==='function'?t('toast_undo'):'↩ Скасовано');
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
    Toast.show(typeof t==='function'?t('toast_redo'):'↪ Повторено');
  },

  /* ── FULLSCREEN / BOARD-ONLY MODE ── */
  /** Повний екран: CSS board-only + documentElement FS (не #v-board — інакше UI «вмирає») */
  enterFullscreen() {
    this.isBoardOnly = true;
    document.body.classList.add('board-fs-nav', 'board-only-mode', 'mode-board-focus', 'board-workspace');
    try {
      if (typeof TelegramManager !== 'undefined' && TelegramManager.isTelegram) {
        TelegramManager.requestFullscreen();
        TelegramManager.lockLandscape();
      }
    } catch (_) {}
    // Тільки documentElement — щоб toolbar/кнопки лишались у тому ж FS-дереві
    try {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req && !document.fullscreenElement) req.call(el);
    } catch (_) {}
    setTimeout(() => {
      try {
        this.renderToolbar && this.renderToolbar();
        this.fitField && this.fitField();
        this.render && this.render();
      } catch (_) {}
    }, 100);
    try { Toast.show(typeof t==='function'?t('toast_fs'):'Повний екран · ⛶ або ✕ для виходу', 'ok'); } catch (_) {}
  },

  exitFullscreen() {
    this.isBoardOnly = false;
    // Повне зняття FS-класів — інакше main лишається fixed і UI «мертвий»
    document.body.classList.remove('board-fs-nav', 'board-only-mode');
    // mode-board-focus лишаємо, якщо користувач досі на view board
    try {
      const view = (typeof Store !== 'undefined' && Store.get().ui.view) || '';
      if (view !== 'board') {
        document.body.classList.remove('mode-board-focus', 'board-workspace', 'present-mode');
      }
    } catch (_) {
      document.body.classList.remove('mode-board-focus', 'board-workspace', 'present-mode');
    }
    try {
      if (typeof TelegramManager !== 'undefined') {
        TelegramManager.exitFullscreen();
        TelegramManager.unlockOrientation();
      }
    } catch (_) {}
    if (document.fullscreenElement) {
      const ex = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (ex) try { ex.call(document); } catch (_) {}
    }
    setTimeout(() => {
      try { this.renderToolbar && this.renderToolbar(); this.render && this.render(); } catch (_) {}
    }, 80);
  },

  toggleFullscreen() {
    if (this.isBoardOnly) this.exitFullscreen();
    else this.enterFullscreen();
  },

  /** Вихід з режиму дошки (CSS). Native fullscreen додатку НЕ чіпаємо. */
  leaveBoardMode() {
    this.isBoardOnly = false;
    this.closeToolsTray(true);
    document.body.classList.remove(
      'board-fs-nav', 'board-only-mode', 'mode-board-focus',
      'board-workspace', 'present-mode', 'bw-props', 'bw-tools-collapsed', 'bw-nav-hide',
      'tools-tray-open', 'bench-collapsed'
    );
    // document.fullscreenElement і Telegram fullscreen лишаються як були
  },

  /** Закрити лоток інструментів (і прибрати portal з body) */
  closeToolsTray(skipRender) {
    try {
      const ab = Store.get() && Store.get().activeBoard;
      if (ab) {
        ab.toolsTrayOpen = false;
        ab.paletteOpen = false;
      }
      document.body.classList.remove('tools-tray-open');
      const tray = document.getElementById('btbToolsTray');
      if (tray) {
        tray.classList.remove('open');
        tray.setAttribute('aria-hidden', 'true');
        // повернути в bottom toolbar якщо був portal
        const bottom = document.getElementById('boardToolbarBottom');
        if (bottom && tray.parentElement === document.body) {
          bottom.appendChild(tray);
        }
      }
      if (!skipRender) {
        try { this.renderToolbar && this.renderToolbar(); } catch (_) {}
      }
    } catch (_) {}
  },

  toggleBenchCollapsed() {
    const collapsed = document.body.classList.toggle('bench-collapsed');
    try {
      const ab = Store.get().activeBoard;
      if (ab) ab.benchCollapsed = collapsed;
    } catch (_) {}
    try {
      this._sizeStageToPitch && this._sizeStageToPitch();
      this.applyCamera && this.applyCamera();
      this.renderTokens && this.renderTokens();
    } catch (_) {}
    return collapsed;
  },


  /** Стрілки/паси/рухи — hit-test (світ 0..1) */
  PATH_TYPES: ['arrow', 'arrowDash', 'pass', 'run', 'dribble', 'press', 'shot'],
  hitTestArrow(wx, wy, tol) {
    tol = tol == null ? 0.028 : tol;
    const s = Store.get();
    let best = null, bestD = tol;
    (s.activeBoard.objects || []).forEach(o => {
      if (!this.PATH_TYPES.includes(o.type) || o.x2 == null) return;
      // відстань від точки до відрізка
      const x1 = o.x, y1 = o.y, x2 = o.x2, y2 = o.y2;
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy || 1e-8;
      let t = ((wx - x1) * dx + (wy - y1) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = x1 + t * dx, py = y1 + t * dy;
      const d = Math.hypot(wx - px, wy - py);
      if (d < bestD) { bestD = d; best = { obj: o, t, d }; }
    });
    return best;
  },
  hitTestArrowHandle(wx, wy, o, tol) {
    tol = tol == null ? 0.035 : tol;
    if (!o || o.x2 == null) return null;
    if (Math.hypot(wx - o.x, wy - o.y) < tol) return 'start';
    if (Math.hypot(wx - o.x2, wy - o.y2) < tol) return 'end';
    return null;
  },

  /* ── POINTER DOWN ── */
  onPointerDown(e) {
    // Будь-яка робота на полі ховає лоток інструментів
    try {
      const ab = Store.get() && Store.get().activeBoard;
      if (ab && ab.toolsTrayOpen) {
        this.closeToolsTray(true);
        // оновити іконку ⊕ без повного rebuild якщо можливо
        const more = document.querySelector('#boardToolbarBottom .tb-more');
        if (more) {
          more.classList.remove('on');
          more.setAttribute('aria-expanded', 'false');
          const ic = more.querySelector('.tb-more-icon');
          if (ic) ic.textContent = '⊕';
        }
      }
    } catch (_) {}
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

    // Тап по полю після вибору запасного → вивести на позицію
    if (this.pendingFromBenchId && !target) {
      this.promoteFromBench(this.pendingFromBenchId, world.x, world.y);
      return;
    }

    // Tool actions
    if (tool === 'player' || tool === 'opponent') {
      const pp = this.clampWorld(world.x, world.y);
      if (tool === 'opponent') {
        const num = s.activeBoard.objects.filter(o => o.type === 'opponent').length + 1;
        const oppCol = s.activeBoard.drawColor || undefined;
        s.activeBoard.objects.push({
          id: uid(), type: 'opponent',
          x: pp.x, y: pp.y, number: num, label: '',
          team: 'opp', playerId: null,
          chipColor: oppCol, color: oppCol,
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

    const invTools = ['cone','mannequin','wall','pole','ladder','minigoal','hoop','flag','bib','chip','chipLarge','markSquare','markDot'];
    if (invTools.includes(tool)) {
      const ep = this.clampWorld(world.x, world.y);
      const col = s.activeBoard.drawColor || undefined;
      const obj = {
        id: uid(), type: tool, x: ep.x, y: ep.y,
        rotation: 0, locked: false, visible: true
      };
      if (col) { obj.color = col; obj.fill = col; }
      // markSquare: default small square footprint
      if (tool === 'markSquare') { obj.w = 0.04; obj.h = 0.04; }
      s.activeBoard.objects.push(obj);
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

    // Select: спочатку стрілки (переміщення / кінці), інакше зняти вибір
    if (tool === 'select') {
      const hit = this.hitTestArrow(world.x, world.y);
      if (hit && hit.obj) {
        const handle = this.hitTestArrowHandle(world.x, world.y, hit.obj);
        s.activeBoard.selectedId = hit.obj.id;
        this.dragObj = hit.obj;
        this._arrowEdit = handle || 'move';
        this._arrowGrab = { x: world.x, y: world.y, ox: hit.obj.x, oy: hit.obj.y, ox2: hit.obj.x2, oy2: hit.obj.y2 };
        this.activePointerId = e.pointerId;
        try {
          const c = document.getElementById('fieldContainer');
          c.setPointerCapture(e.pointerId);
        } catch (_) {}
        this.renderTokens();
        this.renderDrawings();
        return;
      }
      s.activeBoard.selectedId = null;
      this._arrowEdit = null;
      this.renderTokens();
      this.renderDrawings();
    }
  },

  /* ── POINTER MOVE — ZERO LAG path ── */
  onPointerMove(e) {
    this._lastPtrTs = Date.now();
    const interacting = this.dragObj || this.panStart || this.drawing || this.pointers.size >= 2 || this.benchDragId;
    if (interacting) {
      try { e.preventDefault(); } catch (_) {}
    }
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch zoom + two-finger pan
    if (this.pointers.size >= 2) {
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.lastPinchDist > 8) {
        const scale = dist / this.lastPinchDist;
        if (Number.isFinite(scale) && scale > 0.5 && scale < 2) {
          this.camera.zoom = clamp(this.camera.zoom * scale, 0.5, 4);
        }
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
      this.clampPan();
      this.applyCamera();
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
      // Редагування стрілки: переміщення / кінці (довжина + кут)
      if (this._arrowEdit && this.PATH_TYPES.includes(this.dragObj.type) && this.dragObj.x2 != null) {
        const g = this._arrowGrab || {};
        if (this._arrowEdit === 'start') {
          const p = this.clampWorld(world.x, world.y);
          this.dragObj.x = p.x; this.dragObj.y = p.y;
        } else if (this._arrowEdit === 'end') {
          const p = this.clampWorld(world.x, world.y);
          this.dragObj.x2 = p.x; this.dragObj.y2 = p.y;
        } else {
          // move whole arrow
          const dx = world.x - (g.x || world.x);
          const dy = world.y - (g.y || world.y);
          const p1 = this.clampWorld((g.ox || 0) + dx, (g.oy || 0) + dy);
          const p2 = this.clampWorld((g.ox2 || 0) + dx, (g.oy2 || 0) + dy);
          this.dragObj.x = p1.x; this.dragObj.y = p1.y;
          this.dragObj.x2 = p2.x; this.dragObj.y2 = p2.y;
        }
        this.renderDrawings();
        return;
      }
      const pos = this.clampWorld(world.x - this.dragOffset.x, world.y - this.dragOffset.y);
      this.dragObj.x = pos.x;
      this.dragObj.y = pos.y;
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
    try {
      if (e && e.pointerId != null) this.pointers.delete(e.pointerId);
    } catch (_) {}
    // Захист від «мертвих» pointerId у Map / зависання zoom-індикатора
    if (this.pointers.size > 2 || (this.pointers.size && !this.dragObj && !this.panStart && !this.drawing)) {
      this.pointers.clear();
      this.lastPinchDist = 0;
    }
    // Safety: якщо pointerup без активного жесту — повний скид
    if (!this.dragObj && !this.panStart && !this.drawing && !this.benchDragId) {
      this.lastPinchDist = 0;
      if (this.pointers.size === 0) {
        try { this.updateZoomIndicator && this.updateZoomIndicator(); } catch (_) {}
      }
    }
    if (this.pointers.size < 2) {
      this.lastPinchDist = 0;
      // panStart для двопальцевого pan скидаємо; однопальцевий pan — нижче
      if (!this.panStart || this.panStart.mx != null) this.panStart = null;
    }

    // Commit drag
    if (this.dragObj) {
      const dragged = this.dragObj;
      const wasArrow = this._arrowEdit && this.PATH_TYPES.includes(dragged.type);
      if (wasArrow) {
        this._arrowEdit = null;
        this._arrowGrab = null;
        this.pushHistory();
        this.renderDrawings();
      }
      const el = document.querySelector('[data-id="' + dragged.id + '"]');
      if (el) {
        el.classList.remove('dragging');
        try { if (e && e.pointerId != null) el.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      // Якщо відпустили над панеллю ЗАПАС → на лавку (вільний перенос)
      let demoted = false;
      try {
        const panel = document.getElementById('benchPanel');
        const under = (e && e.clientX != null) ? document.elementFromPoint(e.clientX, e.clientY) : null;
        if (panel && under && (panel === under || panel.contains(under))) {
          demoted = true;
        }
      } catch (_) {}
      this.dragObj = null;
      this.activePointerId = null;
      if (demoted) {
        this.demoteToBench(dragged.id);
        return;
      }
      this.pushHistory();
      try { StorageManager.save(); } catch (_) {}
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
    this.clampPan();
    this.applyCamera();
    this.renderTokens();
    this.renderDrawings();
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
    Modal.confirm((typeof t==='function'?t('confirm_clear_board'):'Очистити дошку?'), () => {
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
      const grp = p.group === 'reserve' ? ' · Резерв' : '';
      return `<button type="button" class="btn btn-s roster-pick" style="width:100%;margin:4px 0;text-align:left;min-height:44px"
        data-pick-player="${p.id}">
        <strong>#${p.number}</strong> ${sanitize(p.firstName)} ${sanitize(p.lastName)}${st}${grp}
        <span style="float:right;color:var(--muted);font-size:12px">${sanitize(p.position)} · ${r}%</span>
      </button>`;
    }).join('');
    Modal.open(
      'Склад МЕТАЛІСТ ШТУТГАРТ',
      `<p class="note-sm" style="margin-bottom:8px">Оберіть гравця на поле · або відправте всіх вільних на лавку</p>
       <button type="button" class="btn btn-p" id="rosterAllToBenchBtn" style="width:100%;margin-bottom:10px;min-height:44px">
         ⬇ Усіх зі списку на лавку (${available.length})
       </button>
       <div style="max-height:45vh;overflow:auto">${list}</div>`,
      [{ label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' }]
    );
    const self = this;
    setTimeout(() => {
      document.querySelectorAll('[data-pick-player]').forEach(btn => {
        btn.addEventListener('click', () => {
          self.placeRosterPlayer(btn.getAttribute('data-pick-player'), x, y);
          Modal.close();
        });
      });
      const allBtn = document.getElementById('rosterAllToBenchBtn');
      if (allBtn) {
        allBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const n = self.sendAvailableToBench();
          Modal.close();
          if (n > 0) Toast.show(n + ' гравців на лавці', 'ok');
          else Toast.show('Немає вільних гравців', 'warn');
        });
      }
    }, 30);
  },

  /** Лише ті, кого ще немає на полі / на лавці — додати на лавку */
  sendAvailableToBench() {
    const s = Store.get();
    if (!s.activeBoard) return 0;
    if (!Array.isArray(s.activeBoard.objects)) s.activeBoard.objects = [];
    const used = new Set(
      (s.activeBoard.objects || [])
        .filter(o => o.type === 'player' && o.playerId)
        .map(o => o.playerId)
    );
    const available = (s.players || []).filter(p => !used.has(p.id));
    if (!available.length) return 0;
    const chipColor = s.activeBoard.drawColor || null;
    available.forEach((roster) => {
      const isGk = String(roster.position || '').toUpperCase() === 'GK';
      const col = isGk ? this.GK_CHIP_COLOR : (chipColor || undefined);
      s.activeBoard.objects.push({
        id: uid(), type: 'player', x: 0, y: 0,
        number: roster.number,
        label: roster.lastName || '',
        team: 'own',
        playerId: roster.id,
        readiness: roster.readiness != null ? roster.readiness : (roster.condition != null ? roster.condition : 80),
        load: roster.load != null ? roster.load : 0,
        position: roster.position || null,
        status: roster.status || null,
        isCaptain: !!roster.isCaptain,
        chipColor: col,
        color: col,
        onBench: true,
        rotation: 0, locked: false, visible: true
      });
    });
    this.pushHistory();
    try { StorageManager.save(); } catch (_) {}
    this.render();
    try { if (this.renderBenchPanel) this.renderBenchPanel(); } catch (_) {}
    try { TelegramManager.haptic('medium'); } catch (_) {}
    return available.length;
  },

  placeRosterPlayer(playerId, x, y) {
    const s = Store.get();
    const p = (s.players || []).find(pl => pl.id === playerId);
    if (!p) return;
    const pos = this.clampWorld(x, y);
    const readiness = p.readiness != null ? p.readiness : (p.condition != null ? p.condition : 80);
    const isGk = String(p.position || '').toUpperCase() === 'GK';
    // Воротар: жовтий завжди; інші — з палітри (якщо обрана)
    const chipColor = isGk ? this.GK_CHIP_COLOR : (s.activeBoard.drawColor || null);
    // Якщо ставлять воротаря «в напад» (верх поля) — м'яко підтягнути до зони воріт
    let wx = pos.x, wy = pos.y;
    if (isGk && wy < 0.75) {
      wy = 0.92;
      wx = 0.5;
    }
    s.activeBoard.objects.push({
      id: uid(), type: 'player',
      x: wx, y: wy,
      number: p.number,
      label: p.lastName || '',
      team: 'own',
      playerId: p.id,
      readiness,
      load: p.load != null ? p.load : 0,
      position: p.position || (isGk ? 'GK' : null),
      status: p.status || null,
      isCaptain: !!p.isCaptain,
      chipColor: chipColor || undefined,
      color: chipColor || undefined,
      onBench: false,
      rotation: 0, locked: false, visible: true
    });
    this.pushHistory();
    this.render();
    try { TelegramManager.haptic('medium'); } catch (_) {}
    Toast.show('#' + p.number + ' ' + p.firstName + ' · ' + readiness + '%' + (chipColor ? ' · колір' : ''), 'ok');
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
    // Своя команда: 11 основи на поле; резерв / травма / відновлення — на лавку
    s.activeBoard.objects = s.activeBoard.objects.filter(o => !(o.type === 'player' && o.team !== 'opp'));
    const chipColor = s.activeBoard.drawColor || null;
    const usedIds = new Set();
    const rosterAll = (s.players || []).slice();
    const isInj = (pl) => pl && (pl.status === 'injured');
    const isRehab = (pl) => pl && (pl.status === 'rehab' || pl.status === 'recovery');
    const isRes = (pl) => pl && pl.group === 'reserve';
    const fieldPool = rosterAll.filter(pl => !isRes(pl) && !isInj(pl) && !isRehab(pl));
    const roleOf = (pl) => {
      const pos = String((pl && pl.position) || '').toUpperCase();
      if (pos === 'GK') return 'GK';
      if (['CB','LB','RB','LCB','RCB','LWB','RWB','WB','DEF'].includes(pos)) return 'DEF';
      if (['CM','CDM','CAM','LM','RM','DM','AM','MID'].includes(pos)) return 'MID';
      if (['ST','CF','LW','RW','SS','ATT'].includes(pos)) return 'ATT';
      return 'MID';
    };
    const slotRole = (x, y) => {
      if (y >= 0.88) return 'GK';
      if (y >= 0.68) return 'DEF';
      if (y >= 0.38) return 'MID';
      return 'ATT';
    };
    const pickRoster = (num, role) => {
      // 1) номер + роль
      let r = fieldPool.find(pl => pl.number === num && roleOf(pl) === role && !usedIds.has(pl.id));
      if (r) return r;
      // 2) роль
      r = fieldPool.find(pl => roleOf(pl) === role && !usedIds.has(pl.id));
      if (r) return r;
      // 3) номер
      r = fieldPool.find(pl => pl.number === num && !usedIds.has(pl.id));
      if (r) return r;
      // 4) будь-хто
      return fieldPool.find(pl => !usedIds.has(pl.id)) || null;
    };
    scheme.slice(0, 11).forEach(([num, x, y]) => {
      const p = this.clampWorld(x, y);
      const role = slotRole(p.x, p.y);
      const roster = pickRoster(num, role);
      if (roster) usedIds.add(roster.id);
      const isGk = role === 'GK' || (roster && roleOf(roster) === 'GK');
      const col = isGk ? this.GK_CHIP_COLOR : (chipColor || undefined);
      s.activeBoard.objects.push({
        id: uid(), type: 'player', x: p.x, y: p.y,
        number: roster ? roster.number : num,
        label: roster ? (roster.lastName || '') : '',
        team: 'own',
        playerId: roster ? roster.id : null,
        readiness: roster ? (roster.readiness != null ? roster.readiness : roster.condition) : 80,
        load: roster && roster.load != null ? roster.load : 0,
        position: roster ? roster.position : (isGk ? 'GK' : null),
        status: roster ? roster.status : null,
        isCaptain: roster ? !!roster.isCaptain : false,
        chipColor: col,
        color: col,
        onBench: false,
        rotation: 0, locked: false, visible: true
      });
    });
    const benchList = rosterAll.filter(pl => !usedIds.has(pl.id));
    benchList.sort((a, b) => {
      const rank = (pl) => isInj(pl) ? 3 : isRehab(pl) ? 2 : isRes(pl) ? 1 : 0;
      return rank(a) - rank(b) || (a.number || 0) - (b.number || 0);
    });
    benchList.forEach((roster) => {
      s.activeBoard.objects.push({
        id: uid(), type: 'player', x: 0, y: 0,
        number: roster.number,
        label: roster.lastName || '',
        team: 'own',
        playerId: roster.id,
        readiness: roster.readiness != null ? roster.readiness : (roster.condition != null ? roster.condition : 80),
        load: roster.load != null ? roster.load : 0,
        position: roster.position || null,
        status: roster.status || null,
        isCaptain: !!roster.isCaptain,
        chipColor: chipColor || undefined,
        color: chipColor || undefined,
        onBench: true,
        rotation: 0, locked: false, visible: true
      });
    });
    this.pushHistory();
    this.render();
    const nInj = benchList.filter(isInj).length;
    const nReh = benchList.filter(isRehab).length;
    const nRes = benchList.filter(isRes).length;
    Toast.show((typeof t==='function'?t('starters_bench_toast'):'Основа')+' 11 · '+(typeof t==='function'?t('bench_label'):'Лавка')+' ' + benchList.length + (nRes ? ' · рез. ' + nRes : '') + (nInj + nReh ? ' · мед. ' + (nInj + nReh) : ''), 'ok');
  },

  saveBoard() {
    const ctx = (Store.get().ui && Store.get().ui.boardContext) || null;
    Modal.prompt('Назва схеми / заготовки', 'Схема ' + new Date().toLocaleString('uk-UA'), name => {
      if (!name) return;
      const s = Store.get();
      const snap = {
        id: uid(), name,
        objects: JSON.parse(JSON.stringify((s.activeBoard && s.activeBoard.objects) || [])),
        camera: Object.assign({}, this.camera),
        createdAt: new Date().toISOString()
      };
      s.boards = s.boards || [];
      s.boards.push(snap);
      if (ctx && ctx.type === 'training' && ctx.id) {
        const tr = (s.trainings || []).find(x => x.id === ctx.id);
        if (tr) { tr.board = { objects: JSON.parse(JSON.stringify(snap.objects)) }; tr.boardId = snap.id; }
      }
      if (ctx && ctx.type === 'diary' && ctx.id) {
        const d = (s.diary || []).find(x => x.id === ctx.id);
        if (d) { d.board = { objects: JSON.parse(JSON.stringify(snap.objects)) }; d.boardId = snap.id; }
      }
      StorageManager.save();
      Toast.show('Збережено' + (ctx ? ' + прикріплено' : ''), 'ok');
    });
  },

  loadBoard(id) {
    const s = Store.get();
    const b = s.boards.find(x => x.id === id);
    if (!b) return;
    s.activeBoard.objects = JSON.parse(JSON.stringify(b.objects));
    if (b.camera) this.camera = Object.assign({}, b.camera);
    this._migratedLeft = false;
    this.migrateLeftEdgeToBench();
    this.pushHistory();
    this.render();
    try { Toast.show('Сцену завантажено в activeBoard. Відкрийте дошку через логотип.', 'ok'); } catch (_) {}
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
    return ['player', 'opponent', 'ball', 'cone', 'mannequin', 'wall', 'pole', 'ladder', 'minigoal', 'hoop', 'flag', 'bib', 'chip', 'chipLarge', 'markSquare', 'markDot'];
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
    if (svg) { try { svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); } catch (_) {} }
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
      /* Watermark */
      `<text class="pitch-watermark" x="${W / 2}" y="${H / 2 - 36}" text-anchor="middle" dominant-baseline="auto" ` +
      `fill="rgba(255,255,255,0.15)" font-family="system-ui,-apple-system,Segoe UI,sans-serif" ` +
      `font-weight="700" font-size="38" letter-spacing="2" pointer-events="none" style="user-select:none">Metalist Stuttgart</text>` +
      '';
  },

  /** Розмір фішки = % ширини поля → масштабується разом із розміткою. */
  tokenMetrics() {
    const stage = document.getElementById('fieldStage');
    // Prefer measured stage width; on iOS first frame may be 0 → fallback container
    let w = this._stageW || (stage && stage.clientWidth) || 0;
    if (w < 80) {
      const c = document.getElementById('fieldContainer');
      w = (c && c.clientWidth) || 320;
    }
    // ~5.2% ширини поля; clamp tighter for phones so chips stay readable but scale down
    const player = Math.max(16, Math.min(42, Math.round(w * 0.052)));
    const ball = Math.max(8, Math.round(player * 0.40));
    const inv = Math.max(10, Math.round(player * 0.38));
    const cone = Math.round(inv * 1.05);
    const equip = inv;
    const chip = Math.round(inv * 0.95);
    const chipLg = Math.round(inv * 1.15);
    const mark = Math.round(inv * 0.55);
    const markSq = Math.round(inv * 0.95);
    const goal = Math.round(player * 1.35);
    const font = Math.max(8, Math.min(14, Math.round(player * 0.38)));
    return {
      player, ball, cone, equip, chip, chipLg, mark, markSq, inv, goal,
      font,
      ringPad: Math.max(4, Math.round(player * 0.18))
    };
  },


  /** Лавка: UI + інтеграція з полем (drag / тап-постав) */
  _bindBenchPanelOnce() {
    if (this._benchBound) return;
    this._benchBound = true;
    const panel = document.getElementById('benchPanel');
    if (!panel) return;
    // Delegation: старт drag з лавки
    panel.addEventListener('pointerdown', e => {
      const chip = e.target.closest('.bench-chip');
      if (!chip || !chip.dataset.id) return;
      if (e.button === 2) return;
      e.preventDefault();
      e.stopPropagation();
      this.startBenchDrag(chip.dataset.id, e);
    }, { passive: false });
    // Кнопка «на поле» / double intent
    panel.addEventListener('click', e => {
      const btn = e.target.closest('[data-bench-to-field]');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        this.armBenchPlace(btn.getAttribute('data-bench-to-field'));
        return;
      }
    });
  },

  /** Вибрати запасного: наступний тап по полю ставить його */
  armBenchPlace(objId) {
    this.pendingFromBenchId = objId;
    Store.get().activeBoard.selectedId = objId;
    Store.get().activeBoard.tool = 'select';
    try { Toast.show('Тапніть по полю, щоб вивести гравця', 'ok'); } catch (_) {}
    this.renderBenchPanel();
    try { TelegramManager.haptic('light'); } catch (_) {}
  },

  startBenchDrag(objId, e) {
    const s = Store.get();
    const obj = (s.activeBoard.objects || []).find(o => o.id === objId && o.onBench);
    if (!obj) return;
    this.benchDragId = objId;
    this.pendingFromBenchId = null;
    s.activeBoard.selectedId = objId;
    // Ghost
    this._removeBenchGhost();
    const ghost = document.createElement('div');
    ghost.className = 'bench-ghost';
    ghost.textContent = obj.number || '';
    if (obj.chipColor || obj.color) ghost.style.background = obj.chipColor || obj.color;
    document.body.appendChild(ghost);
    this.benchGhost = ghost;
    this._moveBenchGhost(e.clientX, e.clientY);
    try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (_) {}
    const move = (ev) => {
      if (!this.benchDragId) return;
      ev.preventDefault();
      this._moveBenchGhost(ev.clientX, ev.clientY);
    };
    const up = (ev) => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      this.finishBenchDrag(ev.clientX, ev.clientY);
    };
    document.addEventListener('pointermove', move, { capture: true, passive: false });
    document.addEventListener('pointerup', up, { capture: true });
    document.addEventListener('pointercancel', up, { capture: true });
    try { TelegramManager.haptic('medium'); } catch (_) {}
  },

  _moveBenchGhost(cx, cy) {
    if (!this.benchGhost) return;
    this.benchGhost.style.left = cx + 'px';
    this.benchGhost.style.top = cy + 'px';
  },

  _removeBenchGhost() {
    if (this.benchGhost && this.benchGhost.parentNode) this.benchGhost.parentNode.removeChild(this.benchGhost);
    this.benchGhost = null;
  },

  finishBenchDrag(cx, cy) {
    const id = this.benchDragId;
    this.benchDragId = null;
    this._removeBenchGhost();
    if (!id) return;
    const field = document.getElementById('fieldContainer');
    const panel = document.getElementById('benchPanel');
    const el = document.elementFromPoint(cx, cy);
    // Drop на поле?
    if (field && (field === el || field.contains(el))) {
      const world = this.screenToWorld(cx, cy);
      this.promoteFromBench(id, world.x, world.y);
      return;
    }
    // Залишився на лавці — лише select
    if (panel && (panel === el || panel.contains(el))) {
      this.armBenchPlace(id);
      return;
    }
  },

  /** Запасний → поле */
  promoteFromBench(objId, wx, wy) {
    const s = Store.get();
    const obj = (s.activeBoard.objects || []).find(o => o.id === objId);
    if (!obj) return;
    const pos = this.clampWorld(wx, wy);
    obj.onBench = false;
    obj.x = pos.x;
    obj.y = pos.y;
    // колір з палітри, якщо ще не заданий
    if (!obj.chipColor && s.activeBoard.drawColor) {
      obj.chipColor = s.activeBoard.drawColor;
      obj.color = s.activeBoard.drawColor;
    }
    s.activeBoard.selectedId = objId;
    this.pendingFromBenchId = null;
    this.pushHistory();
    try { StorageManager.save(); } catch (_) {}
    this.render();
    try { TelegramManager.haptic('medium'); } catch (_) {}
    try { Toast.show('#' + (obj.number || '') + ' ' + (obj.label || '') + ' на полі', 'ok'); } catch (_) {}
  },

  /** Поле → лавка */
  demoteToBench(objId) {
    const s = Store.get();
    const obj = (s.activeBoard.objects || []).find(o => o.id === objId);
    if (!obj || obj.type === 'opponent' || obj.type === 'ball') return;
    if (obj.type !== 'player' && obj.team !== 'own') return;
    obj.onBench = true;
    obj.x = 0;
    obj.y = 0;
    if (s.activeBoard.selectedId === objId) s.activeBoard.selectedId = null;
    this.pushHistory();
    try { StorageManager.save(); } catch (_) {}
    this.render();
    try { TelegramManager.haptic('light'); } catch (_) {}
    try { Toast.show('#' + (obj.number || '') + ' на лавці', 'ok'); } catch (_) {}
  },

  renderBenchPanel() {
    const list = document.getElementById('benchList');
    const panel = document.getElementById('benchPanel');
    if (!list || !panel) return;
    this._bindBenchPanelOnce();
    const s = Store.get();
    const bench = (s.activeBoard.objects || []).filter(o => o.onBench && (o.type === 'player' || o.team === 'own'));
    const pending = this.pendingFromBenchId;
    if (!bench.length) {
      list.innerHTML = '<div class="bench-empty">'+(typeof t==='function'?t('bench_empty'):'Лавка порожня')+'<br><span class="bench-hint">'+(typeof t==='function'?t('bench_hint'):'Перетягніть фішку з поля сюди')+'</span></div>';
      return;
    }
    const chipHtml = (o) => {
      const pl = o.playerId ? (s.players || []).find(p => p.id === o.playerId) : null;
      const readiness = o.readiness != null ? o.readiness : (pl && (pl.readiness != null ? pl.readiness : pl.condition)) || 70;
      const loadVal = o.load != null ? o.load : (pl && pl.load != null ? pl.load : null);
      const ringC = readiness >= 80 ? '#2ecc71' : readiness >= 50 ? '#f1c40f' : '#e74c3c';
      const loadPct = loadVal != null ? Math.max(0, Math.min(1, (+loadVal) / 10)) : (readiness / 100);
      const loadCol = loadVal != null
        ? (loadPct >= 0.7 ? '#e74c3c' : loadPct >= 0.4 ? '#f1c40f' : '#3498db')
        : ringC;
      const circ = 2 * Math.PI * 15;
      const bg = o.chipColor || o.color || '';
      const st = o.status || (pl && pl.status) || '';
      const grp = (pl && pl.group) || '';
      let tag = '';
      if (st === 'injured') tag = '<span class="bench-tag inj">✚</span>';
      else if (st === 'rehab' || st === 'recovery') tag = '<span class="bench-tag reh">↻</span>';
      else if (grp === 'reserve') tag = '<span class="bench-tag res">R</span>';
      const bgStyle = bg ? 'background:' + bg : '';
      const on = (pending === o.id || s.activeBoard.selectedId === o.id) ? ' on' : '';
      const ringSvg = '<svg class="bench-ring" viewBox="0 0 40 40" aria-hidden="true">' +
        '<circle cx="20" cy="20" r="15" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="3.5"/>' +
        '<circle cx="20" cy="20" r="15" fill="none" stroke="' + loadCol + '" stroke-width="3.5" stroke-dasharray="' +
        (loadPct * circ) + ' ' + circ + '" stroke-linecap="round" transform="rotate(-90 20 20)"/></svg>';
      return '<div class="bench-chip' + on + '" data-id="' + o.id + '" title="Перетягніть на поле · готовність ' + Math.round(readiness) + '%">' +
        '<div class="bench-avatar-wrap">' + ringSvg +
        '<div class="bench-avatar" style="' + bgStyle + '"><span class="bench-num">' + (o.number || '') + '</span></div></div>' +
        '<div class="bench-meta"><span class="bench-pos">' + (o.position || (pl && pl.position) || '') + '</span> ' +
        '<span class="bench-name">' + sanitize(o.label || '') + '</span>' + tag + '</div></div>';
    };
    const stOf = (o) => o.status || ((s.players || []).find(p => p.id === o.playerId) || {}).status || '';
    const grOf = (o) => ((s.players || []).find(p => p.id === o.playerId) || {}).group || '';
    const main = bench.filter(o => stOf(o) !== 'injured' && stOf(o) !== 'rehab' && stOf(o) !== 'recovery' && grOf(o) !== 'reserve');
    const res = bench.filter(o => grOf(o) === 'reserve' && stOf(o) !== 'injured' && stOf(o) !== 'rehab' && stOf(o) !== 'recovery');
    const reh = bench.filter(o => stOf(o) === 'rehab' || stOf(o) === 'recovery');
    const inj = bench.filter(o => stOf(o) === 'injured');
    let html = '';
    if (main.length) html += '<div class="bench-sec">Запас</div>' + main.map(chipHtml).join('');
    if (res.length) html += '<div class="bench-sec">Резерв</div>' + res.map(chipHtml).join('');
    if (reh.length) html += '<div class="bench-sec">Відновлення</div>' + reh.map(chipHtml).join('');
    if (inj.length) html += '<div class="bench-sec inj-sec">Травма</div>' + inj.map(chipHtml).join('');
    list.innerHTML = html;
  },


  /** Старі схеми: фішки «стовпчиком» на лівій бровці → лавка */
  migrateLeftEdgeToBench() {
    // Legacy one-shot: тільки якщо явно «стовпчик» майже на бровці (x < 0.02), ≥5 фішок
    if (this._migratedLeft) return;
    const s = Store.get();
    const objs = s.activeBoard.objects || [];
    const lefties = objs.filter(o =>
      (o.type === 'player' || o.team === 'own') && !o.onBench && o.x != null && o.x < 0.02
    );
    if (lefties.length < 5) return;
    lefties.forEach(o => { o.onBench = true; o.x = 0; o.y = 0; });
    this._migratedLeft = true;
  },
  renderTokens() {
    // migrateLeftEdgeToBench — лише при loadBoard, не на кожен кадр (ламає лівий фланг)
    try {
      const objs = (Store.get().activeBoard && Store.get().activeBoard.objects) || [];
      objs.forEach(o => {
        if (!o || o.onBench) return;
        if (o.type === 'player' || o.type === 'opponent' || o.type === 'ball') {
          if (o.x == null || isNaN(o.x)) o.x = 0.5;
          if (o.y == null || isNaN(o.y)) o.y = 0.5;
          o.x = Math.max(0.02, Math.min(0.98, Number(o.x)));
          o.y = Math.max(0.02, Math.min(0.98, Number(o.y)));
        }
      });
    } catch (_) {}
    this.renderBenchPanel();
    try {
      const av = !!(Store.get().activeBoard && Store.get().activeBoard.useAvatars);
      document.body.classList.toggle('board-avatars', av);
    } catch (_) {}
    const layer = document.getElementById('playersLayer');
    if (!layer) return;
    const s = Store.get();
    const m = this.tokenMetrics();
    layer.style.setProperty('--tok', m.player + 'px');
    layer.style.setProperty('--tok-font', m.font + 'px');
    layer.style.setProperty('--ball-sz', m.ball + 'px');
    const equipTypes = ['cone','mannequin','wall','pole','ladder','minigoal','hoop','flag','bib','chip','chipLarge','markSquare','markDot'];
    const objs = s.activeBoard.objects.filter(o =>
      !o.onBench && (o.type === 'player' || o.type === 'opponent' || o.type === 'ball' || equipTypes.includes(o.type))
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
        const col = o.color || o.fill || '#ff6b00';
        const s = m.cone;
        html += `<div class="eq inv-cone" data-id="${o.id}" style="${L};width:${s}px;height:${s * 1.15}px">` +
          `<svg viewBox="0 0 24 28" width="100%" height="100%"><polygon points="12,2 22,26 2,26" fill="${col}" stroke="rgba(0,0,0,.35)" stroke-width="1"/><rect x="3" y="24" width="18" height="3" rx="1" fill="${col}" opacity=".85"/></svg></div>`;
        return;
      }
      if (o.type === 'chip') {
        const col = o.color || o.fill || '#f1c40f';
        const s = m.chip;
        html += `<div class="eq inv-chip" data-id="${o.id}" style="${L};width:${s}px;height:${s}px">` +
          `<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="10" fill="${col}" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/><circle cx="12" cy="12" r="4" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg></div>`;
        return;
      }
      if (o.type === 'chipLarge') {
        const col = o.color || o.fill || '#3498db';
        const s = m.chipLg;
        html += `<div class="eq inv-chip-lg" data-id="${o.id}" style="${L};width:${s}px;height:${s}px">` +
          `<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="11" fill="${col}" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="12" cy="12" r="6" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/></svg></div>`;
        return;
      }
      if (o.type === 'markDot') {
        const col = o.color || o.fill || '#ecf0f1';
        const s = m.mark;
        html += `<div class="eq inv-dot" data-id="${o.id}" style="${L};width:${s}px;height:${s}px;background:${col};border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.4)"></div>`;
        return;
      }
      if (o.type === 'markSquare') {
        const col = o.color || o.fill || '#f1c40f';
        const s = m.markSq;
        html += `<div class="eq inv-sq" data-id="${o.id}" style="${L};width:${s}px;height:${s}px">` +
          `<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="${col}" stroke-width="2.5"/><rect x="7" y="7" width="10" height="10" rx="1" fill="${col}" opacity=".25"/></svg></div>`;
        return;
      }
      if (o.type === 'wall' || o.type === 'mannequin') {
        const col = o.color || o.fill || '#b0b8c0';
        const s = m.equip;
        html += `<div class="eq inv-wall" data-id="${o.id}" style="${L};width:${s * 0.7}px;height:${s * 1.4}px">` +
          `<svg viewBox="0 0 16 28" width="100%" height="100%"><ellipse cx="8" cy="4" rx="4" ry="3.5" fill="${col}"/><rect x="5" y="7" width="6" height="12" rx="1" fill="${col}"/><rect x="3" y="19" width="4" height="8" rx="1" fill="${col}"/><rect x="9" y="19" width="4" height="8" rx="1" fill="${col}"/></svg></div>`;
        return;
      }
      if (o.type === 'pole') {
        const col = o.color || o.fill || '#f39c12';
        const s = m.equip;
        html += `<div class="eq inv-pole" data-id="${o.id}" style="${L};width:${Math.max(2, s * 0.22)}px;height:${s * 1.6}px;background:linear-gradient(180deg,${col},#c0392b);border-radius:1px;box-shadow:0 1px 2px rgba(0,0,0,.4)"></div>`;
        return;
      }
      if (o.type === 'ladder') {
        const col = o.color || '#e74c3c';
        const s = m.equip;
        html += `<div class="eq inv-ladder" data-id="${o.id}" style="${L};width:${s * 1.4}px;height:${s * 0.55}px">` +
          `<svg viewBox="0 0 40 16" width="100%" height="100%"><rect x="1" y="1" width="3" height="14" fill="${col}"/><rect x="36" y="1" width="3" height="14" fill="${col}"/><rect x="1" y="3" width="38" height="2" fill="${col}"/><rect x="1" y="7" width="38" height="2" fill="${col}"/><rect x="1" y="11" width="38" height="2" fill="${col}"/></svg></div>`;
        return;
      }
      if (o.type === 'minigoal') {
        const s = m.goal || (m.equip * 3);
        html += `<div class="eq inv-goal" data-id="${o.id}" style="${L};width:${s}px;height:${s * 0.7}px">` +
          `<svg viewBox="0 0 40 28" width="100%" height="100%"><path d="M4 26 V8 H36 V26" fill="none" stroke="#ecf0f1" stroke-width="2.2"/><path d="M4 8 H36" stroke="#ecf0f1" stroke-width="1.5" opacity=".5"/><line x1="12" y1="8" x2="12" y2="26" stroke="rgba(255,255,255,.25)" stroke-width="1"/><line x1="20" y1="8" x2="20" y2="26" stroke="rgba(255,255,255,.25)" stroke-width="1"/><line x1="28" y1="8" x2="28" y2="26" stroke="rgba(255,255,255,.25)" stroke-width="1"/></svg></div>`;
        return;
      }
      if (o.type === 'hoop') {
        const col = o.color || '#9b59b6';
        const s = m.equip;
        html += `<div class="eq inv-hoop" data-id="${o.id}" style="${L};width:${s}px;height:${s}px">` +
          `<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="9" fill="none" stroke="${col}" stroke-width="2.5"/><circle cx="12" cy="12" r="5" fill="none" stroke="${col}" stroke-width="1" opacity=".5"/></svg></div>`;
        return;
      }
      if (o.type === 'flag') {
        const col = o.color || '#e74c3c';
        const s = m.equip;
        html += `<div class="eq inv-flag" data-id="${o.id}" style="${L};width:${s}px;height:${s * 1.2}px">` +
          `<svg viewBox="0 0 20 28" width="100%" height="100%"><line x1="4" y1="2" x2="4" y2="26" stroke="#ddd" stroke-width="1.5"/><polygon points="4,3 16,8 4,13" fill="${col}"/></svg></div>`;
        return;
      }
      if (o.type === 'bib') {
        const col = o.color || '#2ecc71';
        const s = m.equip;
        html += `<div class="eq inv-bib" data-id="${o.id}" style="${L};width:${s}px;height:${s * 1.1}px">` +
          `<svg viewBox="0 0 24 26" width="100%" height="100%"><path d="M6 4 L10 2 L14 2 L18 4 L20 10 L18 24 L6 24 L4 10 Z" fill="${col}" stroke="rgba(0,0,0,.3)" stroke-width="1"/></svg></div>`;
        return;
      }

      
      const isGk = (() => {
        if (String(o.position || '').toUpperCase() === 'GK') return true;
        if (o.playerId) {
          const pl = Store.get().players.find(p => p.id === o.playerId);
          if (pl && String(pl.position || '').toUpperCase() === 'GK') return true;
        }
        return false;
      })();
      // Воротар ніколи не бере колір з палітри
      if (isGk) {
        o.chipColor = this.GK_CHIP_COLOR;
        o.color = this.GK_CHIP_COLOR;
      }
      const cls = 'pt ' + (o.team === 'opp' ? 'opp' : (isGk ? 'gk' : 'own')) + (sel === o.id ? ' sel' : '');
      let readiness = o.readiness;
      let loadVal = o.load;
      if (o.playerId) {
        const pl = Store.get().players.find(p => p.id === o.playerId);
        if (pl) {
          if (readiness == null) readiness = pl.readiness != null ? pl.readiness : pl.condition;
          if (loadVal == null) loadVal = pl.load;
        }
      }
      if (readiness == null) readiness = 75;
      const ringColor = readiness >= 80 ? '#2ecc71' : readiness >= 50 ? '#f1c40f' : '#e74c3c';
      const loadNum = loadVal != null ? +loadVal : null;
      const ring = readiness != null
        ? `<svg class="pt-ring" viewBox="0 0 36 36" aria-hidden="true" style="width:${m.player + 10}px;height:${m.player + 10}px"><circle cx="18" cy="18" r="16" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="3"/><circle cx="18" cy="18" r="16" fill="none" stroke="${ringColor}" stroke-width="3" stroke-dasharray="${(readiness/100)*100.5} 100.5" stroke-linecap="round" transform="rotate(-90 18 18)"/></svg>`
        : '';
      // Дані зі складу
      let pl = null;
      if (o.playerId) pl = Store.get().players.find(p => p.id === o.playerId);
      const posCode = o.position || (pl && pl.position) || (o.team === 'opp' ? '' : '');
      const status = o.status || (pl && pl.status) || '';
      const isInjured = status === 'injured';
      const isRehab = status === 'rehab' || status === 'recovery';
      const isReserve = status === 'reserve' || (pl && pl.group === 'reserve');
      const isCaptain = !!(o.isCaptain || (pl && pl.isCaptain));
      // Бейджі ТІЛЬКИ зверху фішки (не перекривають ім'я знизу)
      const radialItems = [];
      if (isCaptain) radialItems.push({ cls: 'pt-cap', text: 'C', title: 'Капітан' });
      if (isInjured) radialItems.push({ cls: 'pt-inj', text: '✚', title: 'Травмований' });
      else if (isRehab) radialItems.push({ cls: 'pt-rehab', text: '↻', title: 'Відновлення' });
      else if (isReserve) radialItems.push({ cls: 'pt-res', text: 'R', title: 'Резерв' });
      const rPx = m.player / 2;
      const radiusOffset = rPx + 4;
      // Кути лише у верхній півсфері: -140° … -40°
      const statusBadge = radialItems.map((b, i) => {
        const n = Math.max(radialItems.length, 1);
        const angle = (-140 + (n === 1 ? 50 : (i * (100 / Math.max(n - 1, 1))))) * Math.PI / 180;
        const ox = radiusOffset * Math.cos(angle);
        const oy = radiusOffset * Math.sin(angle);
        return '<span class="pt-badge ' + b.cls + '" title="' + b.title +
          '" style="left:calc(50% + ' + ox.toFixed(1) + 'px);top:calc(50% + ' + oy.toFixed(1) + 'px)">' + b.text + '</span>';
      }).join('');
      // Load — кільце навколо фішки (не цифра)
      const loadBadge = '';
      // Позиція + ім'я одним рядком ПІД фішкою
      const nameText = o.label || '';
      const label = (nameText || posCode)
        ? `<span class="tn">${posCode ? `<span class="tn-pos">${sanitize(posCode)}</span>` : ''}${nameText ? sanitize(nameText) : ''}</span>`
        : '';
      const titleName = (nameText || ('#' + (o.number || ''))) + (posCode ? ' · ' + posCode : '');
      const titleExtra = (readiness != null ? ` · готовність ${readiness}%` : '')
        + (isCaptain ? ' · КАПІТАН' : '')
        + (isInjured ? ' · ТРАВМА' : '')
        + (isRehab ? ' · ВІДНОВЛЕННЯ' : '')
        + (isReserve ? ' · резерв' : '');
      const extraCls = (isInjured ? ' injured' : '') + (isRehab ? ' rehab' : '') + (isReserve ? ' reserve' : '') + (isCaptain ? ' captain' : '');
      const readyAttr = readiness != null ? ` data-ready="${Math.round(readiness)}"` : '';
      // Ідентично лавці: wrap 40px + ring SVG + avatar 28px
      const loadPct = loadNum != null && !isNaN(loadNum)
        ? Math.max(0, Math.min(1, loadNum / 10))
        : Math.max(0, Math.min(1, readiness / 100));
      const loadCol = loadNum != null && !isNaN(loadNum)
        ? (loadPct >= 0.7 ? '#e74c3c' : loadPct >= 0.4 ? '#f1c40f' : '#3498db')
        : ringColor;
      // Ring geometry in viewBox 0..40 — scales with CSS size; track full circle, arc = readiness/load
      const R = 17; // slightly larger so ring sits outside avatar face
      const circ = 2 * Math.PI * R;
      const dash = Math.max(0.01, loadPct) * circ;
      const gap = circ - dash;
      const ringSvg =
        `<svg class="pt-load-ring" viewBox="0 0 40 40" aria-hidden="true">` +
        `<circle cx="20" cy="20" r="${R}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="4"/>` +
        `<circle cx="20" cy="20" r="${R}" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="4" opacity="0.5"/>` +
        `<circle cx="20" cy="20" r="${R}" fill="none" stroke="${loadCol}" stroke-width="4" ` +
        `stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" stroke-linecap="round" ` +
        `transform="rotate(-90 20 20)"/></svg>`;
      let customBg = o.chipColor || o.fill || o.color || null;
      if (isGk) customBg = this.GK_CHIP_COLOR;
      const bgStyle = customBg ? `background:${customBg} !important;` : '';
      // Контейнер 40×40 як bench-avatar-wrap; позиція — центр у % поля
      const useAv = !!(Store.get().activeBoard && Store.get().activeBoard.useAvatars);
      let photoUrl = '';
      if (useAv && o.playerId) {
        try {
          const pl = (Store.get().players || []).find(x => x.id === o.playerId);
          if (pl) {
            photoUrl = pl.photoUrl || pl.telegramPhotoUrl || '';
            if (!photoUrl && typeof Views !== 'undefined' && Views._resolvePlayerAvatar) {
              photoUrl = Views._resolvePlayerAvatar(pl) || '';
            }
          }
        } catch (_) {}
      }
      if (useAv && !photoUrl && o.photoUrl) photoUrl = o.photoUrl;
      const avCls = useAv ? ' pt-avatar-chip' : '';
      // Always show number; photo when available
      const avInner = (useAv && photoUrl)
        ? `<img class="pt-photo" src="${sanitize(photoUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'"/><span class="pt-num">${o.number || ''}</span>`
        : `<span class="pt-num">${o.number || ''}</span>`;
      // Avatar mode: larger hit radius for drag; ring drawn around photo via CSS 72px + SVG r=17
      html += `<div class="${cls}${extraCls} pt-bench-style${avCls}" data-id="${o.id}" data-r="${useAv ? 36 : 14}"${readyAttr} ` +
        `style="left:${pct.left}%;top:${pct.top}%" ` +
        `title="${sanitize(titleName + titleExtra)}">` +
        `<div class="pt-wrap">${ringSvg}<div class="pt-avatar" style="${useAv && photoUrl ? '' : bgStyle}">${avInner}</div></div>` +
        `${statusBadge}${label}</div>`;
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
        // Long-press / right-click must NOT delete — only select.
        // Delete: кнопка 🗑 на панелі інструментів.
        ev.preventDefault();
        ev.stopPropagation();
        try {
          const ab = Store.get().activeBoard;
          if (ab) ab.selectedId = el.dataset.id;
          this.renderTokens && this.renderTokens();
        } catch (_) {}
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
        // o.color завжди пріоритетний (палітра); інакше дефолт типу
        let col = o.color || this.strokeColorFor(o.type) || '#f1c40f';
        let dash = '';
        let sw = o.strokeW != null ? o.strokeW : (o.type === 'shot' ? 4 : 3);
        if (o.type === 'run' || o.type === 'arrowDash') dash = 'stroke-dasharray="10,6"';
        if (o.type === 'dribble') dash = 'stroke-dasharray="4,4"';
        const selected = s.activeBoard.selectedId === o.id;
        if (selected) sw = Math.max(sw, 3.5);
        const mkId = 'mk_' + String(col).replace(/[^a-zA-Z0-9]/g, '');
        if (!html.includes('id="' + mkId + '"')) {
          html += `<marker id="${mkId}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="${col}"/></marker>`;
        }
        html += `<line x1="${tx(o.x)}" y1="${ty(o.y)}" x2="${tx(o.x2)}" y2="${ty(o.y2)}" stroke="transparent" stroke-width="${sw + 14}"/>`;
        html += `<line x1="${tx(o.x)}" y1="${ty(o.y)}" x2="${tx(o.x2)}" y2="${ty(o.y2)}" stroke="${col}" stroke-width="${sw}" marker-end="url(#${mkId})" ${dash}/>`;
        if (selected) {
          html += `<circle cx="${tx(o.x)}" cy="${ty(o.y)}" r="9" fill="#fff" stroke="#1a73e8" stroke-width="2.5"/>`;
          html += `<circle cx="${tx(o.x2)}" cy="${ty(o.y2)}" r="9" fill="#1a73e8" stroke="#fff" stroke-width="2.5"/>`;
          const mx0 = (tx(o.x) + tx(o.x2)) / 2, my0 = (ty(o.y) + ty(o.y2)) / 2;
          html += `<circle cx="${mx0}" cy="${my0}" r="7" fill="#d5ff3f" stroke="#111" stroke-width="1.5"/>`;
        }
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
    // НЕ мутуємо координати при кожному render — інакше фішки «мігрують».
    // Clamp лише під час drag / place (onPointerMove / place*).
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
    const top = document.getElementById('boardToolbarTop') || document.getElementById('boardToolbar');
    const bottom = document.getElementById('boardToolbarBottom');
    if (!top && !bottom) return;
    const tool = Store.get().activeBoard.tool;
    const ab = Store.get().activeBoard;
    const drawCol = ab.drawColor || '';
    const paletteOpen = !!ab.paletteOpen;

    // ── ВЕРХ: chrome у темній смузі ──
    if (top) {
      top.className = 'btb btb-top';
      top.innerHTML = `
      <div class="tg btb-chrome">
        <button type="button" class="tb tb-exit" data-action="exit-board" title="${typeof t==='function'?t('board_exit','Вихід з дошки'):'Вихід з дошки'}">✕</button>
        <button type="button" class="tb tb-fs" data-action="toggle-fullscreen" title="${typeof t==='function'?t('board_fullscreen','Повний екран'):'Повний екран'}">⛶</button>
        <button type="button" class="tb" data-action="zoom-out" title="${typeof t==='function'?t('board_zoom_out','Зменшити'):'Зменшити'}">−</button>
        <button type="button" class="tb" data-action="zoom-fit" title="${typeof t==='function'?t('board_zoom_fit','Вписати поле'):'Вписати поле'}">⊡</button>
        <button type="button" class="tb" data-action="zoom-in" title="${typeof t==='function'?t('board_zoom_in','Збільшити'):'Збільшити'}">+</button>
        <button class="tb" data-action="toggle-present" title="${typeof t==='function'?t('board_present','Режим показу'):'Режим показу'}">▶ ${typeof t==='function'?t('board_present','Показ'):'Показ'}</button>
        <span class="btb-spacer"></span>
        <button class="tb" data-action="board-undo" title="${typeof t==='function'?t('board_undo','Скасувати'):'Скасувати'}">↩</button>
        <button class="tb" data-action="board-redo" title="${typeof t==='function'?t('board_redo','Повторити'):'Повторити'}">↪</button>
        <button class="tb" data-action="board-clear" title="${typeof t==='function'?t('board_clear','Очистити'):'Очистити'}">🗑</button>
        <button class="tb" data-action="board-save" title="${typeof t==='function'?t('board_save','Зберегти схему'):'Зберегти схему'}">💾</button>
        <button class="tb" data-action="save-board-diary" title="${typeof t==='function'?t('board_save_diary','Зберегти дошку в щоденник'):'Зберегти дошку в щоденник'}">📓</button>
      </div>`;
    }

    // ── НИЗ: компактна док-панель + Telegram-style висувний лоток ──
    if (bottom) {
      bottom.className = 'btb btb-bottom';
      const trayOpen = !!ab.toolsTrayOpen;
      bottom.innerHTML = `
      <div class="btb-dock" role="toolbar" aria-label="${typeof t==='function'?t('board_tools'):'Інструменти дошки'}">
        <div class="btb-primary">
          <button class="tb ${tool==='select'?'on':''}" data-tool="select" title="${typeof t==='function'?t('tool_select','Вибір'):'Вибір'}">↖</button>
          <button class="tb ${tool==='player'?'on':''}" data-tool="player" title="${typeof t==='function'?t('tool_player','Гравець'):'Гравець'}">●</button>
          <button class="tb ${tool==='opponent'?'on':''}" data-tool="opponent" title="${typeof t==='function'?t('tool_opponent','Суперник'):'Суперник'}">○</button>
          <button class="tb ${tool==='ball'?'on':''}" data-tool="ball" title="${typeof t==='function'?t('tool_ball','М\u2019яч'):'М\u2019яч'}">⚽</button>
          <button class="tb ${tool==='pass'?'on':''}" data-tool="pass" title="${typeof t==='function'?t('tool_pass','Пас'):'Пас'}">⇒</button>
          <button class="tb ${tool==='run'?'on':''}" data-tool="run" title="${typeof t==='function'?t('tool_run','Рух'):'Рух'}">⇢</button>
          <button class="tb ${tool==='dribble'?'on':''}" data-tool="dribble" title="${typeof t==='function'?t('tool_dribble','Ведення'):'Ведення'}">∿</button>
          <button type="button" class="tb tb-palette-toggle" data-action="toggle-palette" title="${typeof t==='function'?t('tool_select','Палітра'):'Палітра'}">🎨</button>
          <button type="button" class="tb tb-del" data-action="board-delete-selected" title="${typeof t==='function'?t('tool_delete'):'Видалити вибране'}">🗑</button>
          <button type="button" class="tb tb-more ${trayOpen?'on':''}" data-action="toggle-tools-tray" title="${typeof t==='function'?t('nav_more','Більше'):'Більше'}" aria-expanded="${trayOpen?'true':'false'}">
            <span class="tb-more-icon">${trayOpen ? '✕' : '⊕'}</span>
          </button>
        </div>
        <div class="palette-swatches ${paletteOpen ? 'open' : ''}" id="paletteSwatches">
          <button type="button" class="tb color-swatch ${drawCol==='#ecf0f1'?'on':''}" data-action="set-draw-color" data-color="#ecf0f1" style="background:#ecf0f1" title="${typeof t==='function'?t('color_white'):'Білий'}"></button>
          <button type="button" class="tb color-swatch ${drawCol==='#3498db'?'on':''}" data-action="set-draw-color" data-color="#3498db" style="background:#3498db" title="${typeof t==='function'?t('color_blue'):'Синій'}"></button>
          <button type="button" class="tb color-swatch ${drawCol==='#2ecc71'?'on':''}" data-action="set-draw-color" data-color="#2ecc71" style="background:#2ecc71" title="${typeof t==='function'?t('color_green'):'Зелений'}"></button>
          <button type="button" class="tb color-swatch ${drawCol==='#f1c40f'?'on':''}" data-action="set-draw-color" data-color="#f1c40f" style="background:#f1c40f" title="${typeof t==='function'?t('color_yellow'):'Жовтий'}"></button>
          <button type="button" class="tb color-swatch ${drawCol==='#e67e22'?'on':''}" data-action="set-draw-color" data-color="#e67e22" style="background:#e67e22" title="${typeof t==='function'?t('color_orange'):'Помаранчевий'}"></button>
          <button type="button" class="tb color-swatch ${drawCol==='#e74c3c'?'on':''}" data-action="set-draw-color" data-color="#e74c3c" style="background:#e74c3c" title="${typeof t==='function'?t('color_red'):'Червоний'}"></button>
          <button type="button" class="tb color-swatch ${drawCol==='#9b59b6'?'on':''}" data-action="set-draw-color" data-color="#9b59b6" style="background:#9b59b6" title="${typeof t==='function'?t('color_purple'):'Фіолетовий'}"></button>
          <button type="button" class="tb color-swatch ${drawCol==='#000000'?'on':''}" data-action="set-draw-color" data-color="#000000" style="background:#000" title="${typeof t==='function'?t('color_black'):'Чорний'}"></button>
        </div>
      </div>
      <div class="btb-tray ${trayOpen?'open':''}" id="btbToolsTray" aria-hidden="${trayOpen?'false':'true'}">
        <div class="btb-tray-handle"></div>
        <div class="btb-tray-grid">
          <div class="btb-tray-sec">
            <div class="btb-tray-label">Стрілки</div>
            <div class="btb-tray-row">
              <button class="tb ${tool==='press'?'on':''}" data-tool="press" title="Пресинг">⚡</button>
              <button class="tb ${tool==='shot'?'on':''}" data-tool="shot" title="Удар">↓</button>
              <button class="tb ${tool==='arrow'?'on':''}" data-tool="arrow" title="Стрілка">→</button>
              <button class="tb ${tool==='arrowDash'?'on':''}" data-tool="arrowDash" title="Пунктир">⤳</button>
            </div>
          </div>
          <div class="btb-tray-sec">
            <div class="btb-tray-label">Інвентар</div>
            <div class="btb-tray-row">
              <button class="tb ${tool==='cone'?'on':''}" data-tool="cone" title="Конус">▲</button>
              <button class="tb ${tool==='coneBig'?'on':''}" data-tool="coneBig" title="Великий конус">△</button>
              <button class="tb ${tool==='chip'?'on':''}" data-tool="chip" title="Фішка">◉</button>
              <button class="tb ${tool==='chipLarge'?'on':''}" data-tool="chipLarge" title="Велика фішка">⬤</button>
              <button class="tb ${tool==='wall'?'on':''}" data-tool="wall" title="Стінка">▬</button>
              <button class="tb ${tool==='man'?'on':''}" data-tool="man" title="Манекен">🧍</button>
              <button class="tb ${tool==='goal'?'on':''}" data-tool="goal" title="Ворота">⊓</button>
              <button class="tb ${tool==='dot'?'on':''}" data-tool="dot" title="Точка">·</button>
            </div>
          </div>
          <div class="btb-tray-sec">
            <div class="btb-tray-label">Розмітка</div>
            <div class="btb-tray-row">
              <button class="tb ${tool==='zone'?'on':''}" data-tool="zone" title="Зона">⬚</button>
              <button class="tb ${tool==='circle'?'on':''}" data-tool="circle" title="Коло">○</button>
              <button class="tb ${tool==='polygon'?'on':''}" data-tool="polygon" title="Багатокутник">⬠</button>
              <button class="tb ${tool==='freehand'?'on':''}" data-tool="freehand" title="Вільна лінія">✎</button>
              <button class="tb ${tool==='text'?'on':''}" data-tool="text" title="Текст">T</button>
            </div>
          </div>
          <div class="btb-tray-sec">
            <div class="btb-tray-label">Поле та схема</div>
            <div class="btb-tray-row btb-tray-row-selects">
              <button type="button" class="btb-pick" id="fieldViewBtn" data-action="pick-field-view" title="Вид поля">
                <span class="btb-pick-lb">Поле</span>
                <span class="btb-pick-val" id="fieldViewVal">Повне</span>
              </button>
              <button type="button" class="btb-pick" id="schemePickBtn" data-action="pick-scheme" title="Тактична схема">
                <span class="btb-pick-lb">Схема</span>
                <span class="btb-pick-val" id="schemePickVal">Обрати…</span>
              </button>
            </div>
            <!-- fallback native (hidden) for accessibility -->
            <select id="fieldViewSel" class="sr-only-select" aria-hidden="true" tabindex="-1">
              <option value="full">Повне</option>
              <option value="half">Половина</option>
              <option value="attack">Атака</option>
              <option value="defense">Захист</option>
            </select>
            <select id="schemeSel" class="sr-only-select" aria-hidden="true" tabindex="-1">
              <option value="">Схема…</option>
              ${Object.keys(typeof SCHEMES!=='undefined'?SCHEMES:{}).map(k => '<option value="'+k+'">'+k+'</option>').join('')}
            </select>
          </div>
          <div class="btb-tray-sec">
            <div class="btb-tray-label">Склад на полі</div>
            <div class="btb-tray-row">
              <button type="button" class="tb ${(Store.get().activeBoard&&Store.get().activeBoard.useAvatars)?'on':''}" data-action="toggle-avatar-chips" title="Аватар-фішки (×2)">👤</button>
              <button type="button" class="tb" data-action="rest-to-bench" title="Вільних зі складу на лавку">⬇ список→лавка</button>
            </div>
          </div>
          <div class="btb-tray-sec">
            <div class="btb-tray-label">Анімація</div>
            <div class="btb-tray-row">
              <button class="tb" data-action="anim-play" title="Відтворити">▶</button>
              <button class="tb" data-action="anim-pause" title="Пауза">⏸</button>
              <button class="tb" data-action="anim-stop" title="Стоп">⏹</button>
              <button class="tb" data-action="anim-step-prev" title="Крок −">⏮</button>
              <button class="tb" data-action="anim-step-next" title="Крок +">⏭</button>
              <span id="stepInd" class="step-ind">—</span>
              <button class="tb" data-action="export-gif" title="GIF">GIF</button>
            </div>
          </div>
        </div>
      </div>`;
    } else if (top) {
      // fallback single toolbar
      top.innerHTML += '';
    }

    const fvLabels = { full: 'Повне', half: 'Половина', attack: 'Атака', defense: 'Захист' };
    const fv = document.getElementById('fieldViewSel');
    const curFv = (Store.get().activeBoard && Store.get().activeBoard.fieldView) || 'full';
    if (fv) {
      fv.value = curFv;
      fv.onchange = () => {
        Store.get().activeBoard.fieldView = fv.value;
        BoardEngine.drawField(fv.value);
        BoardEngine.renderTokens();
        BoardEngine.renderDrawings();
        BoardEngine.fitField();
        const lab = document.getElementById('fieldViewVal');
        if (lab) lab.textContent = fvLabels[fv.value] || fv.value;
      };
    }
    const fvLab = document.getElementById('fieldViewVal');
    if (fvLab) fvLab.textContent = fvLabels[curFv] || curFv;
    const ss = document.getElementById('schemeSel');
    if (ss) ss.onchange = () => {
      if (ss.value) {
        BoardEngine.applyScheme(ss.value);
        const lab = document.getElementById('schemePickVal');
        if (lab) lab.textContent = ss.value;
        try { Toast.show('Схема: ' + ss.value, 'ok'); } catch (_) {}
      }
    };
    // Sync tray / palette body classes after every toolbar re-render
    try {
      document.body.classList.toggle('tools-tray-open', !!ab.toolsTrayOpen);
      try {
        const tray = document.getElementById('btbToolsTray');
        if (tray) {
          tray.classList.toggle('open', !!ab.toolsTrayOpen);
          tray.setAttribute('aria-hidden', ab.toolsTrayOpen ? 'false' : 'true');
        }
      } catch (_) {}
      document.body.classList.toggle('palette-open', !!ab.paletteOpen);
    } catch (_) {}
  },

};


