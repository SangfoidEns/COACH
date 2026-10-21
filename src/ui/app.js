/** Extracted module: src/ui/app.js lines 2014-2394 — DO NOT rewrite business logic */
const App = {
  init() {
    try { TelegramManager.init(); } catch (e) { console.warn('Telegram', e); }
    try { StorageManager.init(); } catch (e) {
      console.error('Storage init failed', e);
      try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(BACKUP_KEY); } catch (_) {}
      try { StorageManager.init(); } catch (e2) { console.error(e2); }
    }
    try { this.applyBranding(); } catch (e) { console.warn('branding', e); }
    this.bindEvents();
    try { /* плаваюча навігація вимкнена — статичний сайдбар справа */ } catch (e) { console.warn('nav', e); }
    try { if (typeof AuthManager !== 'undefined') AuthManager.init(); } catch (e) { console.warn('Auth', e); }
    try { if (typeof AuthManager !== 'undefined') { AuthManager._resolveRole(); AuthManager._applyUiRole(); } } catch (_) {}
    try { BoardEngine.init(); } catch (e) { console.warn('board', e); }
    const view = (Store.get().ui && Store.get().ui.view) || 'dashboard';
    if (view === 'board') this.allowBoardOnce('logo');
    this.navigate(view);
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
    try {
      const b = Store.get().activeBoard;
      if (b && (!b.history || !b.history.length)) {
        b.history = [JSON.stringify(b.objects || [])];
        b.historyIdx = 0;
      }
    } catch (_) {}
    try { Toast.show('МЕТАЛІСТ ШТУТГАРТ — тренерська платформа', 'ok'); } catch (_) {}
    try { this.initSwipeNav(); } catch (_) {}
  },

  initSwipeNav() {
    const main = document.getElementById('main');
    if (!main || main.dataset.swipeBound) return;
    main.dataset.swipeBound = '1';
    const order = ['dashboard', 'trainings', 'players', 'calendar', 'tactics'];
    let sx = 0, sy = 0, tracking = false;
    main.addEventListener('pointerdown', (e) => {
      if (document.body.classList.contains('mode-board-focus')) return;
      if (e.target.closest('.btb, button, a, input, select, textarea, .pt, .ball')) return;
      tracking = true;
      sx = e.clientX;
      sy = e.clientY;
    }, { passive: true });
    main.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      if (document.body.classList.contains('mode-board-focus')) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const cur = this.currentView || 'dashboard';
      const i = order.indexOf(cur);
      if (i < 0) return;
      const next = dx < 0 && i < order.length - 1 ? order[i + 1] : (dx > 0 && i > 0 ? order[i - 1] : null);
      if (!next) return;
      if (next === 'board') this.allowBoardOnce('explicit');
      this.navigate(next);
    }, { passive: true });
  },

  toggleMobileSidebar(force) {
    if (document.body.classList.contains('mode-board-focus')) {
      // у режимі дошки меню не відкриваємо
      force = false;
    }
    const open = force != null ? !!force : !document.body.classList.contains('sb-open');
    document.body.classList.toggle('sb-open', open);
    let backdrop = document.getElementById('sbBackdrop');
    if (open) {
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'sbBackdrop';
        backdrop.className = 'sb-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleMobileSidebar(false);
        });
        document.body.appendChild(backdrop);
      }
      try {
        const tg = window.Telegram && window.Telegram.WebApp;
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      } catch (_) {}
    } else if (backdrop) {
      backdrop.remove();
    }
  },

  /** Свайп від лівого краю → відкрити drawer (як у Telegram) */
  bindEdgeSwipeDrawer() {
    if (this._edgeSwipeBound) return;
    this._edgeSwipeBound = true;
    let tracking = false;
    let sx = 0, sy = 0;
    const EDGE = 28;
    document.addEventListener('pointerdown', (e) => {
      if (document.body.classList.contains('mode-board-focus')) return;
      if (document.body.classList.contains('sb-open')) return;
      if (e.clientX > EDGE) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      tracking = true;
      sx = e.clientX;
      sy = e.clientY;
    }, { passive: true, capture: true });
    document.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (dx > 56 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        this.toggleMobileSidebar(true);
      }
    }, { passive: true, capture: true });
    document.addEventListener('pointercancel', () => { tracking = false; }, { passive: true });
  },


  /** Логотип / назва клубу → тактична дошка з дефолтною схемою */
  bindLogoAndImport() {
    // Логотип → дошка (pointerdown + click, Android/iOS/Windows)
    const logo = document.getElementById('club-logo-btn') || document.querySelector('[data-action="open-default-board"]');
    if (logo && !logo._msBound) {
      logo._msBound = true;
      let armed = false;
      const openBoard = (e) => {
        if (typeof StorageManager !== 'undefined' && StorageManager.isIoLocked && StorageManager.isIoLocked()) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          return;
        }
        if (e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        }
        try { this.openDefaultBoard(); } catch (err) { console.error(err); }
      };
      // pointerdown: швидший відгук на touch; не відкриваємо на scroll
      logo.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button !== 0) return;
        armed = true;
      }, { passive: true });
      logo.addEventListener('pointerup', (e) => {
        if (!armed) return;
        armed = false;
        openBoard(e);
      });
      logo.addEventListener('pointercancel', () => { armed = false; });
      logo.addEventListener('click', (e) => {
        // fallback якщо pointerup не спрацював (деякі WebView)
        openBoard(e);
      });
      logo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (StorageManager.isIoLocked && StorageManager.isIoLocked()) return;
          e.preventDefault();
          openBoard(e);
        }
      });
    }

    // CAPTURE: Імпорт / Експорт — повна ізоляція від роутера
    if (!document._msIoCapture) {
      document._msIoCapture = true;
      document.addEventListener('click', (e) => {
        const exp = e.target.closest('#btnExportJson, [data-io="export"], [data-action="export"]');
        const imp = e.target.closest('#btnImportJson, [data-io="import"], [data-action="import-trigger"]');
        if (!exp && !imp) return;

        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

        // Не відкривати дошку
        try {
          if (typeof StorageManager !== 'undefined') StorageManager.beginIoLock(5000);
        } catch (_) {}

        if (exp) {
          // Експорт — ТІЛЬКИ тренер @Serdiuk_Artem
          if (typeof AuthManager !== 'undefined' && !AuthManager.isCoach()) {
            Toast.show('Експорт JSON доступний лише тренеру', 'warn');
            return;
          }
          try {
            StorageManager.exportJSON();
          } catch (err) {
            Toast.show('Експорт: ' + (err.message || err), 'err');
          }
          return;
        }

        if (imp) {
          // Імпорт — для всіх (тренер / гравець / гість)
          try {
            StorageManager.pickAndImportJSON();
          } catch (err) {
            Toast.show('Імпорт: ' + (err.message || err), 'err');
          }
        }
      }, true);
    }

    try { StorageManager._ensureImportInput(); } catch (_) {}
  },

  openDefaultBoard() {
    try {
      if (typeof StorageManager !== 'undefined' && StorageManager.isIoLocked && StorageManager.isIoLocked()) {
        console.warn('[openDefaultBoard] blocked during IO');
        return;
      }
      const s = Store.get();
      if (!s || !s.activeBoard) {
        this.allowBoardOnce('logo'); this.navigate('board');
        return;
      }
      const defName = (s.settings && s.settings.defaultScheme) || '4-3-3';
      const pinned = (s.boards || []).find(b => b && b.isDefault) || (s.boards || []).find(b => b && b.objects && b.objects.length) || null;
      if (pinned && Array.isArray(pinned.objects) && pinned.objects.length) {
        s.activeBoard.objects = JSON.parse(JSON.stringify(pinned.objects));
        if (pinned.fieldView) s.activeBoard.fieldView = pinned.fieldView;
        s.activeBoard.selectedId = null;
        try { StorageManager.saveDebounced(); } catch (_) {}
      } else if (typeof BoardEngine !== 'undefined' && typeof BoardEngine.applyScheme === 'function') {
        try { BoardEngine.applyScheme(defName); } catch (e) { console.warn('[scheme]', e); }
      }
      this.allowBoardOnce('logo'); this.navigate('board');
      setTimeout(() => {
        try {
          if (BoardEngine.render) BoardEngine.render();
          if (BoardEngine.fitField) BoardEngine.fitField();
          if (BoardEngine.renderToolbar) BoardEngine.renderToolbar();
        } catch (_) {}
      }, 60);
      try { Toast.show('Дошка · ' + defName, 'ok'); } catch (_) {}
    } catch (e) {
      console.error('[openDefaultBoard]', e);
      try { this.allowBoardOnce('logo'); this.navigate('board'); } catch (_) {}
    }
  },

  applyBranding() {
    try {
      const me = document.getElementById('rbacMe');
      if (me && typeof AuthManager !== 'undefined') {
        me.textContent = AuthManager.displayName() + ' · ' + AuthManager.roleLabel() +
          (AuthManager.user ? ' · ID ' + AuthManager.user.id : '');
      }
    } catch (_) {}
    // Бейдж тренера біля назви клубу (всередині brand-hit)
    try {
      const badge = document.getElementById('authBadge');
      if (badge) {
        if (typeof AuthManager !== 'undefined') {
          const role = AuthManager.roleLabel();
          const name = AuthManager.displayName();
          badge.innerHTML = '<span class="auth-role">' + sanitize(role) + '</span>: ' + sanitize(name);
          badge.title = AuthManager.user ? ('Telegram ID: ' + AuthManager.user.id) : 'Локальний режим';
        } else {
          badge.textContent = 'Тренер: —';
        }
      }
    } catch (_) {}
    const s = Store.get().settings;
    document.documentElement.style.setProperty('--club-primary', s.primary);
    document.documentElement.style.setProperty('--club-secondary', s.accent);
    document.documentElement.style.setProperty('--club-accent', s.accent);
    const logo = document.getElementById('clubLogo');
    if (logo) {
      if (s.logoData) {
        logo.innerHTML = '<img src="' + s.logoData + '" alt="logo">';
      } else {
        logo.textContent = s.clubShort || 'МШ';
      }
    }
    const parts = (s.clubName || 'МЕТАЛІСТ ШТУТГАРТ').split(' ');
    const cn = document.getElementById('clubName');
    if (cn) {
      cn.innerHTML = parts.length > 1
        ? sanitize(parts[0]) + ' <em>' + sanitize(parts.slice(1).join(' ')) + '</em>'
        : sanitize(s.clubName);
    }
  },


  initFloatingNav() {
    // Звичайний режим: фіксована ліва навігація. Плаваюча — лише board-fs-nav / board-only.
    const sb = document.getElementById('sidebar');
    const handle = document.getElementById('sbDrag');
    if (!sb || !handle) return;
    // restore position
    try {
      const pos = JSON.parse(localStorage.getItem('ms_nav_pos') || 'null');
      if (pos && typeof pos.left === 'number') {
        sb.style.left = pos.left + 'px';
        sb.style.top = pos.top + 'px';
        sb.style.right = 'auto';
      }
    } catch (_) {}
    let dragging = false, ox = 0, oy = 0;
    const onDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      dragging = true;
      const r = sb.getBoundingClientRect();
      const cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX);
      const cy = e.clientY != null ? e.clientY : (e.touches && e.touches[0].clientY);
      ox = cx - r.left;
      oy = cy - r.top;
      handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX);
      const cy = e.clientY != null ? e.clientY : (e.touches && e.touches[0].clientY);
      if (cx == null) return;
      let left = cx - ox;
      let top = cy - oy;
      const maxL = window.innerWidth - sb.offsetWidth - 8;
      const maxT = window.innerHeight - 40;
      left = Math.max(8, Math.min(maxL, left));
      top = Math.max(8, Math.min(maxT, top));
      sb.style.left = left + 'px';
      sb.style.top = top + 'px';
      sb.style.right = 'auto';
      sb.style.bottom = 'auto';
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      try {
        localStorage.setItem('ms_nav_pos', JSON.stringify({
          left: parseFloat(sb.style.left) || 12,
          top: parseFloat(sb.style.top) || 68
        }));
      } catch (_) {}
    };
    handle.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  },


  /** Перетягування панелі інструментів дошки (не малює на canvas) */
  applyToolbarDefaultPos(tb) {
    if (!tb) return;
    // Docked top/bottom — не чіпаємо inline position
    if (tb.id === 'boardToolbarTop' || tb.id === 'boardToolbarBottom' || tb.classList.contains('btb-top') || tb.classList.contains('btb-bottom')) return;
    tb.style.left = '50%';
    tb.style.top = 'auto';
    tb.style.right = 'auto';
    tb.style.bottom = 'max(12px, env(safe-area-inset-bottom, 0px))';
    tb.style.transform = 'translateX(-50%)';
  },

  clampToolbarPos(tb, left, top) {
    const w = tb.offsetWidth || 280;
    const h = tb.offsetHeight || 80;
    const maxL = Math.max(4, window.innerWidth - w - 4);
    const maxT = Math.max(4, window.innerHeight - h - 4);
    // не вище safe top (TG header)
    const minT = 8;
    return {
      left: Math.max(4, Math.min(maxL, left)),
      top: Math.max(minT, Math.min(maxT, top))
    };
  },

  restoreToolbarPos(tb) {
    if (!tb) return;
    if (tb.id === 'boardToolbarTop' || tb.id === 'boardToolbarBottom') return;
    try {
      if (localStorage.getItem('ms_btb_locked') === '1') tb.classList.add('btb-locked');
      const raw = localStorage.getItem('ms_btb_pos');
      if (!raw) { this.applyToolbarDefaultPos(tb); return; }
      const pos = JSON.parse(raw);
      // відносні частки viewport (0..1) — стабільно при зміні розміру
      if (pos && typeof pos.rx === 'number' && typeof pos.ry === 'number') {
        const left = pos.rx * window.innerWidth;
        const top = pos.ry * window.innerHeight;
        const c = this.clampToolbarPos(tb, left, top);
        tb.style.left = c.left + 'px';
        tb.style.top = c.top + 'px';
        tb.style.right = 'auto';
        tb.style.bottom = 'auto';
        tb.style.transform = 'none';
        return;
      }
      // legacy absolute px
      if (pos && typeof pos.left === 'number') {
        const c = this.clampToolbarPos(tb, pos.left, pos.top || 0);
        tb.style.left = c.left + 'px';
        tb.style.top = c.top + 'px';
        tb.style.right = 'auto';
        tb.style.bottom = 'auto';
        tb.style.transform = 'none';
        return;
      }
    } catch (_) {}
    this.applyToolbarDefaultPos(tb);
  },

  initBoardToolbarDrag() {
    // Docked top/bottom bars — без плаваючого drag
    if (document.getElementById('boardToolbarTop') || document.getElementById('boardToolbarBottom')) return;
    const tb = document.getElementById('boardToolbar');
    if (!tb) return;
    // Після renderToolbar innerHTML зникає — відновлюємо хендл і позицію
    let handle = tb.querySelector('.btb-drag-handle');
    if (!handle) {
      handle = document.createElement('div');
      handle.className = 'btb-drag-handle';
      handle.title = 'Перетягніть панель';
      handle.innerHTML = '⋮⋮';
      tb.insertBefore(handle, tb.firstChild);
    }
    this.restoreToolbarPos(tb);
    if (tb.dataset.dragBound) return;
    tb.dataset.dragBound = '1';
    let dragging = false, ox = 0, oy = 0;
    const onDown = (e) => {
      if (tb.classList.contains('btb-locked')) return;
      if (e.target.closest('button, select, input')) return;
      if (!e.target.closest('.btb-drag-handle') && e.target !== handle) return;
      dragging = true;
      const r = tb.getBoundingClientRect();
      ox = (e.clientX != null ? e.clientX : 0) - r.left;
      oy = (e.clientY != null ? e.clientY : 0) - r.top;
      tb.classList.add('btb-dragging');
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
      e.stopPropagation();
    };
    const onMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      e.stopPropagation();
      const c = this.clampToolbarPos(tb, e.clientX - ox, e.clientY - oy);
      tb.style.left = c.left + 'px';
      tb.style.top = c.top + 'px';
      tb.style.right = 'auto';
      tb.style.bottom = 'auto';
      tb.style.transform = 'none';
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      tb.classList.remove('btb-dragging');
      try {
        const left = parseFloat(tb.style.left) || 0;
        const top = parseFloat(tb.style.top) || 0;
        localStorage.setItem('ms_btb_pos', JSON.stringify({
          rx: left / Math.max(1, window.innerWidth),
          ry: top / Math.max(1, window.innerHeight)
        }));
      } catch (_) {}
    };
    handle.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('resize', () => {
      if (document.body.classList.contains('mode-board-focus')) this.restoreToolbarPos(tb);
    });
  },

  /** Дозволені причини переходу на дошку */
  _boardNavReasons: new Set(['logo', 'preset', 'scheme', 'board-tpl', 'load-board', 'b3-phase', 'special']), // logo + explicit tactical presets only
  allowBoardOnce(reason) {
    this._boardNavToken = reason || 'explicit';
  },

  _bindPlayerCompare() {
    const sel = document.getElementById('playerCompareSel');
    if (!sel || sel._bound) return;
    sel._bound = true;
    sel.addEventListener('change', () => {
      try { window.__playerCompareId = sel.value || ''; } catch (_) {}
      try { this.renderCurrent(); } catch (_) {}
    });
  },
  navigate(view) {
    // iOS: після file picker focus може «клікнути» логотип — блокуємо
    try {
      if (typeof StorageManager !== 'undefined' && StorageManager.isIoLocked && StorageManager.isIoLocked()) {
        if (view === 'board') {
          console.warn('[navigate] blocked during IO lock');
          return;
        }
      }
    } catch (_) {}
    // Дошка лише з явним allowBoardOnce(reason)
    if (view === 'board') {
      const token = this._boardNavToken;
      this._boardNavToken = null;
      if (!token || !this._boardNavReasons || !this._boardNavReasons.has(token)) {
        console.warn('[navigate] board blocked — missing allow token', token);
        return;
      }
    }
    try { this.toggleMobileSidebar(false); } catch (_) {}
    Store.get().ui.view = view;
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('on');
      // Гарантовано ховаємо неактивні екрани (CSS !important інколи перебивав display)
      if (v.id === 'v-board' || v.classList.contains('view-board')) {
        v.style.display = 'none';
        v.setAttribute('aria-hidden', 'true');
      }
    });
    const el = document.getElementById('v-' + view);
    if (el) {
      el.classList.add('on');
      el.style.display = '';
      el.removeAttribute('aria-hidden');
    }
    document.querySelectorAll('.nav, .mni').forEach(n => n.classList.toggle('on', n.dataset.view === view));
    // Canvas-first workspace on board
    if (view === 'board') {
      document.body.classList.add('board-workspace', 'mode-board-focus');
      document.body.classList.remove('bw-props', 'bw-tools-collapsed', 'bw-nav-hide');
      const boardEl = document.getElementById('v-board');
      if (boardEl) {
        boardEl.classList.add('on');
        boardEl.style.display = 'flex';
        boardEl.setAttribute('aria-hidden', 'false');
      }
      try { TelegramManager.showBackButton(); } catch (_) {}
      try { TelegramManager.haptic('light'); } catch (_) {}
    } else {
      // Вихід з дошки — завжди знімаємо FS/board-only, інакше UI «мертвий»
      try { if (typeof BoardEngine !== 'undefined' && BoardEngine.leaveBoardMode) BoardEngine.leaveBoardMode(); } catch (_) {}
      document.body.classList.remove(
        'board-workspace', 'mode-board-focus', 'board-only-mode', 'board-fs-nav',
        'bw-nav', 'bw-props', 'bw-tools-collapsed', 'bw-nav-hide', 'present-mode'
      );
      const boardEl = document.getElementById('v-board');
      if (boardEl) {
        boardEl.classList.remove('on');
        boardEl.style.display = 'none';
        boardEl.setAttribute('aria-hidden', 'true');
      }
      try { TelegramManager.hideBackButton(); } catch (_) {}
    }
    this.renderCurrent();
    try { this._bindPlayerCompare(); } catch (_) {}
    // field needs resize after layout change
    if (view === 'board') {
      requestAnimationFrame(() => {
        try { BoardEngine.render && BoardEngine.render(); } catch (_) {}
        window.dispatchEvent(new Event('resize'));
      });
    }
  },

  /** Panel layout helpers — do not reset board state */
  _afterPanelToggle() {
    this._syncPanelButtons();
    requestAnimationFrame(() => {
      try { BoardEngine.render && BoardEngine.render(); } catch (_) {}
      window.dispatchEvent(new Event('resize'));
    });
  },
  _syncPanelButtons() {
    const on = (sel, cond) => {
      document.querySelectorAll(sel).forEach(b => b.classList.toggle('on', !!cond));
    };
    on('[data-action="toggle-nav"]', !document.body.classList.contains('bw-nav-hide'));
    on('[data-action="toggle-props"]', document.body.classList.contains('bw-props'));
    on('[data-action="toggle-tools"]', document.body.classList.contains('bw-tools-collapsed'));
  },
  toggleNav() {
    document.body.classList.toggle('bw-nav-hide');
    this._afterPanelToggle();
  },
  toggleProps() {
    document.body.classList.toggle('bw-props');
    this._afterPanelToggle();
  },
  toggleTools() {
    document.body.classList.toggle('bw-tools-collapsed');
    this._afterPanelToggle();
  },
  showAllPanels() {
    document.body.classList.add('bw-nav', 'bw-props');
    document.body.classList.remove('bw-tools-collapsed');
    this._afterPanelToggle();
  },

  renderCurrent() {
    const view = (Store.get().ui && Store.get().ui.view) || 'dashboard';
    if (view === 'board') {
      try {
        BoardEngine.renderToolbar();
        BoardEngine.render();
        this.initBoardToolbarDrag();
      } catch (e) { console.error('[board render]', e); }
      return;
    }
    const el = document.getElementById('v-' + view);
    if (!el) {
      console.warn('[renderCurrent] missing #v-' + view);
      return;
    }
    if (!Views[view] || typeof Views[view] !== 'function') {
      el.innerHTML = '<div class="card"><div class="ct">Розділ недоступний</div></div>';
      return;
    }
    try {
      el.innerHTML = Views[view]();
      if (view === 'settings') {
        try {
          const me = document.getElementById('rbacMe');
          if (me && typeof AuthManager !== 'undefined') {
            me.textContent = AuthManager.displayName() + ' · ' + AuthManager.roleLabel();
          }
        } catch (_) {}
      }
    } catch (e) {
      console.error('[renderCurrent]', view, e);
      el.innerHTML = '<div class="card"><div class="ct">Помилка екрана</div><p class="note-sm">' +
        (typeof sanitize === 'function' ? sanitize(e.message || String(e)) : String(e)) +
        '</p><button type="button" class="btn btn-s" data-action="import-trigger">Імпорт JSON</button></div>';
    }
    try { this._bindPlayerCompare(); } catch (_) {}
  },

  updateClock() {
    const now = new Date();
    const el = document.getElementById('clock');
    if (el) el.innerHTML = `<strong>${fmtDate(now)}</strong> · ${now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const s = Store.get();
    const next = s.trainings.filter(t => t.status === 'planned' && t.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const nt = document.getElementById('nextTr');
    if (nt) {
      if (next) {
        const dt = new Date(next.date + 'T' + (next.time || '10:00'));
        const diff = dt - now;
        let cd = '—';
        if (diff > 0) {
          const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
          cd = h + 'г ' + m + 'хв';
        }
        nt.innerHTML = `Наступне: <strong>${sanitize(next.name)}</strong> (${cd})`;
      } else nt.innerHTML = 'Наступне: <strong>—</strong>';
    }
  },

  bindEvents() {
    // Прямі прив'язки (iOS / Telegram): логотип і імпорт не залежать від делегації
    try { this.bindLogoAndImport(); } catch (e) { console.warn(e); }
    try { this.bindEdgeSwipeDrawer(); } catch (e) { console.warn(e); }



    // Event delegation — single listener
    document.addEventListener('click', e => {
      // ── Ізоляція: кліки всередині модалки / меню не повинні «випадково» відкривати дошку ──
      const inModal = e.target.closest('#modal, .md, .modal-content, #modalBody, #modalFooter');
      const inSidebarNav = e.target.closest('#sidebar .nav, .sidebar .nav, .sb-scroll');

      const t = e.target.closest('[data-action],[data-view],[data-tool],[data-ai],[data-edit-training],[data-attendance-training],[data-del-training],[data-dup-training],[data-edit-player],[data-del-player],[data-scheme],[data-load-board],[data-del-board],[data-special],[data-day],[data-view-exercise],[data-view-match],[data-del-match],[data-tpl],[data-modal-action],[data-b3-phase],[data-board-tpl],[data-b3-rot],[data-del-myex],[data-add-myex-tr],[data-load-myex-board],[data-del-diary],[data-edit-diary],[data-load-diary-board],[data-diary-filter],[data-play-anim]');
      if (!t) {
        // close search
        if (!e.target.closest('.gs')) document.getElementById('gResults')?.classList.remove('show');
        // close modal on backdrop only
        if (e.target.id === 'modal') Modal.close();
        return;
      }

      const action = t.dataset.action;
      const view = t.dataset.view;

      // Редагування / CRUD — ніколи не відкривають дошку
      if (t.dataset.editTraining || t.dataset.delTraining || t.dataset.dupTraining ||
          t.dataset.editPlayer || t.dataset.delPlayer || t.dataset.editDiary ||
          t.dataset.delDiary || t.dataset.delMyex || t.dataset.delMatch ||
          t.dataset.delBoard || t.dataset.modalAction ||
          e.target.closest('.card-training')) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      }

      // data-view навігація: блокуємо, якщо це вкладений клік у кнопці редагування
      if (view && !t.dataset.action) {
        if (e.target.closest('[data-edit-training],[data-attendance-training],[data-del-training],[data-dup-training],[data-edit-player],[data-del-player],[data-modal-action],.card-training,#modal,.mo')) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // data-view="board" з меню ЗАБОРОНЕНО — лише логотип / пресет
        if (view === 'board') {
          e.preventDefault();
          e.stopPropagation();
          console.warn('[router] data-view=board blocked from menu');
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        App.navigate(view);
        return;
      }
      if (t.dataset.tool) { Store.get().activeBoard.tool = t.dataset.tool; BoardEngine.renderToolbar(); return; }
      if (t.dataset.ai) {
        const map = { training: () => AIService.generateTraining(), warmup: () => AIService.generateExercise('warmup'),
          tech: () => AIService.generateExercise('tech'), tactical: () => AIService.generateExercise('tactical'),
          gk: () => AIService.generateExercise('gk'), post: () => AIService.generateTraining(),
          pre: () => AIService.generateTraining(), optimize: () => AIService.optimizeLoad(),
          balance: () => Toast.show('Баланс: тех 30% / так 30% / фіз 20% / гра 20%', 'ok'),
          micro: () => AIService.analyzeMicrocycle() };
        if (map[t.dataset.ai]) map[t.dataset.ai]();
        return;
      }

      if (action === 'new-training') return Actions.newTraining();
      if (action === 'new-myex') return Actions.newMyEx();
      if (action === 'myex-from-board') return Actions.myExFromBoard();
      if (action === 'new-diary') return Actions.newDiary();
      if (action === 'save-b3-anim') return Actions.saveB3Anim();
      if (action === 'save-anim-to-training') return Actions.saveAnimToTraining();

      if (action === 'new-player') return Actions.newPlayer();
      if (action === 'new-exercise') return Actions.newExercise();
      if (action === 'new-match') return Actions.newMatch();
      if (action === 'new-event') return Actions.newEvent();
      if (action === 'toggle-rp') return document.getElementById('rightPanel').classList.toggle('force');
      // export / import — обробляються лише в capture (bindLogoAndImport), тут ігнор
      if (action === 'export' || action === 'import-trigger') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (action === 'open-default-board') {
        e.preventDefault();
        e.stopPropagation();
        App.openDefaultBoard();
        return;
      }
      if (action === 'reset-all') {
        if (typeof AuthManager !== 'undefined' && !AuthManager.can('reset-data')) {
          return Toast.show('Скидання доступне лише тренеру', 'warn');
        }
        return Modal.confirm('Скинути всі дані до демо?', () => { StorageManager.clear(); App.applyBranding(); App.navigate('dashboard'); Toast.show('Скинуто', 'ok'); });
      }
      if (action === 'save-settings') return Actions.saveSettings();
      if (action === 'save-rbac') {
        const coachesRaw = (document.getElementById('setCoaches')?.value || '').split(',').map(x => x.trim()).filter(Boolean);
        let links = {};
        try { links = JSON.parse(document.getElementById('setPlayerLinks')?.value || '{}'); } catch (_) { Toast.show('Невірний JSON прив\'язок', 'err'); return; }
        const st = Store.get();
        if (!st.settings.rbac) st.settings.rbac = { coaches: [], playerLinks: {} };
        st.settings.rbac.coaches = coachesRaw;
        st.settings.rbac.playerLinks = links;
        StorageManager.save();
        AuthManager._resolveRole();
        AuthManager._applyUiRole();
        Toast.show('Ролі збережено · ' + AuthManager.roleLabel(), 'ok');
        return;
      }
      if (action === 'save-rbac') {
        const coachesRaw = (document.getElementById('setCoaches')?.value || '').split(',').map(x => x.trim()).filter(Boolean);
        let links = {};
        try { links = JSON.parse(document.getElementById('setPlayerLinks')?.value || '{}'); } catch (_) { Toast.show('Невірний JSON прив\'язок', 'err'); return; }
        const st = Store.get();
        if (!st.settings.rbac) st.settings.rbac = { coaches: [], playerLinks: {} };
        st.settings.rbac.coaches = coachesRaw;
        st.settings.rbac.playerLinks = links;
        StorageManager.save();
        AuthManager._resolveRole();
        AuthManager._applyUiRole();
        Toast.show('Ролі збережено · ' + AuthManager.roleLabel(), 'ok');
        return;
      }
      if (action === 'close-modal') return Modal.close();
      if (action === 'timer-start') return TimerEngine.start();
      if (action === 'timer-pause') return TimerEngine.pause();
      if (action === 'timer-reset') return TimerEngine.reset();
      if (action === 'timer-add') return TimerEngine.add(+t.dataset.sec || 0);
      if (action === 'extimer-start') return TimerEngine.startEx();
      if (action === 'extimer-pause') return TimerEngine.pauseEx();
      if (action === 'extimer-reset') return TimerEngine.resetEx();
      if (action === 'toggle-present') {
        if (Store.get().ui.view !== 'board') {
          Toast.show('Спочатку відкрийте дошку через логотип', 'warn');
          return;
        }
        document.body.classList.toggle('present-mode');
        Toast.show(document.body.classList.contains('present-mode') ? 'Presentation ON' : 'Presentation OFF');
        return;
      }
      if (action === 'toggle-nav') return App.toggleNav();
      if (action === 'toggle-props') return App.toggleProps();
      if (action === 'toggle-tools') return App.toggleTools();
      if (action === 'show-all-panels') return App.showAllPanels();
      if (action === 'toggle-toolbar-collapse') {
        const tb = (document.getElementById('boardToolbarTop') || document.getElementById('boardToolbarBottom') || document.getElementById('boardToolbar'));
        if (tb) {
          tb.classList.toggle('btb-collapsed');
          localStorage.setItem('ms_btb_collapsed', tb.classList.contains('btb-collapsed') ? '1' : '0');
          try { BoardEngine.renderToolbar(); App.initBoardToolbarDrag(); } catch (_) {}
        }
        return;
      }
      if (action === 'lock-toolbar') {
        const tb = (document.getElementById('boardToolbarTop') || document.getElementById('boardToolbarBottom') || document.getElementById('boardToolbar'));
        if (tb) {
          tb.classList.toggle('btb-locked');
          const locked = tb.classList.contains('btb-locked');
          localStorage.setItem('ms_btb_locked', locked ? '1' : '0');
          Toast.show(locked ? 'Панель зафіксовано' : 'Панель можна перетягувати', 'ok');
        }
        return;
      }
      if (action === 'toggle-palette') {
        e.preventDefault(); e.stopPropagation();
        const ab = Store.get().activeBoard;
        ab.paletteOpen = !ab.paletteOpen;
        try { BoardEngine.renderToolbar(); } catch (_) {}
        return;
      }
      if (action === 'set-draw-color') {
        e.preventDefault(); e.stopPropagation();
        const col = t.dataset.color || '#f1c40f';
        const ab = Store.get().activeBoard;
        ab.drawColor = col;
        // Застосувати до виділеного об'єкта (стрілка, зона, фішка своєї/чужої команди)
        const sel = ab.selectedId;
        if (sel) {
          const obj = (ab.objects || []).find(o => o.id === sel);
          if (obj) {
            obj.color = col;
            if (obj.type === 'player' || obj.team === 'own' || obj.team === 'opp' || obj.number != null) {
              obj.chipColor = col;
              obj.fill = col;
            }
          }
        }
        try { BoardEngine.render(); BoardEngine.renderToolbar(); } catch (_) {}
        try { StorageManager.save(); } catch (_) {}
        Toast.show(sel ? 'Колір на виділене' : 'Колір задано — тепер додавайте фішки / схему', 'ok');
        return;
      }
      
      // Role guard: гравець/гість не редагують
      try {
        if (typeof AuthManager !== 'undefined' && !AuthManager.isCoach()) {
          const editActions = ['new-player','new-training','board-clear','board-save','import-json','export-json','reset-data'];
          if (action && editActions.includes(action)) {
            e.preventDefault(); e.stopPropagation();
            Toast.show('Лише тренер може це змінювати', 'warn');
            return;
          }
          if (e.target.closest('[data-edit-player],[data-del-player],[data-edit-training],[data-del-training],[data-attendance-training]')) {
            e.preventDefault(); e.stopPropagation();
            Toast.show('Режим перегляду', 'warn');
            return;
          }
        }
      } catch (_) {}

      if (action === 'exit-board') {
        e.preventDefault(); e.stopPropagation();
        try { BoardEngine.leaveBoardMode && BoardEngine.leaveBoardMode(); } catch (_) {
          try { BoardEngine.exitFullscreen && BoardEngine.exitFullscreen(); } catch (_) {}
          document.body.classList.remove('board-fs-nav','board-only-mode','mode-board-focus','board-workspace','present-mode');
        }
        App.navigate('dashboard');
        return;
      }
      if (action === 'toggle-fullscreen') return BoardEngine.toggleFullscreen();
      if (action === 'exit-fullscreen') return BoardEngine.exitFullscreen();
      if (action === 'zoom-in') return BoardEngine.setZoom(BoardEngine.camera.zoom * 1.2);
      if (action === 'zoom-out') return BoardEngine.setZoom(BoardEngine.camera.zoom / 1.2);
      if (action === 'zoom-fit') return BoardEngine.fitField();
      if (action === 'to-bench') {
        e.preventDefault(); e.stopPropagation();
        const id = Store.get().activeBoard.selectedId;
        if (!id) { try { Toast.show('Спочатку виділіть фішку на полі', 'warn'); } catch (_) {} return; }
        BoardEngine.demoteToBench(id);
        return;
      }
      if (action === 'board-undo') return BoardEngine.undo();
      if (action === 'board-redo') return BoardEngine.redo();
      if (action === 'board-clear') return BoardEngine.clear();
      if (action === 'board-save') return BoardEngine.saveBoard();
      if (action === 'anim-step-prev') return BoardEngine.animStepPrev();
      if (action === 'anim-step-next') return BoardEngine.animStepNext();
      if (action === 'export-gif') return BoardEngine.exportGif();
      if (action === 'export-gif-static') return BoardEngine.exportGifStatic();
      if (action === 'toggle-sidebar') return App.toggleMobileSidebar();
      if (action === 'anim-play') return BoardEngine.animPlay();
      if (action === 'anim-pause') return BoardEngine.animPause();
      if (action === 'anim-stop') return BoardEngine.animStop();
      if (action === 'anim-restart') return BoardEngine.animRestart();
      if (action === 'cal-prev') { const d = new Date(Store.get().ui.calDate); d.setMonth(d.getMonth() - 1); Store.get().ui.calDate = d.toISOString().slice(0, 10); App.renderCurrent(); try { App._bindPlayerCompare(); } catch (_) {} return; }
      if (action === 'cal-next') { const d = new Date(Store.get().ui.calDate); d.setMonth(d.getMonth() + 1); Store.get().ui.calDate = d.toISOString().slice(0, 10); App.renderCurrent(); return; }
      if (action === 'microcycle') return Actions.applyMicrocycle();
      if (action === 'export-stats') return StorageManager.exportJSON();

      if (t.dataset.editTraining) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        // ТІЛЬКИ модалка деталей — без переходу на дошку
        return Actions.editTraining(t.dataset.editTraining);
      }
      if (t.dataset.attendanceTraining) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        return Actions.openAttendance(t.dataset.attendanceTraining);
      }
      if (action === 'open-training-board') {
        e.preventDefault(); e.stopPropagation();
        Modal.close();
        Toast.show('Відкрийте дошку через логотип клубу в шапці', 'ok');
        return;
      }
      if (t.dataset.delTraining) return Modal.confirm('Видалити тренування?', () => { Store.get().trainings = Store.get().trainings.filter(x => x.id !== t.dataset.delTraining); StorageManager.save(); App.renderCurrent(); Toast.show('Видалено'); });
      if (t.dataset.dupTraining) return Actions.dupTraining(t.dataset.dupTraining);
      if (t.dataset.editPlayer) {
        e.preventDefault(); e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        return Actions.editPlayer(t.dataset.editPlayer);
      }
      if (t.dataset.delPlayer) return Modal.confirm('Видалити гравця?', () => { Store.get().players = Store.get().players.filter(x => x.id !== t.dataset.delPlayer); StorageManager.save(); App.renderCurrent(); });
      if (t.dataset.scheme) {
        e.preventDefault(); e.stopPropagation();
        BoardEngine.applyScheme(t.dataset.scheme);
        App.allowBoardOnce('scheme');
        App.navigate('board');
        Toast.show('Схема: ' + t.dataset.scheme, 'ok');
        return;
      }
      if (t.dataset.boardTpl) {
        e.preventDefault(); e.stopPropagation();
        BoardEngine.applyScheme(t.dataset.boardTpl);
        App.allowBoardOnce('board-tpl');
        App.navigate('board');
        Toast.show('Шаблон на дошці', 'ok');
        return;
      }
      if (t.dataset.b3Phase) {
        e.preventDefault(); e.stopPropagation();
        BoardEngine.applyScheme(t.dataset.b3Phase);
        App.allowBoardOnce('b3-phase');
        App.navigate('board');
        Toast.show('Фаза: ' + (t.dataset.b3Name || t.dataset.b3Phase), 'ok');
        return;
      }
      if (t.dataset.b3Rot) {
        Toast.show('Ротація: ' + t.dataset.b3Rot + ' — відкрийте дошку через логотип', 'ok');
        return;
        return;
      }
      if (t.dataset.delMyex) {
        Modal.confirm('Видалити вправу?', () => {
          Store.get().myExercises = (Store.get().myExercises || []).filter(x => x.id !== t.dataset.delMyex);
          StorageManager.save(); App.renderCurrent();
        });
        return;
      }
      if (t.dataset.addMyexTr) {
        const ex = (Store.get().myExercises || []).find(x => x.id === t.dataset.addMyexTr);
        if (!ex) return;
        const trs = Store.get().trainings.filter(x => x.status === 'planned' || x.status === 'draft');
        if (!trs.length) {
          // create training with this exercise
          const tr = { id: uid(), name: 'Тренування: ' + ex.name, date: today(), time: '18:00', duration: ex.duration || 90, intensity: ex.intensity || 6, status: 'draft', structure: [{ id: uid(), title: ex.name, type: 'myex', duration: ex.duration || 15, intensity: ex.intensity || 6, myExId: ex.id, animationId: ex.animationId || null }], mainGoal: ex.objective || '', comment: '' };
          Store.get().trainings.push(tr);
          StorageManager.save();
          Toast.show('Створено тренування з вправою', 'ok');
          App.navigate('trainings');
        } else {
          const tr = trs[0];
          if (!tr.structure) tr.structure = [];
          tr.structure.push({ id: uid(), title: ex.name, type: 'myex', duration: ex.duration || 15, intensity: ex.intensity || 6, myExId: ex.id, animationId: ex.animationId || null });
          tr.duration = tr.structure.reduce((a, b) => a + (b.duration || 0), 0);
          StorageManager.save();
          Toast.show('Додано до: ' + tr.name, 'ok');
          App.navigate('trainings');
        }
        return;
      }
      if (t.dataset.loadMyexBoard) {
        e.preventDefault(); e.stopPropagation();
        const ex = (Store.get().myExercises || []).find(x => x.id === t.dataset.loadMyexBoard);
        if (ex && ex.board) {
          Store.get().activeBoard.objects = JSON.parse(JSON.stringify(ex.board.objects || []));
          App.allowBoardOnce('preset');
          App.navigate('board');
          setTimeout(() => { try { BoardEngine.render(); } catch (_) {} }, 50);
          Toast.show('Дошка вправи', 'ok');
        }
        return;
      }
      if (t.dataset.delDiary) {
        Modal.confirm('Видалити запис?', () => {
          Store.get().diary = (Store.get().diary || []).filter(x => x.id !== t.dataset.delDiary);
          StorageManager.save(); App.renderCurrent();
        });
        return;
      }
      if (t.dataset.loadDiaryBoard) {
        e.preventDefault(); e.stopPropagation();
        const d = (Store.get().diary || []).find(x => x.id === t.dataset.loadDiaryBoard);
        if (d && d.board) {
          Store.get().activeBoard.objects = JSON.parse(JSON.stringify(d.board.objects || []));
          try { BoardEngine.render(); } catch (_) {}
          Toast.show('Зі щоденника завантажено. Відкрийте дошку через логотип.', 'ok');
        }
        return;
      }
      if (t.dataset.diaryFilter) {
        const f = t.dataset.diaryFilter;
        document.querySelectorAll('#diaryList .card').forEach(c => {
          if (f === 'all') c.style.display = '';
          else c.style.display = (c.dataset.diaryCat === f) ? '' : 'none';
        });
        return;
      }
      if (t.dataset.playAnim) {
        e.preventDefault(); e.stopPropagation();
        const anim = (Store.get().animations || []).find(a => a.id === t.dataset.playAnim);
        if (anim && anim.board) {
          Store.get().activeBoard.objects = JSON.parse(JSON.stringify(anim.board.objects || []));
          try { BoardEngine.render(); } catch (_) {}
          Toast.show('Анімацію завантажено. Відкрийте дошку через логотип.', 'ok');
        }
        return;
      }

      if (t.dataset.loadBoard) {
        e.preventDefault(); e.stopPropagation();
        BoardEngine.loadBoard(t.dataset.loadBoard);
        App.allowBoardOnce('load-board');
        App.navigate('board');
        Toast.show('Заготовку відкрито на дошці', 'ok');
        return;
      }
      if (t.dataset.delBoard) return Modal.confirm('Видалити схему?', () => { Store.get().boards = Store.get().boards.filter(x => x.id !== t.dataset.delBoard); StorageManager.save(); App.renderCurrent(); });
      if (t.dataset.special) {
        e.preventDefault(); e.stopPropagation();
        const map = {
          attack: '4-3-3', defense: '5-3-2', press: '4-2-3-1',
          setpiece: '4-4-2', transition: '4-1-4-1', highpress: '3-4-3'
        };
        BoardEngine.applyScheme(map[t.dataset.special] || '4-3-3');
        App.allowBoardOnce('special');
        App.navigate('board');
        Toast.show('Схема: ' + (t.dataset.special || ''), 'ok');
        return;
      }
      if (t.dataset.day) { Store.get().ui.selectedDay = t.dataset.day; App.renderCurrent(); return; }
      if (t.dataset.viewExercise) return Actions.viewExercise(t.dataset.viewExercise);
      if (t.dataset.viewMatch) return Actions.viewMatch(t.dataset.viewMatch);
      if (t.dataset.delMatch) return Modal.confirm('Видалити матч?', () => { Store.get().matches = Store.get().matches.filter(x => x.id !== t.dataset.delMatch); StorageManager.save(); App.renderCurrent(); });
      if (t.dataset.tpl) return Actions.applyTemplate(t.dataset.tpl);

      if (t.dataset.modalAction === 'cancel') return Modal.close();
      if (t.dataset.modalAction === 'open-training-board') {
        e.preventDefault(); e.stopPropagation();
        Modal.close();
        Toast.show('Відкрийте дошку через логотип клубу в шапці', 'ok');
        return;
      }
      if (t.dataset.modalAction === 'confirm') {
        const fn = Modal._onConfirm;
        Modal.close();
        if (fn) fn();
        return;
      }
      // form submits via modal actions with specific handlers
      if (t.dataset.modalAction === 'create-training') return Actions.createTraining();
      if (t.dataset.modalAction === 'save-training') return Actions.saveTraining(t.dataset.tid);
      if (t.dataset.modalAction === 'open-attendance') return Actions.openAttendance(t.dataset.tid);
      if (t.dataset.modalAction === 'save-attendance') return Actions.saveAttendance(t.dataset.tid);
      if (t.dataset.modalAction === 'create-player') return Actions.createPlayer();
      if (t.dataset.modalAction === 'save-player') return Actions.savePlayer(t.dataset.pid);
      if (t.dataset.modalAction === 'create-exercise') return Actions.createExercise();
      if (t.dataset.modalAction === 'create-match') return Actions.createMatch();
      if (t.dataset.modalAction === 'create-event') return Actions.createEvent();
    });

    // Filters
    document.addEventListener('input', e => {
      if (e.target.dataset.filter === 'trainings') {
        const q = (document.getElementById('trSearch')?.value || '').toLowerCase();
        const st = document.getElementById('trStatus')?.value || '';
        let list = Store.get().trainings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        if (q) list = list.filter(t => t.name.toLowerCase().includes(q));
        if (st) list = list.filter(t => t.status === st);
        const el = document.getElementById('trList');
        if (el) el.innerHTML = Views._trList(list);
      }
      if (e.target.dataset.filter === 'players') {
        const q = (document.getElementById('plSearch')?.value || '').toLowerCase();
        const pos = document.getElementById('plPos')?.value || '';
        const st = document.getElementById('plSt')?.value || '';
        const gr = document.getElementById('plGr')?.value || '';
        let list = Store.get().players.slice();
        if (q) list = list.filter(p => (p.firstName + ' ' + p.lastName).toLowerCase().includes(q) || String(p.number).includes(q));
        if (pos) list = list.filter(p => p.position === pos);
        if (st) list = list.filter(p => p.status === st);
        if (gr === 'gk') list = list.filter(p => p.position === 'GK');
        else if (gr === 'def') list = list.filter(p => ['CB', 'LB', 'RB'].includes(p.position));
        else if (gr === 'mid') list = list.filter(p => ['DM', 'CM', 'AM'].includes(p.position));
        else if (gr === 'att') list = list.filter(p => ['LW', 'RW', 'ST'].includes(p.position));
        else if (gr) list = list.filter(p => p.group === gr);
        const el = document.getElementById('plTable');
        if (el) el.innerHTML = Views._plRows(list);
      }
      if (e.target.dataset.filter === 'exercises') {
        const q = (document.getElementById('exSearch')?.value || '').toLowerCase();
        const cat = document.getElementById('exCat')?.value || '';
        let list = Store.get().exercises.slice();
        if (q) list = list.filter(e => e.name.toLowerCase().includes(q));
        if (cat) list = list.filter(e => e.category === cat);
        const el = document.getElementById('exList');
        if (el) el.innerHTML = list.map(e => `<div class="ec" data-view-exercise="${e.id}"><h4>${sanitize(e.name)}</h4><div class="me">${e.category} · ${e.duration}хв · RPE ${e.intensity}</div></div>`).join('') || '<div class="es">Немає</div>';
      }
      // global search
      if (e.target.id === 'gSearch') {
        const q = e.target.value.toLowerCase().trim();
        const res = document.getElementById('gResults');
        if (!q) { res.classList.remove('show'); return; }
        const s = Store.get();
        const items = [];
        s.players.filter(p => (p.firstName + ' ' + p.lastName).toLowerCase().includes(q)).slice(0, 5)
          .forEach(p => items.push({ label: `👤 ${p.number}. ${p.firstName} ${p.lastName}`, action: () => { App.navigate('players'); } }));
        s.trainings.filter(t => t.name.toLowerCase().includes(q)).slice(0, 5)
          .forEach(t => items.push({ label: `📋 ${t.name}`, action: () => Actions.editTraining(t.id) }));
        s.exercises.filter(e => e.name.toLowerCase().includes(q)).slice(0, 5)
          .forEach(e => items.push({ label: `🏋️ ${e.name}`, action: () => Actions.viewExercise(e.id) }));
        s.matches.filter(m => (m.opponent || '').toLowerCase().includes(q)).slice(0, 3)
          .forEach(m => items.push({ label: `🏆 vs ${m.opponent}`, action: () => Actions.viewMatch(m.id) }));
        res.innerHTML = items.length ? items.map((it, i) => `<div class="gsri" data-gsi="${i}">${sanitize(it.label)}</div>`).join('') : '<div class="gsri">Нічого не знайдено</div>';
        res._items = items;
        res.classList.add('show');
      }
    });

    document.getElementById('gResults')?.addEventListener('click', e => {
      const item = e.target.closest('[data-gsi]');
      if (!item) return;
      const items = document.getElementById('gResults')._items || [];
      const it = items[+item.dataset.gsi];
      if (it) { it.action(); document.getElementById('gResults').classList.remove('show'); document.getElementById('gSearch').value = ''; }
    });

    // Постійний input створюється StorageManager._ensureImportInput()
    try { StorageManager._ensureImportInput(); } catch (_) {}

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (isInput(e.target)) return;
      if (e.key === 'Escape') {
        if (BoardEngine.isBoardOnly) { BoardEngine.exitFullscreen(); return; }
        Modal.close();
        Store.get().activeBoard.selectedId = null;
        BoardEngine.renderTokens();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); BoardEngine.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); BoardEngine.redo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (Store.get().ui.view === 'board') BoardEngine.deleteSelected(); return; }
      if (e.key === ' ' && Store.get().ui.view === 'board') {
        e.preventDefault();
        const a = Store.get().activeBoard.anim;
        if (a.playing) BoardEngine.animPause(); else BoardEngine.animPlay();
        return;
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); StorageManager.save(); Toast.show('Збережено', 'ok'); return; }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) { Actions.newTraining(); return; }
    });

    // Prevent context menu on board for right-click delete
    document.getElementById('fieldContainer')?.addEventListener('contextmenu', e => e.preventDefault());
  }
};

/* ─── ACTIONS ───────────────────────────────────────────── */