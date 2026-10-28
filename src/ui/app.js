/** Extracted module: src/ui/app.js lines 2014-2394 — DO NOT rewrite business logic */
const App = {
  init() {
    try { (typeof CoachTools !== "undefined" && CoachTools.loadCustomArtifacts && CoachTools.loadCustomArtifacts());
    try { if (typeof ClubBot !== 'undefined') ClubBot.startScheduler(); } catch (_) {}
    TelegramManager.init(); } catch (e) { console.warn('Telegram', e); }
    try { StorageManager.init(); } catch (e) {
      console.error('Storage init failed', e);
      try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(BACKUP_KEY); } catch (_) {}
      try { StorageManager.init(); } catch (e2) { console.error(e2); }
    }
    try { if (typeof I18n !== 'undefined' && I18n.initFromStore) I18n.initFromStore();
    try { if (typeof StorageManager !== 'undefined' && StorageManager.applyRosterMigrationIfAny) StorageManager.applyRosterMigrationIfAny(); } catch (_) {} } catch (e) { console.warn('i18n', e); }
    try { this.applyBranding(); } catch (e) { console.warn('branding', e); }
    try { this.applyThemeMode((Store.get().settings || {}).theme || 'dark'); } catch (e) { console.warn('theme', e); }
    this.bindEvents();
    try { this.bindEmblemGestures(); } catch (e) { console.warn("emblem", e); }
    try {
      if (this._cdTimer) clearInterval(this._cdTimer);
      this._cdTimer = setInterval(() => { try { this.updateTrainingCountdown(); } catch (_) {} }, 30000);
    } catch (_) {}
    try { /* плаваюча навігація вимкнена — статичний сайдбар справа */ } catch (e) { console.warn('nav', e); }
    try { if (typeof AuthManager !== 'undefined') AuthManager.init(); } catch (e) { console.warn('Auth', e); }
    try { if (typeof AuthManager !== 'undefined') { AuthManager._resolveRole(); AuthManager._applyUiRole(); } } catch (_) {}
    // Server HMAC validation of Telegram initData (async — does not block first paint)
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.validateWithServer) {
        AuthManager.validateWithServer().then((res) => {
          try {
            if (res && res.source === 'server' && res.ok) {
              this.applyBranding && this.applyBranding();
              this.renderCurrent && this.renderCurrent();
            } else if (res && res.source === 'error' && (res.error === 'hash_mismatch' || res.error === 'auth_date_expired')) {
              if (typeof Toast !== 'undefined') Toast.show('Сесію Telegram не підтверджено', 'warn');
              this.renderCurrent && this.renderCurrent();
            }
          } catch (_) {}
        }).catch(() => {});
      }
    } catch (_) {}
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

  
  applyThemeMode(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    document.body.setAttribute('data-theme', t);
    try {
      const s = Store.get().settings;
      s.theme = t;
      StorageManager.save();
    } catch (_) {}
    try {
      if (typeof TelegramManager !== 'undefined' && TelegramManager.tg) {
        // не форсимо TG theme — лише наш UI
      }
    } catch (_) {}
  },

  toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || (Store.get().settings || {}).theme || 'dark';
    this.applyThemeMode(cur === 'light' ? 'dark' : 'light');
    try { Toast.show(cur === 'light' ? 'Темна тема' : 'Світла тема', 'ok'); } catch (_) {}
  },

  /** Пасхалка: тап по «Тренер» → FIFA-картка тренера (режим перегляду) */
  
  openStopwatch() {
    document.querySelectorAll('.sw-sheet-backdrop').forEach(el => el.remove());
    const backdrop = document.createElement('div');
    backdrop.className = 'sw-sheet-backdrop tg-sheet-backdrop';
    backdrop.innerHTML = `
      <div class="tg-sheet sw-sheet" role="dialog" aria-label="Секундомір">
        <div class="tg-sheet-handle"></div>
        <div class="tg-sheet-title">Секундомір</div>
        <div class="sw-display">
          <div class="sw-time" id="swSession">00:00</div>
          <div class="sw-label">Сесія</div>
        </div>
        <div class="sw-actions">
          <button type="button" class="sw-btn" data-action="timer-start">▶ Старт</button>
          <button type="button" class="sw-btn" data-action="timer-pause">⏸ Пауза</button>
          <button type="button" class="sw-btn" data-action="timer-reset">↻ Скинути</button>
          <button type="button" class="sw-btn" data-action="timer-add" data-sec="30">+30 с</button>
        </div>
        <div class="sw-display sw-display-sm">
          <div class="sw-time" id="swEx">00:00</div>
          <div class="sw-label">Вправа</div>
        </div>
        <div class="sw-actions">
          <button type="button" class="sw-btn" data-action="extimer-start">▶</button>
          <button type="button" class="sw-btn" data-action="extimer-pause">⏸</button>
          <button type="button" class="sw-btn" data-action="extimer-reset">↻</button>
        </div>
        <button type="button" class="tg-sheet-btn tg-sheet-cancel" data-sw="close">Закрити</button>
      </div>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));

    const sync = () => {
      try {
        const a = document.getElementById('timerMain');
        const b = document.getElementById('timerEx');
        const sa = document.getElementById('swSession');
        const sb = document.getElementById('swEx');
        if (a && sa) sa.textContent = a.textContent || '00:00';
        if (b && sb) sb.textContent = b.textContent || '00:00';
      } catch (_) {}
    };
    sync();
    const iv = setInterval(sync, 250);
    const close = () => {
      clearInterval(iv);
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 220);
    };
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.closest('[data-sw="close"]')) close();
    });
    try { TelegramManager.haptic && TelegramManager.haptic('light'); } catch (_) {}
  },

  openCoachCard() {
    /* achievements + attendance via CoachTools */
    const s = (typeof Store !== 'undefined' && Store.get()) || {};
    const set = s.settings || {};
    const name = (set.coachName && String(set.coachName).trim()) || 'Artem Serdiuk';
    let photo = set.coachPhoto || set.coachPhotoUrl || '';
    try {
      // Фото з Telegram лише якщо сесія — тренер (інакше підтягнеться аватар гравця)
      const isCoachSession = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
      if (!photo && isCoachSession && AuthManager.user) {
        photo = AuthManager.user.photo_url || AuthManager.user.photoUrl || '';
      }
      if (!photo && isCoachSession && typeof TelegramManager !== 'undefined' && TelegramManager.tg) {
        const u = TelegramManager.tg.initDataUnsafe && TelegramManager.tg.initDataUnsafe.user;
        if (u && u.photo_url) photo = u.photo_url;
      }
    } catch (_) {}
    const initials = (name || 'AS').split(/\s+/).map(p => p[0] || '').join('').slice(0, 2).toUpperCase() || 'AS';
    const photoHtml = photo
      ? '<img src="'+String(photo).replace(/"/g,'&quot;')+'" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.style.display=\'grid\')"/><div class="cc-photo-ph" style="display:none">'+initials+'</div>'
      : '<div class="cc-photo-ph">'+initials+'</div>';

    // Real coach stats
    const todayStr = (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
    const trs = s.trainings || [];
    const past = trs.filter(t => t.status === 'done' || ((t.date || '') < todayStr && t.status !== 'cancelled' && t.status !== 'canceled' && t.status !== 'draft'));
    const planned = trs.filter(t => t.status === 'planned' || ((t.date || '') >= todayStr && t.status !== 'draft' && t.status !== 'cancelled'));
    const totalMin = past.reduce((a, t) => a + (t.duration || 0), 0);
    let attPresent = 0, attTotal = 0;
    past.forEach(t => {
      const att = t.attendance || {};
      Object.keys(att).forEach(pid => {
        attTotal++;
        if (att[pid] && att[pid].present !== false) attPresent++;
      });
    });
    const attPct = (typeof CoachTools !== 'undefined' && CoachTools.coachAttendanceRate) ? CoachTools.coachAttendanceRate() : 100;
    const ach = (typeof CoachTools !== 'undefined' && CoachTools.getCoachAchievements)
      ? CoachTools.getCoachAchievements() : null;
    const cs = set.coachStats || { appMs: 0, boardMs: 0 };
    if (ach) { cs.appMs = ach.appMs; cs.boardMs = ach.boardMs; }
    const appTime = (typeof App !== 'undefined' && App.formatDurationMs) ? App.formatDurationMs(cs.appMs || 0) : '—';
    const boardTime = (typeof App !== 'undefined' && App.formatDurationMs) ? App.formatDurationMs(cs.boardMs || 0) : '—';
    const boardsN = (s.boards || []).length;
    const playersN = (s.players || []).length;

    document.querySelectorAll('.coach-card-overlay').forEach(el => el.remove());
    const ov = document.createElement('div');
    ov.className = 'coach-card-overlay';
    ov.innerHTML = `
      <div class="coach-card-fifa" role="dialog" aria-label="Картка тренера">
        <div class="cc-glow"></div>
        <div class="cc-frame">
          <div class="cc-rating">${Math.min(99, 70 + Math.min(29, past.length))}</div>
          <div class="cc-pos">HEAD COACH</div>
          <div class="cc-photo">${photoHtml}</div>
          <div class="cc-club">METALIST STUTTGART</div>
          <div class="cc-name">${(typeof sanitize==='function'?sanitize(name):name).toUpperCase()}</div>
          <div class="cc-stats">
            <div class="cc-stat"><span>Тренувань</span><b>${past.length}</b></div>
            <div class="cc-stat"><span>План</span><b>${planned.length}</b></div>
            <div class="cc-stat"><span>Хв сесій</span><b>${totalMin}</b></div>
            <div class="cc-stat"><span>Відвідув.</span><b>${attPct}%</b></div>
            <div class="cc-stat"><span>У додатку</span><b>${appTime}</b></div>
            <div class="cc-stat"><span>На дошці</span><b>${boardTime}</b></div>
            <div class="cc-stat"><span>Схеми</span><b>${boardsN}</b></div>
            <div class="cc-stat"><span>Склад</span><b>${playersN}</b></div>
          </div>
          <div class="cc-traits">
            <span>★ Головний тренер</span>
            <span>◆ Тактика</span>
            <span>◆ Розвиток гравців</span>
          </div>
          <button type="button" class="cc-back" data-action="close-coach-card">Повернутися</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    document.body.classList.add('coach-card-mode');
    try { TelegramManager.haptic && TelegramManager.haptic('medium'); } catch (_) {}
  },

  closeCoachCard() {
    document.querySelectorAll('.coach-card-overlay').forEach(el => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 280);
    });
    document.body.classList.remove('coach-card-mode');
  },

  
  bindEmblemGestures() {
    const el = document.getElementById('club-logo-btn');
    if (!el || el._emblemBound) return;
    el._emblemBound = true;
    const HOLD_MS = 5000;
    let timer = null;
    let startX = 0, startY = 0, moved = false;
    const progress = document.getElementById('emblemProgress');

    const clear = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      el.classList.remove('holding');
      if (progress) { progress.hidden = true; progress.style.setProperty('--p', '0'); }
    };

    const onDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      moved = false;
      startX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
      startY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
      el.classList.add('holding');
      if (progress) {
        progress.hidden = false;
        progress.style.setProperty('--p', '0');
        // CSS animation driven by holding class
      }
      timer = setTimeout(() => {
        timer = null;
        el.classList.remove('holding');
        if (progress) progress.hidden = true;
        // Easter egg: 5s hold
        try { this.openCoachCard(); } catch (err) { console.error(err); }
        try { TelegramManager.haptic && TelegramManager.haptic('success'); } catch (_) {}
      }, HOLD_MS);
    };

    const onMove = (e) => {
      if (!timer) return;
      const x = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? startX;
      const y = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? startY;
      if (Math.abs(x - startX) > 12 || Math.abs(y - startY) > 12) {
        moved = true;
        clear();
      }
    };

    const onUp = (e) => {
      const wasHolding = !!timer;
      const didMove = moved;
      clear();
      // short tap → board (only if not long-press completed and not moved)
      if (wasHolding && !didMove) {
        e.preventDefault();
        e.stopPropagation();
        try {
          this.allowBoardOnce && this.allowBoardOnce('logo');
          this.openDefaultBoard ? this.openDefaultBoard() : this.navigate('board');
        } catch (err) {
          console.error(err);
          try { this.navigate('board'); } catch (_) {}
        }
        try { TelegramManager.haptic && TelegramManager.haptic('light'); } catch (_) {}
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', clear);
    el.addEventListener('pointerleave', (e) => { if (timer) clear(); });
  },


  openSchemePicker() {
    try {
      let names = [];
      try {
        const src = (typeof SCHEMES !== 'undefined' && SCHEMES) ? SCHEMES
          : (typeof window !== 'undefined' && window.SCHEMES) ? window.SCHEMES : null;
        if (src) names = Object.keys(src);
      } catch (_) {}
      if (!names.length) names = ['4-3-3','4-4-2','4-2-3-1','3-5-2','3-4-3','5-3-2','4-1-4-1','3-4-2-1'];
      // Prefer common + BACK3 list
      const preferred = ['4-3-3','4-4-2','4-2-3-1','4-1-4-1','3-5-2','3-4-3','3-4-2-1','5-3-2','5-4-1','4-5-1','3-2-5-atk','3-2-build'];
      const ordered = preferred.filter(n => names.includes(n)).concat(names.filter(n => !preferred.includes(n)));
      const cur = (Store.get().activeBoard && Store.get().activeBoard.scheme) || '';
      const html = '<div class="scheme-picker-grid">' + ordered.map(n =>
        '<button type="button" class="scheme-pick-item' + (n === cur ? ' on' : '') + '" data-action="apply-scheme" data-scheme="' + n + '">' +
        '<span class="scheme-pick-name">' + n + '</span></button>'
      ).join('') + '</div>';
      if (typeof Modal !== 'undefined' && Modal.open) {
        Modal.open('Тактична схема / розстановка', html, [{ label: 'Закрити', cls: 'btn-s', action: 'cancel' }]);
      }
    } catch (err) {
      console.error('[openSchemePicker]', err);
      if (typeof Toast !== 'undefined') Toast.show('Не вдалося відкрити схеми', 'err');
    }
  },

  openFieldViewPicker() {
    try {
      const opts = [
        { id: 'full', label: 'Повне поле' },
        { id: 'half', label: 'Половина' },
        { id: 'attack', label: 'Атакувальна третина' },
        { id: 'defense', label: 'Оборонна третина' }
      ];
      const cur = (Store.get().activeBoard && Store.get().activeBoard.fieldView) || 'full';
      const html = '<div class="scheme-picker-grid">' + opts.map(o =>
        '<button type="button" class="scheme-pick-item' + (o.id === cur ? ' on' : '') + '" data-action="apply-field-view" data-field-view="' + o.id + '">' +
        '<span class="scheme-pick-name">' + o.label + '</span></button>'
      ).join('') + '</div>';
      if (typeof Modal !== 'undefined' && Modal.open) {
        Modal.open('Вид поля', html, [{ label: 'Закрити', cls: 'btn-s', action: 'cancel' }]);
      }
    } catch (err) {
      console.error('[openFieldViewPicker]', err);
      if (typeof Toast !== 'undefined') Toast.show('Не вдалося відкрити вид поля', 'err');
    }
  },

  openDefaultBoard() {
    try {
      if (typeof StorageManager !== 'undefined' && StorageManager.isIoLocked && StorageManager.isIoLocked()) {
        console.warn('[openDefaultBoard] blocked during IO');
        try { Toast.show('Зачекайте завершення імпорту/експорту', 'warn'); } catch (_) {}
        return;
      }
      const s = Store.get();
      if (!s) {
        this.allowBoardOnce('logo');
        this.navigate('board');
        return;
      }
      // Завжди відкриваємо ПОТОЧНУ дошку (або порожню). Схему НЕ нав'язуємо.
      if (!s.activeBoard) {
        s.activeBoard = { objects: [], selectedId: null, tool: 'select', fieldView: 'full' };
      }
      if (!Array.isArray(s.activeBoard.objects)) s.activeBoard.objects = [];
      s.activeBoard.selectedId = null;
      // скинути «мертві» UI-стани, що блокують кліки
      try {
        document.body.classList.remove('coach-card-mode', 'drawer-open');
        document.querySelectorAll('.coach-card-overlay, .tg-sheet-backdrop, #tgActionSheet').forEach(el => el.remove());
      } catch (_) {}
      this.allowBoardOnce('logo');
      this.navigate('board');
      setTimeout(() => {
        try {
          if (typeof BoardEngine !== 'undefined') {
            if (BoardEngine.render) BoardEngine.render();
            if (BoardEngine.fitField) BoardEngine.fitField();
            if (BoardEngine.renderToolbar) BoardEngine.renderToolbar();
          }
        } catch (_) {}
      }, 80);
      const n = (s.activeBoard.objects || []).length;
      try { Toast.show(n ? ('Дошка · ' + n + ' об\'єктів') : 'Порожня дошка', 'ok'); } catch (_) {}
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
          let name = AuthManager.displayName() || '';
          name = String(name)
            .replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g,'')
            .replace(/[\uFE00-\uFE0F]/g,'')
            .replace(/[\u2600-\u27BF]/g,'')
            .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g,'')
            .replace(/[\u2600-\u26FF]/g,'')
            .replace(/\s+/g,' ').trim();
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
      if (s.logoData && String(s.logoData).startsWith('data:image/')) {
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
    /* ORDER_LOCK_NO_DRAG: top/bottom toolbars are static in flex layout */
    if (document.getElementById('boardToolbarTop') || document.getElementById('boardToolbarBottom')) {
      return;
    }

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
  _boardNavReasons: new Set(['logo', 'preset', 'scheme', 'board-tpl', 'load-board', 'b3-phase', 'special', 'diary-board', 'training-board', 'board-link', 'coach-tools', 'tg-main', 'anim-board', 'myex-board']), // logo + explicit tactical presets only
  allowBoardOnce(reason) {
    this._boardNavToken = reason || 'explicit';
  },

  _bindPlayerCompare() {
    const sel = document.getElementById('playerCompareSel');
    if (!sel) return;
    // Завжди переприв'язуємо (clone) — надійно в модалці Telegram WebView
    if (sel._msCmpBound && sel._msCmpHandler) {
      try { sel.removeEventListener('change', sel._msCmpHandler); } catch (_) {}
    }
    const onChange = () => {
      const oid = (document.getElementById('playerCompareSel') || sel).value || '';
      try {
        window.__playerCompareId = oid;
        window.__coachCompareId = oid;
        window.__fifaCompareId = oid;
      } catch (_) {}
      let pid = window.__coachCardPlayerId || null;
      if (!pid) {
        const host = document.querySelector('[data-compare-host], [data-fifa-player], [data-compare-root], [data-compare-me]');
        pid = host && (
          host.getAttribute('data-compare-host') ||
          host.getAttribute('data-fifa-player') ||
          host.getAttribute('data-compare-root') ||
          host.getAttribute('data-compare-me')
        );
      }
      if (!pid) {
        const s2 = document.getElementById('playerCompareSel');
        pid = s2 && s2.getAttribute('data-compare-me');
      }
      if (!pid || typeof Views === 'undefined') return;
      const me = (Store.get().players || []).find(x => x.id === pid);
      if (!me) return;
      // Оновлення ТІЛЬКИ блоку результатів — без перезавантаження модалки
      const hostEl = document.getElementById('compareResultHost');
      if (hostEl && Views._compareResultHtml) {
        hostEl.innerHTML = Views._compareResultHtml(me, oid);
        try { if (typeof TelegramManager !== 'undefined' && TelegramManager.haptic) TelegramManager.haptic('light'); } catch (_) {}
        return;
      }
      // Fallback: повний ререндер картки
      try {
        const asCoach = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
        let html = '', title = '';
        if (asCoach && Views.coachPlayerDetail) {
          title = 'Картка гравця · ' + (me.lastName || me.firstName || '');
          html = '<div class="fifa-modal-wrap" data-compare-host="' + pid + '">' + Views.coachPlayerDetail(pid) + '</div>';
        } else if (Views._fifaCard) {
          const st = Views._playerStats ? Views._playerStats(pid) : {};
          title = 'FIFA-картка · ' + (me.lastName || me.firstName || '');
          html = '<div class="fifa-modal-wrap" data-compare-host="' + pid + '">' + Views._fifaCard(me, st) + '</div>';
        }
        if (html && typeof Modal !== 'undefined' && Modal.open) {
          Modal.open(title, html, [{ label: 'Закрити', cls: 'btn-s', action: 'cancel' }]);
          setTimeout(() => {
            try {
              const s2 = document.getElementById('playerCompareSel');
              if (s2) { s2.value = oid; App._bindPlayerCompare(); }
            } catch (_) {}
          }, 50);
        }
      } catch (err) { console.warn('[compare fallback]', err); }
    };
    sel._msCmpHandler = onChange;
    sel._msCmpBound = true;
    sel.addEventListener('change', onChange);
  },

  handleTelegramBack() {
    try {
      // спочатку закрити sheet / modal
      if (document.getElementById('tgActionSheet')) {
        document.getElementById('tgActionSheet')?.remove();
        document.getElementById('tgActionBackdrop')?.remove();
        return;
      }
      if (document.getElementById('modal')?.classList.contains('show') ||
          document.querySelector('#modal.on, .modal.show, .md.show')) {
        try { Modal.close(); } catch (_) {}
        return;
      }
      // drawer
      if (document.body.classList.contains('drawer-open') || document.getElementById('sidebar')?.classList.contains('open')) {
        try { this.closeDrawer && this.closeDrawer(); } catch (_) {
          document.body.classList.remove('drawer-open');
          document.getElementById('sidebar')?.classList.remove('open');
        }
        return;
      }
      if (Store.get().ui.view === 'board') {
        this.navigate('dashboard');
        return;
      }
      const prev = TelegramManager.popView();
      this.navigate(prev, { fromBack: true });
    } catch (e) {
      console.warn('[back]', e);
      this.navigate('dashboard');
    }
  },

  navigate(view) {
    // Aliases for dashboard pills / legacy links
    if (view === 'schemes' || view === 'scheme') view = 'tactics';
    if (view === 'stats' || view === 'statistics') view = 'analytics';
    if (view === 'squad' || view === 'roster') view = 'players';
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
    try { this.closeDrawer && this.closeDrawer(); } catch (_) {}
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
    try {
      const opts = arguments[1] || {};
      if (!opts.fromBack && typeof TelegramManager !== 'undefined') {
        if (view === 'dashboard') TelegramManager.resetStack('dashboard');
        else TelegramManager.pushView(view);
      }
      if (typeof TelegramManager !== 'undefined' && TelegramManager.syncChromeForView) {
        TelegramManager.syncChromeForView(view);
      }
      if (typeof TelegramManager !== 'undefined' && TelegramManager.haptic) {
        TelegramManager.haptic('select');
      }
    } catch (_) {}
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
      // iOS Telegram: viewport settles after expand — refit stage 2×
      const refit = () => {
        try {
          if (typeof BoardEngine !== 'undefined') {
            BoardEngine._sizeStageToPitch && BoardEngine._sizeStageToPitch();
            BoardEngine.applyCamera && BoardEngine.applyCamera();
            BoardEngine.renderTokens && BoardEngine.renderTokens();
            BoardEngine.renderDrawings && BoardEngine.renderDrawings();
            BoardEngine.renderToolbar && BoardEngine.renderToolbar();
          }
        } catch (_) {}
      };
      requestAnimationFrame(() => { refit(); setTimeout(refit, 120); setTimeout(refit, 400); });
    } else {
      // Вихід з дошки — завжди знімаємо FS/board-only і лоток інструментів
      try { if (typeof BoardEngine !== 'undefined' && BoardEngine.leaveBoardMode) BoardEngine.leaveBoardMode(); } catch (_) {}
      try { if (typeof BoardEngine !== 'undefined' && BoardEngine.closeToolsTray) BoardEngine.closeToolsTray(true); } catch (_) {}
      document.body.classList.remove(
        'board-workspace', 'mode-board-focus', 'board-only-mode', 'board-fs-nav',
        'bw-nav', 'bw-props', 'bw-tools-collapsed', 'bw-nav-hide', 'present-mode',
        'tools-tray-open', 'bench-collapsed'
      );
      // прибрати orphan tray з body
      try {
        const tray = document.getElementById('btbToolsTray');
        if (tray && tray.parentElement === document.body) tray.remove();
        document.querySelectorAll('body > .btb-tray').forEach(el => el.remove());
      } catch (_) {}
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

  formatNextTr(t) {
    if (!t) return '—';
    let name = String(t.name || 'Тр.').replace(/^Тренування\s*/i, 'Тр. ');
    if (name.length > 16) name = name.slice(0, 14) + '…';
    return name;
  },
  updateTrainingCountdown() {
    try {
      const el = document.getElementById('nextTr');
      const sub = document.getElementById('nextTrCountdown');
      const s = Store.get();
      const next = (s.trainings || []).filter(x => x.status === 'planned' && x.date >= (typeof today === 'function' ? today() : '')).sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.time||'').localeCompare(String(b.time||'')))[0];
      if (!next) {
        if (el) el.textContent = '—';
        if (sub) sub.textContent = '';
        return;
      }
      const name = this.formatNextTr ? this.formatNextTr(next) : (next.name || 'Тр.');
      if (el) { el.textContent = name; el.title = (next.name || '') + ' · ' + (next.date || '') + ' ' + (next.time || ''); }
      // countdown
      try {
        const [hh, mm] = String(next.time || '18:00').split(':').map(Number);
        const dt = new Date(next.date + 'T00:00:00');
        if (!isNaN(hh)) dt.setHours(hh || 0, mm || 0, 0, 0);
        const ms = dt.getTime() - Date.now();
        let cd = '';
        if (ms > 0) {
          const h = Math.floor(ms / 3600000);
          const m = Math.floor((ms % 3600000) / 60000);
          cd = h > 48 ? (Math.floor(h/24) + 'д') : (h + 'г ' + m + 'хв');
        } else if (ms > -7200000) cd = 'зараз';
        else cd = '';
        if (sub) sub.textContent = cd ? ('через ' + cd) : (next.date || '');
      } catch (_) { if (sub) sub.textContent = next.date || ''; }
    } catch (_) {}
  },
  updateNextTrLabel() {
    try {
      const el = document.getElementById('nextTr');
      if (!el) return;
      const s = Store.get();
      const next = (s.trainings || []).filter(x => x.status === 'planned' && x.date >= (typeof today === 'function' ? today() : '')).sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0];
      el.textContent = next ? this.formatNextTr(next) : '—';
      el.title = next ? ((next.name || '') + ' · ' + (next.date || '')) : '';
    } catch (_) {}
  },
  checkBirthdays() {
    try {
      const todayStr = (typeof today === 'function') ? today() : new Date().toISOString().slice(0,10);
      const md = todayStr.slice(5); // MM-DD
      const list = (Store.get().players || []).filter(p => p.birthDate && String(p.birthDate).slice(5,10) === md);
      if (!list.length) return;
      const names = list.map(p => ((p.firstName||'') + ' ' + (p.lastName||'')).trim() || ('#'+p.number)).join(', ');
      const html = `<div class="bday-greet">
        <div class="bday-balloon">🎂</div>
        <h2>З Днем народження!</h2>
        <p>${sanitize(names)}</p>
        <p class="note-sm">МЕТАЛІСТ ШТУТГАРТ вітає</p>
      </div>`;
      if (typeof Modal !== 'undefined' && Modal.open) {
        Modal.open('Свято', html, [{ label: '🎉 Дякуємо', cls: 'btn-p', action: 'cancel' }]);
      }
      try { TelegramManager.haptic && TelegramManager.haptic('success'); } catch (_) {}
    } catch (_) {}
  },
  /* ── Облік часу в додатку / на дошці (для картки тренера) ── */
  _usageTimer: null,
  startUsageTracker() {
    if (this._usageTimer) return;
    const tick = () => {
      try {
        const s = Store.get();
        if (!s) return;
        s.settings = s.settings || {};
        const st = s.settings.coachStats || { appMs: 0, boardMs: 0 };
        st.appMs = (st.appMs || 0) + 15000;
        const view = (s.ui && s.ui.view) || '';
        if (view === 'board') st.boardMs = (st.boardMs || 0) + 15000;
        st.updatedAt = new Date().toISOString();
        s.settings.coachStats = st;
        // тихе збереження раз на ~2 хв
        if (!this._usageSaveAt || Date.now() - this._usageSaveAt > 120000) {
          this._usageSaveAt = Date.now();
          try { StorageManager.save(); } catch (_) {}
        }
      } catch (_) {}
    };
    this._usageTimer = setInterval(tick, 15000);
    // first soft tick after 15s
  },
  formatDurationMs(ms) {
    ms = Math.max(0, Number(ms) || 0);
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h <= 0) return m + ' хв';
    return h + ' год ' + m + ' хв';
  },
  syncRoleClass() {
    try {
      document.body.classList.remove('role-coach', 'role-player', 'role-guest');
      if (typeof AuthManager !== 'undefined') {
        if (AuthManager.isCoach && AuthManager.isCoach()) document.body.classList.add('role-coach');
        else if (AuthManager.isPlayer && AuthManager.isPlayer()) document.body.classList.add('role-player');
        else document.body.classList.add('role-guest');
      }
    } catch (_) {}
  },
  renderCurrent() {
    try { this.startUsageTracker(); } catch (_) {}
    try { this.syncRoleClass(); } catch (_) {}
    try { if (!this._bdayChecked) { this._bdayChecked = true; this.checkBirthdays(); } } catch (_) {}
    try { this.updateTrainingCountdown(); } catch (_) {}
    try { this.updateNextTrLabel(); } catch (_) {}

    try {
      const v = (Store.get().ui && Store.get().ui.view) || 'dashboard';
      document.body.classList.toggle('board-on', v === 'board');
      document.body.classList.toggle('board-active', v === 'board');
    } catch (_) {}

    const view = (Store.get().ui && Store.get().ui.view) || 'dashboard';
    if (view === 'board') {
      try {
        BoardEngine.renderToolbar();
        BoardEngine.render();
        this.initBoardToolbarDrag();
      } catch (e) { console.error('[board render]', e); }
      return;
    }
    // Не на дошці — гарантовано ховаємо лоток інструментів (баг: панель «липла» до меню)
    try {
      if (typeof BoardEngine !== 'undefined' && BoardEngine.closeToolsTray) BoardEngine.closeToolsTray(true);
      document.body.classList.remove('tools-tray-open');
      document.querySelectorAll('body > #btbToolsTray, body > .btb-tray').forEach(el => el.remove());
    } catch (_) {}
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
      if (view === 'settings' || view === 'dashboard') {
        try {
          const tgLine = document.getElementById('tgStatusLine');
          if (tgLine && typeof TelegramManager !== 'undefined') {
            const on = TelegramManager.isTelegram;
            const u = TelegramManager.getUser && TelegramManager.getUser();
            tgLine.textContent = on
              ? ('Telegram: ' + TelegramManager.platform() + (u ? ' · @' + (u.username || u.first_name || '') : '') + ' · Cloud ' + (TelegramManager.tg && TelegramManager.tg.CloudStorage ? '✓' : '—'))
              : 'Браузерний режим (Telegram Cloud недоступний)';
          }
        } catch (_) {}
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
    // Компактно: дата + HH:MM (без секунд — не обрізається в пігулці)
    if (el) {
      const d = now.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
      const t = now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
      el.innerHTML = '<strong>' + d + '</strong> · ' + t;
    }
    const s = Store.get();
    const next = (s.trainings || []).filter(t => t.status === 'planned' && t.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const nt = document.getElementById('nextTr');
    const cdEl = document.getElementById('nextTrCountdown');
    if (next) {
      const short = this.formatNextTr ? this.formatNextTr(next) : (next.name || 'Тр.');
      if (nt) {
        nt.textContent = short;
        nt.title = (next.name || '') + ' · ' + (next.date || '') + (next.time ? ' ' + next.time : '');
      }
      if (cdEl) {
        try {
          const dt = new Date(next.date + 'T' + (next.time || '10:00'));
          const diff = dt - now;
          if (diff > 0) {
            const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
            cdEl.textContent = 'через ' + h + 'г ' + m + 'хв';
          } else cdEl.textContent = next.date || '';
        } catch (_) { cdEl.textContent = next.date || ''; }
      }
    } else {
      if (nt) { nt.textContent = '—'; nt.title = ''; }
      if (cdEl) cdEl.textContent = '';
    }
  },


  /* ═══ Telegram-style long-press меню тренування ═══ */
  _lpTimer: null,
  _lpTarget: null,
  _lpMoved: false,

  openTrainingActionSheet(trainingId) {
    const t = (Store.get().trainings || []).find(x => x.id === trainingId);
    if (!t) return;
    const cancelled = t.status === 'cancelled' || t.status === 'canceled';
    const isCoach = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    // прибрати старий sheet
    document.getElementById('tgActionSheet')?.remove();
    document.getElementById('tgActionBackdrop')?.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'tgActionBackdrop';
    backdrop.className = 'tg-sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.id = 'tgActionSheet';
    sheet.className = 'tg-sheet';
    // План + статистика (для всіх)
    const struct = (t.structure || []).map(b =>
      '<div class="tr-plan-row"><span>' + (typeof sanitize === 'function' ? sanitize(b.title || b.name || 'Блок') : (b.title || b.name || 'Блок')) + '</span><b>' + (b.duration || 0) + ' хв</b></div>'
    ).join('');
    const totalMin = (t.structure || []).reduce((a, b) => a + (b.duration || 0), 0) || t.duration || 0;
    const load = (typeof LoadModel !== 'undefined' && LoadModel.sessionLoad) ? LoadModel.sessionLoad(t.duration || totalMin, t.intensity) : ((t.duration || totalMin) * (t.intensity || 0));
    // attendance stats for this session
    let attPresent = 0, attTotal = 0, avgRpe = 0, rpeN = 0;
    try {
      const att = t.attendance || {};
      Object.keys(att).forEach(pid => {
        attTotal++;
        if (att[pid] && att[pid].present !== false) attPresent++;
        if (att[pid] && att[pid].rpe != null) { avgRpe += +att[pid].rpe; rpeN++; }
      });
      if (rpeN) avgRpe = Math.round((avgRpe / rpeN) * 10) / 10;
    } catch (_) {}
    const attPct = attTotal ? Math.round(attPresent / attTotal * 100) : null;
    const statsBlock = `
      <div class="tr-stats-grid">
        <div class="tr-stat"><b>${totalMin}</b><span>хв плану</span></div>
        <div class="tr-stat"><b>${t.intensity != null ? t.intensity : '—'}</b><span>RPE план</span></div>
        <div class="tr-stat"><b>${load || '—'}</b><span>Load</span></div>
        <div class="tr-stat"><b>${attPct != null ? attPct + '%' : '—'}</b><span>' + (typeof I18n!=='undefined'?I18n.t('longpress_attendance','Відвідування'):'Відвідування') + '</span></div>
        <div class="tr-stat"><b>${rpeN ? avgRpe : '—'}</b><span>Сер. RPE</span></div>
        <div class="tr-stat"><b>${attPresent}/${attTotal || '—'}</b><span>Було</span></div>
      </div>`;
    const planBlock = `
      <div class="tg-sheet-preview tr-plan-preview">
        ${t.mainGoal ? ('<div class="tr-goal">🎯 ' + (typeof sanitize === 'function' ? sanitize(t.mainGoal) : t.mainGoal) + '</div>') : ''}
        <div class="tr-plan-title">${(typeof I18n!=='undefined'?I18n.t('scheme_training','План тренування'):'План тренування')}</div>
        ${struct || ('<div class="note-sm">' + (typeof I18n!=='undefined'?I18n.t('no_trainings','Структура не задана'):'Структура не задана') + '</div>')}
        ${statsBlock}
      </div>`;
    const coachActions = isCoach ? `
      <button type="button" class="tg-sheet-btn" data-sheet-act="edit" data-tid="${t.id}">✏️ ' + (typeof I18n!=='undefined'?I18n.t('sheet_edit','Редагувати'):'Редагувати') + '</button>
      <button type="button" class="tg-sheet-btn" data-sheet-act="attendance" data-tid="${t.id}">✓ ${(typeof I18n!=='undefined'?I18n.t('sheet_attendance','Відвідування'):'Відвідування')}</button>
      <button type="button" class="tg-sheet-btn" data-sheet-act="dup" data-tid="${t.id}">⧉ ${(typeof I18n!=='undefined'?I18n.t('sheet_dup','Дубль / копія'):'Дубль / копія')}</button>
      <button type="button" class="tg-sheet-btn" data-sheet-act="open-board" data-tid="${t.id}">⚽ ${(typeof I18n!=='undefined'?I18n.t('open_board','Відкрити дошку'):'Відкрити дошку')}</button>
      <button type="button" class="tg-sheet-btn" data-sheet-act="attach-board" data-tid="${t.id}">📌 ' + (typeof I18n!=='undefined'?I18n.t('sheet_attach','Прикріпити поточну дошку'):'Прикріпити поточну дошку') + '</button>
      ${cancelled
        ? `<button type="button" class="tg-sheet-btn" data-sheet-act="restore" data-tid="${t.id}">↩ ${(typeof I18n!=='undefined'?I18n.t('planned','Відновити'):'Відновити')}</button>`
        : `<button type="button" class="tg-sheet-btn tg-sheet-warn" data-sheet-act="cancel" data-tid="${t.id}">🚫 ${(typeof I18n!=='undefined'?I18n.t('sheet_cancel_tr','Скасувати тренування'):'Скасувати тренування')}</button>`}
      <button type="button" class="tg-sheet-btn tg-sheet-danger" data-sheet-act="delete" data-tid="${t.id}">🗑 ' + (typeof I18n!=='undefined'?I18n.t('sheet_delete','Видалити'):'Видалити') + '</button>
    ` : `
      <button type="button" class="tg-sheet-btn" data-sheet-act="open-board" data-tid="${t.id}">⚽ ${(typeof I18n!=='undefined'?I18n.t('open_board','Переглянути дошку'):'Переглянути дошку')}</button>
    `;
    sheet.innerHTML = `
      <div class="tg-sheet-handle"></div>
      <div class="tg-sheet-title">${typeof sanitize === 'function' ? sanitize(t.name) : t.name}</div>
      <div class="tg-sheet-sub">${t.date || ''} · ${Views._trStatusLabel ? Views._trStatusLabel(t.status) : t.status}</div>
      ${planBlock}
      ${coachActions}
      <button type="button" class="tg-sheet-btn tg-sheet-cancel" data-sheet-act="close">${(typeof I18n!=='undefined'?I18n.t('close','Закрити'):'Закрити')}</button>
    `;
    sheet.className = 'tg-sheet';
    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => {
      backdrop.classList.add('show');
    });
    const close = () => {
      backdrop.classList.remove('show');
      setTimeout(() => { backdrop.remove(); }, 220);
    };
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close();
    });
    sheet.addEventListener('click', e => {
      const btn = e.target.closest('[data-sheet-act]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const act = btn.dataset.sheetAct;
      const tid = btn.dataset.tid;
      close();
      if (act === 'close') return;
      if (act === 'edit') return Actions.editTraining(tid);
      if (act === 'attendance') return Actions.openAttendance(tid);
      if (act === 'dup') return Actions.dupTraining(tid);
      if (act === 'open-board') return Actions.openTrainingBoard(tid);
      if (act === 'attach-board') return Actions.attachBoardToTraining(tid);
      if (act === 'cancel') return Actions.cancelTraining(tid);
      if (act === 'restore') {
        const tr = Store.get().trainings.find(x => x.id === tid);
        if (tr) { tr.status = 'planned'; delete tr.cancelledAt; StorageManager.save(); App.renderCurrent(); Toast.show('Відновлено як заплановане', 'ok'); }
        return;
      }
      if (act === 'delete') {
        return Modal.confirm(((typeof I18n!=='undefined'?I18n.t('confirm_del_training','Видалити тренування назавжди?'):'Видалити тренування назавжди?')), () => {
          Store.get().trainings = Store.get().trainings.filter(x => x.id !== tid);
          StorageManager.save();
          App.renderCurrent();
          Toast.show('Видалено');
        });
      }
    });
    try { TelegramManager.haptic && TelegramManager.haptic('medium'); } catch (_) {}
  },

  openSquadDialog() {
    const s = Store.get();
    const starters = (s.players || []).filter(p => p.isStarter || p.squadRole === 'starter' || (!(p.status === 'injured' || p.status === 'rehab' || p.status === 'recovery') && p.isStarter !== false));
    const injured = (s.players || []).filter(p => p.status === 'injured' || p.status === 'rehab' || p.status === 'recovery');
    const reserve = (s.players || []).filter(p => !injured.includes(p) && !starters.includes(p));
    const line = (arr) => arr.slice().sort((a,b)=>(a.number||0)-(b.number||0)).map(p =>
      '#' + (p.number||'—') + ' ' + (p.lastName || p.firstName || '') + (p.position ? ' (' + p.position + ')' : '')
    ).join('<br>') || '—';
    document.querySelectorAll('.tg-sheet-backdrop').forEach(el => el.remove());
    const backdrop = document.createElement('div');
    backdrop.className = 'tg-sheet-backdrop';
    backdrop.innerHTML = '<div class="tg-sheet" role="dialog">' +
      '<div class="tg-sheet-handle"></div>' +
      '<div class="tg-sheet-title">Склад команди</div>' +
      '<div class="tg-sheet-sub">' + (s.players||[]).length + ' гравців</div>' +
      '<div class="tg-sheet-preview"><b>Основа / у строю</b><br>' + line(starters) +
      '<br><br><b style="color:#f87171">Травма / відновлення</b><br>' + line(injured) +
      '<br><br><b>Резерв</b><br>' + line(reserve) + '</div>' +
      '<button type="button" class="tg-sheet-btn" data-sq="players">Відкрити повний список</button>' +
      '<button type="button" class="tg-sheet-btn tg-sheet-cancel" data-sq="close">Закрити</button></div>';
    document.body.appendChild(backdrop);
    requestAnimationFrame(function() { backdrop.classList.add('show'); });
    const close = function() { backdrop.classList.remove('show'); setTimeout(function(){ backdrop.remove(); }, 220); };
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) return close();
      const btn = e.target.closest('[data-sq]');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      const act = btn.dataset.sq;
      close();
      if (act === 'players') App.navigate('players');
    });
    try { TelegramManager.haptic && TelegramManager.haptic('medium'); } catch (_) {}
  },

  openPlayerActionSheet(playerId) {
    const p = (Store.get().players || []).find(x => x.id === playerId);
    if (!p) return;
    document.querySelectorAll('.tg-sheet-backdrop').forEach(el => el.remove());
    const backdrop = document.createElement('div');
    backdrop.className = 'tg-sheet-backdrop';
    const name = ((p.number != null ? '#' + p.number + ' ' : '') + (p.firstName || '') + ' ' + (p.lastName || '')).trim();
    const title = (typeof sanitize === 'function') ? sanitize(name) : name;
    backdrop.innerHTML = '<div class="tg-sheet" role="dialog">' +
      '<div class="tg-sheet-handle"></div>' +
      '<div class="tg-sheet-title">' + title + '</div>' +
      '<div class="tg-sheet-sub">' + (p.position || '') + ' · ' + (p.status || 'available') + '</div>' +
      '<button type="button" class="tg-sheet-btn" data-psheet="edit" data-pid="' + p.id + '">✏️ ' + (typeof I18n!=='undefined'?I18n.t('sheet_edit','Редагувати'):'Редагувати') + '</button>' +
      '<button type="button" class="tg-sheet-btn" data-psheet="board" data-pid="' + p.id + '">⚽ ' + (typeof I18n!=='undefined'?I18n.t('sheet_attach','Прикріпити поточну дошку'):'Прикріпити поточну дошку') + '</button>' +
      '<button type="button" class="tg-sheet-btn" data-psheet="diary" data-pid="' + p.id + '">📓 ' + (typeof I18n!=='undefined'?I18n.t('diary_title','Запис у щоденник'):'Запис у щоденник') + '</button>' +
      '<button type="button" class="tg-sheet-btn" data-psheet="starter" data-pid="' + p.id + '">⭐ ' + (typeof I18n!=='undefined'?I18n.t('starter','Основа'):'Основа') + ' / ' + (typeof I18n!=='undefined'?I18n.t('reserve','Резерв'):'Резерв') + '</button>' +
      '<button type="button" class="tg-sheet-btn tg-sheet-danger" data-psheet="delete" data-pid="' + p.id + '">🗑 ' + (typeof I18n!=='undefined'?I18n.t('sheet_delete','Видалити'):'Видалити') + '</button>' +
      '<button type="button" class="tg-sheet-btn tg-sheet-cancel" data-psheet="close">' + (typeof I18n!=='undefined'?I18n.t('close','Закрити'):'Закрити') + '</button></div>';
    document.body.appendChild(backdrop);
    requestAnimationFrame(function() { backdrop.classList.add('show'); });
    const close = function() { backdrop.classList.remove('show'); setTimeout(function() { backdrop.remove(); }, 220); };
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) return close();
      const btn = e.target.closest('[data-psheet]');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      const act = btn.dataset.psheet;
      const pid = btn.dataset.pid;
      close();
      if (act === 'close') return;
      if (act === 'edit') return Actions.editPlayer(pid);
      if (act === 'board') {
        const pl = Store.get().players.find(x => x.id === pid);
        if (!pl) return;
        if (typeof BoardLink !== 'undefined') BoardLink.attachTo(pl);
        else pl.board = { objects: JSON.parse(JSON.stringify((Store.get().activeBoard || {}).objects || [])) };
        StorageManager.save();
        Toast.show('Дошку прикріплено до гравця', 'ok');
        return;
      }
      if (act === 'diary') {
        Actions.newDiary({ withBoard: false });
        setTimeout(function() { const sel = document.getElementById('dyP'); if (sel) sel.value = pid; }, 50);
        return;
      }
      if (act === 'starter') {
        const pl = Store.get().players.find(x => x.id === pid);
        if (!pl) return;
        pl.isStarter = !pl.isStarter;
        pl.squadRole = pl.isStarter ? 'starter' : 'reserve';
        StorageManager.save();
        App.renderCurrent();
        Toast.show(pl.isStarter ? 'В основі' : 'У резерві', 'ok');
        return;
      }
      if (act === 'delete') {
        return Modal.confirm('Видалити гравця?', function() {
          Store.get().players = Store.get().players.filter(x => x.id !== pid);
          StorageManager.save();
          App.renderCurrent();
          Toast.show('Видалено');
        });
      }
    });
    try { TelegramManager.haptic && TelegramManager.haptic('medium'); } catch (_) {}
  },

  openSchemeActionSheet(boardId) {
    const b = (Store.get().boards || []).find(x => x.id === boardId);
    if (!b) return;
    document.querySelectorAll('.tg-sheet-backdrop').forEach(el => el.remove());
    const backdrop = document.createElement('div');
    backdrop.className = 'tg-sheet-backdrop';
    const bname = (typeof sanitize === 'function') ? sanitize(b.name) : b.name;
    backdrop.innerHTML = '<div class="tg-sheet" role="dialog">' +
      '<div class="tg-sheet-handle"></div>' +
      '<div class="tg-sheet-title">' + bname + '</div>' +
      '<div class="tg-sheet-sub">' + ((b.objects || []).length) + " об'єктів</div>" +
      '<button type="button" class="tg-sheet-btn" data-ssheet="open" data-bid="' + b.id + '">⚽ Відкрити на дошці</button>' +
      '<button type="button" class="tg-sheet-btn" data-ssheet="training" data-bid="' + b.id + '">📋 Прикріпити до тренування</button>' +
      '<button type="button" class="tg-sheet-btn" data-ssheet="player" data-bid="' + b.id + '">👤 Прикріпити до гравця</button>' +
      '<button type="button" class="tg-sheet-btn" data-ssheet="diary" data-bid="' + b.id + '">📓 Прикріпити до щоденника</button>' +
      '<button type="button" class="tg-sheet-btn tg-sheet-danger" data-ssheet="delete" data-bid="' + b.id + '">🗑 ' + (typeof I18n!=='undefined'?I18n.t('sheet_delete','Видалити'):'Видалити') + '</button>' +
      '<button type="button" class="tg-sheet-btn tg-sheet-cancel" data-ssheet="close">Закрити</button></div>';
    document.body.appendChild(backdrop);
    requestAnimationFrame(function() { backdrop.classList.add('show'); });
    const close = function() { backdrop.classList.remove('show'); setTimeout(function() { backdrop.remove(); }, 220); };
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) return close();
      const btn = e.target.closest('[data-ssheet]');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      const act = btn.dataset.ssheet;
      const bid = btn.dataset.bid;
      const board = (Store.get().boards || []).find(x => x.id === bid);
      close();
      if (act === 'close' || !board) return;
      if (act === 'open') {
        if (typeof BoardEngine !== 'undefined' && BoardEngine.loadBoard) BoardEngine.loadBoard(bid);
        App.allowBoardOnce('load-board');
        App.navigate('board');
        return;
      }
      if (act === 'training') {
        const planned = (Store.get().trainings || []).filter(t => t.status === 'planned' || t.status === 'draft').slice(0, 8);
        if (!planned.length) { Toast.show('Немає тренувань для прикріплення', 'warn'); return; }
        const opts = planned.map(t => '<option value="' + t.id + '">' + sanitize(t.date || '') + ' · ' + sanitize(t.name) + '</option>').join('');
        Modal.open('Прикріпити схему до тренування', '<div class="fgr full"><label>Тренування</label><select id="attachTrSel">' + opts + '</select></div>', [
          { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
          { label: 'Прикріпити', cls: 'btn-p', action: 'confirm' }
        ]);
        Modal._onConfirm = function() {
          const tid = document.getElementById('attachTrSel') && document.getElementById('attachTrSel').value;
          const tr = Store.get().trainings.find(x => x.id === tid);
          if (tr) {
            tr.board = { objects: JSON.parse(JSON.stringify(board.objects || [])) };
            tr.boardId = board.id;
            StorageManager.save();
            Toast.show('Схему прикріплено до тренування', 'ok');
          }
        };
        return;
      }
      if (act === 'player') {
        const pls = (Store.get().players || []).slice().sort(function(a,b){ return (a.number||0)-(b.number||0); });
        const opts = pls.map(p => '<option value="' + p.id + '">#' + (p.number||'') + ' ' + sanitize(p.lastName||'') + '</option>').join('');
        Modal.open('Прикріпити схему до гравця', '<div class="fgr full"><label>Гравець</label><select id="attachPlSel">' + opts + '</select></div>', [
          { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
          { label: 'Прикріпити', cls: 'btn-p', action: 'confirm' }
        ]);
        Modal._onConfirm = function() {
          const pid = document.getElementById('attachPlSel') && document.getElementById('attachPlSel').value;
          const pl = Store.get().players.find(x => x.id === pid);
          if (pl) {
            pl.board = { objects: JSON.parse(JSON.stringify(board.objects || [])) };
            pl.boardId = board.id;
            StorageManager.save();
            Toast.show('Схему прикріплено до гравця', 'ok');
          }
        };
        return;
      }
      if (act === 'diary') {
        const entry = {
          id: typeof uid === 'function' ? uid() : ('d' + Date.now()),
          title: 'Схема: ' + (board.name || ''),
          category: 'Tactical Idea',
          mood: '💡',
          text: 'Збережена схема з розділу Тактика',
          playerId: '',
          tags: ['scheme'],
          board: { objects: JSON.parse(JSON.stringify(board.objects || [])) },
          boardObjCount: (board.objects || []).length,
          date: typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString()
        };
        Store.get().diary = Store.get().diary || [];
        Store.get().diary.push(entry);
        StorageManager.save();
        Toast.show('Схему збережено в щоденник', 'ok');
        App.navigate('diary');
        return;
      }
      if (act === 'delete') {
        return Modal.confirm('Видалити схему?', function() {
          Store.get().boards = Store.get().boards.filter(x => x.id !== bid);
          StorageManager.save();
          App.renderCurrent();
          Toast.show('Видалено');
        });
      }
    });
    try { TelegramManager.haptic && TelegramManager.haptic('medium'); } catch (_) {}
  },

  openNextTrainingPreview(trainingId) {
    const t = (Store.get().trainings || []).find(x => x.id === trainingId);
    if (!t) return;
    document.querySelectorAll('.tg-sheet-backdrop').forEach(el => el.remove());
    const blocks = (t.structure || []).map(b =>
      '• ' + (b.title || b.name || 'Блок') + ' — ' + (b.duration || 0) + ' хв'
    ).join('<br>') || 'Структура ще не задана';
    const backdrop = document.createElement('div');
    backdrop.className = 'tg-sheet-backdrop';
    const tname = (typeof sanitize === 'function') ? sanitize(t.name) : t.name;
    const goal = t.mainGoal ? ('🎯 ' + ((typeof sanitize === 'function') ? sanitize(t.mainGoal) : t.mainGoal) + '<br><br>') : '';
    backdrop.innerHTML = '<div class="tg-sheet" role="dialog">' +
      '<div class="tg-sheet-handle"></div>' +
      '<div class="tg-sheet-title">' + tname + '</div>' +
      '<div class="tg-sheet-sub">' + (t.date || '') + ' ' + (t.time || '') + ' · ' + (t.duration || 0) + ' хв · RPE ' + (t.intensity || '—') + '</div>' +
      '<div class="tg-sheet-preview">' + goal + blocks + '</div>' +
      '<button type="button" class="tg-sheet-btn" data-nsheet="edit" data-tid="' + t.id + '">✏️ ' + (typeof I18n!=='undefined'?I18n.t('sheet_edit','Редагувати'):'Редагувати') + '</button>' +
      '<button type="button" class="tg-sheet-btn" data-nsheet="share" data-tid="' + t.id + '">📤 Поділитися планом</button>' +
      '<button type="button" class="tg-sheet-btn" data-nsheet="board" data-tid="' + t.id + '">⚽ Дошка</button>' +
      '<button type="button" class="tg-sheet-btn tg-sheet-cancel" data-nsheet="close">Закрити</button></div>';
    document.body.appendChild(backdrop);
    requestAnimationFrame(function() { backdrop.classList.add('show'); });
    const close = function() { backdrop.classList.remove('show'); setTimeout(function() { backdrop.remove(); }, 220); };
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) return close();
      const btn = e.target.closest('[data-nsheet]');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      const act = btn.dataset.nsheet;
      close();
      if (act === 'edit') return Actions.editTraining(btn.dataset.tid);
      if (act === 'share') {
        try { if (typeof CoachTools !== 'undefined' && CoachTools.shareNextTraining) CoachTools.shareNextTraining(); } catch (_) {}
        return;
      }
      if (act === 'board') return Actions.openTrainingBoard(btn.dataset.tid);
    });
    try { TelegramManager.haptic && TelegramManager.haptic('medium'); } catch (_) {}
  },

  bindTrainingLongPress() {
    const root = document.getElementById('app') || document.body;
    if (root._lpBound) return;
    root._lpBound = true;
    const LP_MS = 480;

    const clear = () => {
      if (this._lpTimer) { clearTimeout(this._lpTimer); this._lpTimer = null; }
      if (this._lpTarget) {
        this._lpTarget.classList.remove('tg-row-holding');
        this._lpTarget = null;
      }
      this._lpMoved = false;
    };

    root.addEventListener('pointerdown', e => {
      const row = e.target.closest(
        '.card-training[data-training-id], .tg-row[data-training-id], .pl-row[data-player-id], .scheme-row[data-board-id], .sc-next-training[data-next-training], .coach-tools-handle, .sc-tap[data-view="players"]'
      );
      if (!row) return;
      if (e.target.closest('button:not(.coach-tools-handle), a, input, select, textarea')) return;
      this._lpMoved = false;
      this._lpTarget = row;
      row.classList.add('tg-row-holding');
      const kind = row.classList.contains('pl-row') ? 'player'
        : (row.matches && row.matches('.sc-tap[data-view="players"]')) ? 'squad'
        : row.classList.contains('scheme-row') ? 'scheme'
        : row.classList.contains('sc-next-training') ? 'next-training'
        : row.classList.contains('coach-tools-handle') ? 'coach-tools'
        : 'training';
      const id = row.dataset.trainingId || row.dataset.editTraining || row.dataset.playerId || row.dataset.boardId || row.dataset.nextTraining || '';
      this._lpTimer = setTimeout(() => {
        this._lpTimer = null;
        if (this._lpTarget && !this._lpMoved) {
          this._lpTarget.classList.remove('tg-row-holding');
          if (kind === 'squad') this.openSquadDialog();
          else if (kind === 'player') this.openPlayerActionSheet(id);
          else if (kind === 'scheme') this.openSchemeActionSheet(id);
          else if (kind === 'next-training') this.openNextTrainingPreview(id);
          else if (kind === 'coach-tools') {
            const body = document.querySelector('.coach-tools-body');
            if (body) body.removeAttribute('hidden');
            try { TelegramManager.haptic && TelegramManager.haptic('medium'); } catch (_) {}
          } else this.openTrainingActionSheet(id);
          this._lpTarget = null;
          this._lpSuppressClick = true;
          setTimeout(() => { this._lpSuppressClick = false; }, 400);
        }
      }, LP_MS);
    }, { passive: true });

    root.addEventListener('pointermove', e => {
      if (!this._lpTarget) return;
      // якщо палець поїхав — скасовуємо long-press (скрол)
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) {
        this._lpMoved = true;
        clear.call(this);
      }
    }, { passive: true });

    root.addEventListener('pointerup', () => clear.call(this), { passive: true });
    root.addEventListener('pointercancel', () => clear.call(this), { passive: true });
  },

  bindEvents() {
    // Прямі прив'язки (iOS / Telegram): логотип і імпорт не залежать від делегації
    try { this.bindLogoAndImport(); } catch (e) { console.warn(e); }
    try { this.bindEdgeSwipeDrawer(); } catch (e) { console.warn(e); }
    try { this.bindTrainingLongPress(); } catch (e) { console.warn(e); }



    // Event delegation — single listener
    document.addEventListener('click', e => {
      // ── Ізоляція: кліки всередині модалки / меню не повинні «випадково» відкривати дошку ──
      const inModal = e.target.closest('#modal, .md, .modal-content, #modalBody, #modalFooter');
      const inSidebarNav = e.target.closest('#sidebar .nav, .sidebar .nav, .sb-scroll');

      const t = e.target.closest('[data-action],[data-view],[data-tool],[data-ai],[data-edit-training],[data-attendance-training],[data-del-training],[data-dup-training],[data-edit-player],[data-del-player],[data-scheme],[data-load-board],[data-del-board],[data-special],[data-day],[data-view-exercise],[data-view-match],[data-del-match],[data-tpl],[data-modal-action],[data-b3-phase],[data-board-tpl],[data-b3-rot],[data-del-myex],[data-add-myex-tr],[data-load-myex-board],[data-del-diary],[data-edit-diary],[data-load-diary-board],[data-attach-diary-board],[data-diary-filter],[data-play-anim],[data-coach-tool],[data-player-sort],[data-player-id],[data-board-id],[data-next-training]');
      if (!t) {
        // close search
        if (!e.target.closest('.gs')) document.getElementById('gResults')?.classList.remove('show');
        // close modal on backdrop only
        if (e.target.id === 'modal') Modal.close();
        return;
      }

      const action = t.dataset.action;
      const view = t.dataset.view;

      // Редагування / CRUD — ніколи не відкривають дошку (без stopImmediatePropagation,
      // щоб цей самий listener міг обробити кнопки далі)
      if (t.dataset.editTraining || t.dataset.delTraining || t.dataset.dupTraining ||
          t.dataset.attendanceTraining || t.dataset.editPlayer || t.dataset.delPlayer ||
          t.dataset.editDiary || t.dataset.delDiary || t.dataset.delMyex || t.dataset.delMatch ||
          t.dataset.delBoard || t.dataset.modalAction ||
          e.target.closest('.card-training, .tg-row, #tgActionSheet')) {
        e.preventDefault();
        e.stopPropagation();
      }
      // після long-press не відкривати деталі коротким «відпусканням»
      if (this._lpSuppressClick && e.target.closest('.card-training, .tg-row')) {
        e.preventDefault();
        e.stopPropagation();
        return;
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
      if (t.dataset.tool) {
        const ab = Store.get().activeBoard;
        if (!ab) return;
        ab.tool = t.dataset.tool;
        // Після вибору інструмента з лотка — ховаємо панель (як у сучасних editor UX)
        ab.toolsTrayOpen = false;
        ab.paletteOpen = false;
        try { document.body.classList.remove('tools-tray-open'); } catch (_) {}
        try {
          if (typeof BoardEngine !== 'undefined' && BoardEngine.closeToolsTray) {
            BoardEngine.closeToolsTray(true);
          }
        } catch (_) {}
        try { BoardEngine.renderToolbar(); } catch (_) {}
        const tray = document.getElementById('btbToolsTray');
        if (tray) {
          tray.classList.remove('open');
          tray.setAttribute('aria-hidden', 'true');
        }
        try { TelegramManager.haptic && TelegramManager.haptic('selection'); } catch (_) {}
        return;
      }
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
      if (action === 'toggle-coach-tools') {
        const body = document.querySelector('.coach-tools-body');
        const handle = document.querySelector('.coach-tools-handle');
        if (body) {
          const open = body.hasAttribute('hidden');
          if (open) body.removeAttribute('hidden'); else body.setAttribute('hidden', '');
          if (handle) handle.setAttribute('aria-expanded', open ? 'true' : 'false');
          try { TelegramManager.haptic && TelegramManager.haptic('light'); } catch (_) {}
        }
        return;
      }
      if (action === 'save-board-diary') return Actions.saveBoardToDiary();
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
      if (action === 'open-default-board' && !e.target.closest('.auth-role-btn, [data-action="coach-easter"]')) {
        e.preventDefault();
        e.stopPropagation();
        App.openDefaultBoard();
        return;
      }
      
      if (action === 'apply-scheme') {
        e.preventDefault(); e.stopPropagation();
        const name = t.dataset.scheme || t.getAttribute('data-scheme');
        if (!name) return;
        try {
          if (typeof BoardEngine !== 'undefined' && BoardEngine.applyScheme) {
            BoardEngine.applyScheme(name);
          }
          if (Store.get().activeBoard) Store.get().activeBoard.scheme = name;
          const lab = document.getElementById('schemePickVal');
          if (lab) lab.textContent = name;
          try { StorageManager.save(); } catch (_) {}
          if (typeof Modal !== 'undefined') Modal.close();
          if (typeof Toast !== 'undefined') Toast.show('Схема ' + name, 'ok');
        } catch (err) {
          console.error('[apply-scheme]', err);
          if (typeof Toast !== 'undefined') Toast.show('Помилка схеми', 'err');
        }
        return;
      }
      if (action === 'apply-field-view') {
        e.preventDefault(); e.stopPropagation();
        const fv = t.dataset.fieldView || t.getAttribute('data-field-view');
        if (!fv) return;
        try {
          if (Store.get().activeBoard) Store.get().activeBoard.fieldView = fv;
          if (typeof BoardEngine !== 'undefined') {
            if (BoardEngine.drawField) BoardEngine.drawField(fv);
            if (BoardEngine.renderTokens) BoardEngine.renderTokens();
            if (BoardEngine.renderDrawings) BoardEngine.renderDrawings();
            if (BoardEngine.fitField) BoardEngine.fitField();
          }
          const labels = { full: 'Повне', half: 'Половина', attack: 'Атака', defense: 'Захист' };
          const lab = document.getElementById('fieldViewVal');
          if (lab) lab.textContent = labels[fv] || fv;
          try { StorageManager.save(); } catch (_) {}
          if (typeof Modal !== 'undefined') Modal.close();
          if (typeof Toast !== 'undefined') Toast.show('Поле: ' + (labels[fv] || fv), 'ok');
        } catch (err) {
          console.error('[apply-field-view]', err);
        }
        return;
      }

      if (action === 'pick-scheme') {
        e.preventDefault(); e.stopPropagation();
        return App.openSchemePicker();
      }
      if (action === 'pick-field-view') {
        e.preventDefault(); e.stopPropagation();
        return App.openFieldViewPicker();
      }
      if (action === 'reset-all') {
        if (typeof AuthManager !== 'undefined' && !AuthManager.can('reset-data')) {
          return Toast.show('Скидання доступне лише тренеру', 'warn');
        }
        return Modal.confirm('Скинути всі дані до демо?', () => { StorageManager.clear(); App.applyBranding(); App.navigate('dashboard'); Toast.show('Скинуто', 'ok'); });
      }
      
      if (action === 'add-artifact-json') {
        e.preventDefault(); e.stopPropagation();
        if (typeof AuthManager !== 'undefined' && AuthManager.isCoach && !AuthManager.isCoach()) {
          Toast.show('Лише тренер', 'warn'); return;
        }
        const ta = document.getElementById('artifactJsonInput');
        const raw = ta ? ta.value : '';
        if (!raw || !raw.trim()) {
          Toast.show('Вставте JSON артефакту', 'warn'); return;
        }
        try {
          const art = CoachTools.addArtifactToCatalog(raw);
          Toast.show((art.ico || '★') + ' «' + art.label + '» додано в каталог', 'ok');
          if (ta) ta.value = '';
          try { App.renderCurrent(); } catch (_) {}
        } catch (err) {
          console.error('[add-artifact]', err);
          Toast.show('Помилка JSON: ' + (err && err.message ? err.message : 'перевірте формат'), 'err');
        }
        return;
      }
      if (action === 'preview-artifacts') {
        e.preventDefault(); e.stopPropagation();
        try { CoachTools.mergeCustomCatalog && CoachTools.mergeCustomCatalog(); } catch (_) {}
        const list = (typeof CoachTools !== 'undefined' && CoachTools.GIFT_CATALOG) ? CoachTools.GIFT_CATALOG : [];
        const rarL = (CoachTools.RARITY_LABEL) || {};
        const html = '<div class="artifact-catalog-list">' + list.map(g => {
          const rl = rarL[g.rarity] || g.rarity || '';
          return '<div class="artifact-cat-row rarity-' + (g.rarity || 'common') + '" style="--art-hue:' + (g.hue || 42) + '">' +
            '<span class="ico">' + (g.ico || '★') + '</span>' +
            '<div><b>' + sanitize(g.label || g.id) + '</b><br><small>' + sanitize(rl) + ' · ' + sanitize(g.id) + '</small>' +
            (g.description ? ('<br><span class="note-sm">' + sanitize(g.description) + '</span>') : '') +
            '</div></div>';
        }).join('') + '</div>';
        if (typeof Modal !== 'undefined' && Modal.open) {
          Modal.open('Каталог артефактів (' + list.length + ')', html, [{ label: 'Закрити', cls: 'btn-s', action: 'cancel' }]);
        }
        return;
      }

      
    if (action === 'set-lang') {
      e.preventDefault(); e.stopPropagation();
      const code = t.getAttribute('data-lang') || 'uk';
      if (typeof I18n !== 'undefined' && I18n.setLang) {
        I18n.setLang(code);
        if (typeof Toast !== 'undefined') Toast.show((code === 'de' ? 'Deutsch' : 'Українська') + ' ✓', 'ok');
        try { TelegramManager.haptic && TelegramManager.haptic('light'); } catch (_) {}
      }
      return;
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
      if (action === 'edit-self-player') {
        e.preventDefault(); e.stopPropagation();
        try {
          const me = AuthManager.getLinkedPlayer && AuthManager.getLinkedPlayer();
          if (me && typeof Actions !== 'undefined' && Actions.editPlayer) Actions.editPlayer(me.id);
          else Toast.show('Профіль не прив\'язано', 'warn');
        } catch (_) {}
        return;
      }
      
      if (action === 'upload-club-logo' || action === 'upload-coach-photo') {
        e.preventDefault(); e.stopPropagation();
        if (typeof AuthManager !== 'undefined' && AuthManager.isCoach && !AuthManager.isCoach()) {
          Toast.show('Лише тренер', 'warn'); return;
        }
        const isCoach = action === 'upload-coach-photo';
        const input = document.getElementById(isCoach ? 'settingsCoachPhotoInput' : 'settingsLogoInput')
          || (() => {
            const i = document.createElement('input');
            i.type = 'file'; i.accept = 'image/*'; i.hidden = true;
            document.body.appendChild(i);
            return i;
          })();
        input.onchange = () => {
          const file = input.files && input.files[0];
          if (!file) return;
          if (file.size > 2.5e6) { Toast.show('Максимум 2.5 МБ', 'warn'); return; }
          const reader = new FileReader();
          reader.onload = () => {
            const data = reader.result;
            const s = Store.get().settings;
            if (isCoach) s.coachPhoto = data;
            else s.logoData = data;
            try { StorageManager.save(); } catch (_) {}
            try { App.applyBranding && App.applyBranding(); } catch (_) {}
            try { App.renderCurrent && App.renderCurrent(); } catch (_) {}
            Toast.show(isCoach ? 'Фото тренера оновлено' : 'Логотип оновлено', 'ok');
          };
          reader.readAsDataURL(file);
          input.value = '';
        };
        input.click();
        return;
      }

      if (action === 'open-fifa-card' || action === 'open-player-card') {
        e.preventDefault(); e.stopPropagation();
        const pid = (t.dataset && t.dataset.playerId) || t.getAttribute('data-player-id');
        const p = (Store.get().players || []).find(x => x.id === pid);
        if (!p) return;
        try { TelegramManager.haptic && TelegramManager.haptic('light'); } catch (_) {}
        // Тренер бачить повну картку «як гравець» + інструменти; гравець — лише FIFA
        const asCoach = (typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach());
        if (asCoach && typeof Views !== 'undefined' && Views.coachPlayerDetail) {
          window.__coachCardPlayerId = p.id;
          const html = Views.coachPlayerDetail(p.id);
          if (typeof Modal !== 'undefined' && Modal.open) {
            Modal.open('Картка гравця · ' + (p.lastName || p.firstName || ''), '<div class="fifa-modal-wrap" data-compare-host="' + p.id + '">' + html + '</div>', [{ label: 'Закрити', cls: 'btn-s', action: 'cancel' }]);
            setTimeout(() => { try { const s2 = document.getElementById('playerCompareSel'); if (s2) s2._msCmpBound = false; App._bindPlayerCompare(); } catch (_) {} }, 40);
          }
        } else if (typeof Views !== 'undefined' && Views._fifaCard) {
          window.__coachCardPlayerId = p.id;
          window.__fifaCompareId = window.__fifaCompareId || '';
          const st = Views._playerStats ? Views._playerStats(p.id) : {};
          const html = Views._fifaCard(p, st);
          if (typeof Modal !== 'undefined' && Modal.open) {
            Modal.open('FIFA-картка · ' + (p.lastName || p.firstName || ''),
              '<div class="fifa-modal-wrap" data-compare-host="' + p.id + '">' + html + '</div>',
              [{ label: 'Закрити', cls: 'btn-s', action: 'cancel' }]);
            setTimeout(() => {
              try {
                const s2 = document.getElementById('playerCompareSel');
                if (s2) { s2._msCmpBound = false; App._bindPlayerCompare(); }
              } catch (_) {}
            }, 40);
          }
        }
        return;
      }
      if (action === 'player-compare') {
        e.preventDefault(); e.stopPropagation();
        const sel = document.getElementById('playerCompareSel');
        const oid = sel ? sel.value : (t.value || '');
        try {
          window.__playerCompareId = oid;
          window.__coachCompareId = oid;
        } catch (_) {}
        // форсуємо оновлення через ту ж логіку, що й change
        try {
          if (sel) {
            sel._msCmpBound = false;
            App._bindPlayerCompare();
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            App.renderCurrent();
          }
        } catch (_) { try { App.renderCurrent(); } catch (__) {} }
        return;
      }
      
    if (action === 'create-emoji-artifact') {
      e.preventDefault(); e.stopPropagation();
      if (typeof Auth !== 'undefined' && Auth.role && Auth.role() !== 'coach') {
        if (typeof Toast !== 'undefined') Toast.show('Лише тренер', 'warn');
        return;
      }
      const emoji = window.prompt('Emoji (наприклад 🚀 💎 🦊):', '🚀');
      if (!emoji) return;
      const label = window.prompt('Назва артефакту:', 'Новий артефакт');
      if (!label) return;
      const anim = window.prompt('Анімація: bounce|spin|pulse|sparkle|wiggle|heartbeat|flash|sway|launch', 'bounce') || 'bounce';
      const rarity = window.prompt('Рідкість: common|rare|epic|legendary', 'rare') || 'rare';
      if (typeof CoachTools !== 'undefined' && CoachTools.createEmojiArtifact) {
        CoachTools.createEmojiArtifact({ ico: emoji, label, anim, rarity });
        if (typeof App !== 'undefined' && App.renderCurrent) App.renderCurrent();
      }
      return;
    }

    if (action === 'inspect-artifact') {
        e.preventDefault(); e.stopPropagation();
        const uid = t.dataset.giftUid || t.getAttribute('data-gift-uid');
        const s = Store.get();
        const g = (s.gifts || []).find(x => x.id === uid);
        if (!g) return;
        const rar = (typeof CoachTools !== 'undefined' && CoachTools.RARITY_LABEL && CoachTools.RARITY_LABEL[g.rarity]) || g.rarity || '';
        const isNeural = g.special === 'neural-horse' || g.giftId === 'neural_horse_tester';
        const isGolden = g.special === 'golden-ball' || g.giftId === 'tyshchenko_first_golden_ball';
        const isCrest = g.special === 'crest-seal' || g.giftId === 'grok_crest_seal_2025';
        const isCoach = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
        const attached = g.attached !== false;
        let coachBtns = '';
        if (isCoach) {
          coachBtns =
            '<div class="artifact-coach-actions">' +
            '<button type="button" class="btn btn-s btn-sm" data-action="edit-gift-note" data-gift-uid="' + uid + '">✏️ Момент</button>' +
            '<button type="button" class="btn btn-s btn-sm" data-action="toggle-attach-gift" data-gift-uid="' + uid + '">' +
              (attached ? '📎 Зняти з профілю' : '📌 На профіль') + '</button>' +
            (g.playerId ? ('<button type="button" class="btn btn-s btn-sm" data-action="set-featured-gift" data-player-id="' +
              g.playerId + '" data-gift-uid="' + uid + '">⭐ Біля імені</button>') : '') +
            '<button type="button" class="btn btn-s btn-sm btn-danger" data-action="delete-gift" data-gift-uid="' + uid + '">🗑 ' + (typeof I18n!=='undefined'?I18n.t('sheet_delete','Видалити'):'Видалити') + '</button>' +
            '</div>';
        }
        const html = '<div class="artifact-inspect' + (isNeural ? ' neural-inspect' : '') + (isGolden ? ' golden-inspect' : '') + (isCrest ? ' crest-inspect' : '') + '">' +
          '<div class="artifact-inspect-stage">' +
          '<div class="artifact-hologram' + (isNeural ? ' art-neural-horse' : (isGolden ? ' art-golden-ball' : (isCrest ? ' art-crest-seal' : ''))) + '" style="--art-hue:' + (g.hue != null ? g.hue : 42) + '">' +
          '<span class="nft-art-core"></span><span class="nft-art-ico" style="font-size:48px">' + (g.ico || '★') + '</span>' +
          '<span class="nft-art-wave"></span></div></div>' +
          '<div class="artifact-inspect-meta">' +
          '<div class="artifact-title">' + (typeof sanitize === 'function' ? sanitize(g.label) : g.label) + '</div>' +
          '<div class="artifact-rar rarity-' + (g.rarity || 'common') + '">' + rar + (g.serial ? (' · ' + g.serial) : '') +
            (attached ? ' · на профілі' : ' · у інвентарі') + '</div>' +
          (g.description ? ('<p class="artifact-desc">' + (typeof sanitize === 'function' ? sanitize(g.description) : g.description) + '</p>') : '') +
          (g.note ? ('<p class="artifact-note">«' + (typeof sanitize === 'function' ? sanitize(g.note) : g.note) + '»</p>') : '') +
          (g.momentHint && !g.note ? ('<p class="artifact-hint">' + (typeof sanitize === 'function' ? sanitize(g.momentHint) : g.momentHint) + '</p>') : '') +
          coachBtns +
          '</div></div>';
        if (typeof Modal !== 'undefined' && Modal.open) {
          Modal.open('Артефакт клубу', html, [{ label: 'Закрити', cls: 'btn-s', action: 'cancel' }]);
        }
        try { TelegramManager.haptic && TelegramManager.haptic('medium'); } catch (_) {}
        return;
      }
      if (action === 'edit-gift-note') {
        e.preventDefault(); e.stopPropagation();
        const uid = t.dataset.giftUid;
        const g = (Store.get().gifts || []).find(x => x.id === uid);
        if (!g) return;
        const cur = g.note || '';
        if (typeof Modal !== 'undefined' && Modal.prompt) {
          Modal.prompt('Пам\'ятний момент (підпис до подарунка)', cur, (v) => {
            if (v === null) return;
            if (typeof CoachTools !== 'undefined' && CoachTools.editGiftNote) CoachTools.editGiftNote(uid, v);
            try { if (typeof Modal.close) Modal.close(); } catch (_) {}
            try { App.renderCurrent(); } catch (_) {}
          });
        } else {
          const v = window.prompt('Пам\'ятний момент', cur);
          if (v !== null && typeof CoachTools !== 'undefined' && CoachTools.editGiftNote) {
            CoachTools.editGiftNote(uid, v);
            try { App.renderCurrent(); } catch (_) {}
          }
        }
        return;
      }
      if (action === 'toggle-attach-gift') {
        e.preventDefault(); e.stopPropagation();
        const uid = t.dataset.giftUid;
        if (uid && typeof CoachTools !== 'undefined' && CoachTools.toggleAttachGift) {
          CoachTools.toggleAttachGift(uid);
          try { if (typeof Modal.close) Modal.close(); } catch (_) {}
          try { App.renderCurrent(); } catch (_) {}
        }
        return;
      }
      if (action === 'delete-gift') {
        e.preventDefault(); e.stopPropagation();
        const uid = t.dataset.giftUid;
        if (!uid) return;
        const doDel = () => {
          if (typeof CoachTools !== 'undefined' && CoachTools.deleteGift) CoachTools.deleteGift(uid);
          try { if (typeof Modal.close) Modal.close(); } catch (_) {}
          try { App.renderCurrent(); } catch (_) {}
        };
        if (typeof Modal !== 'undefined' && Modal.confirm) {
          Modal.confirm('Видалити цей подарунок назавжди?', doDel);
        } else if (window.confirm('Видалити цей подарунок назавжди?')) {
          doDel();
        }
        return;
      }
      if (action === 'set-featured-gift') {
        e.preventDefault(); e.stopPropagation();
        const pid = t.dataset.playerId;
        const gid = t.dataset.giftUid;
        if (pid && gid && typeof CoachTools !== 'undefined' && CoachTools.setFeaturedGift) {
          CoachTools.setFeaturedGift(pid, gid);
          Toast.show('Подарунок біля імені оновлено', 'ok');
          // refresh open FIFA modal if any
          try {
            window.__coachCardPlayerId = pid;
            if (typeof Views !== 'undefined' && Views._fifaCard) {
              const p = (Store.get().players || []).find(x => x.id === pid);
              const st = Views._playerStats ? Views._playerStats(pid) : {};
              const asCoach = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
              let html = asCoach && Views.coachPlayerDetail
                ? Views.coachPlayerDetail(pid)
                : Views._fifaCard(p, st);
              if (typeof Modal !== 'undefined' && Modal.open) {
                Modal.open((asCoach ? 'Картка гравця' : 'FIFA-картка') + ' · ' + ((p && (p.lastName || p.firstName)) || ''),
                  '<div class="fifa-modal-wrap" data-compare-host="' + pid + '">' + html + '</div>',
                  [{ label: 'Закрити', cls: 'btn-s', action: 'cancel' }]);
              }
            }
          } catch (_) {}
          try { App.renderCurrent(); } catch (_) {}
        }
        return;
      }
      if (action === 'squad-view') {
        e.preventDefault(); e.stopPropagation();
        window.__squadViewMode = t.dataset.mode || 'list';
        try { App.renderCurrent(); } catch (_) {}
        return;
      }
      if (action === 'toggle-avatar-chips') {
        e.preventDefault(); e.stopPropagation();
        const s = Store.get();
        if (!s.activeBoard) s.activeBoard = {};
        s.activeBoard.useAvatars = !s.activeBoard.useAvatars;
        try { document.body.classList.toggle('board-avatars', !!s.activeBoard.useAvatars); } catch (_) {}
        try { StorageManager.save(); } catch (_) {}
        if (typeof BoardEngine !== 'undefined') {
          if (BoardEngine.renderTokens) BoardEngine.renderTokens();
          if (BoardEngine.renderToolbar) BoardEngine.renderToolbar();
        }
        Toast.show(s.activeBoard.useAvatars ? 'Аватар-фішки увімкнено' : 'Звичайні фішки', 'ok');
        return;
      }
      if (action === 'all-to-bench' || action === 'rest-to-bench') {
        e.preventDefault(); e.stopPropagation();
        // Тільки гравці зі складу, яких ЩЕ НЕМАЄ на полі/лавці — на лавку
        if (typeof BoardEngine !== 'undefined' && BoardEngine.sendAvailableToBench) {
          const n = BoardEngine.sendAvailableToBench();
          Toast.show(n > 0 ? (n + ' гравців зі списку на лавці') : 'Немає вільних у списку', n > 0 ? 'ok' : 'warn');
        }
        return;
      }
      if (action === 'award-gift') {
        e.preventDefault(); e.stopPropagation();
        if (typeof AuthManager !== 'undefined' && AuthManager.isCoach && !AuthManager.isCoach()) {
          Toast.show('Лише тренер може нагороджувати', 'warn'); return;
        }
        const pid = t.dataset.playerId;
        const gid = t.dataset.giftId;
        if (pid && gid && typeof CoachTools !== 'undefined' && CoachTools.awardGift) {
          // Памʼятний підпис — ТІЛЬКИ разом із подарунком
          let note = '';
          try {
            note = window.prompt('Підпис до подарунка (памʼятний момент, необовʼязково):', '') || '';
          } catch (_) { note = ''; }
          const gift = CoachTools.awardGift(pid, gid, note);
          if (note && gift && typeof CoachTools.addMoment === 'function') {
            try { CoachTools.addMoment(pid, note, gift.id); } catch (_) {}
          }
          window.__coachCardPlayerId = pid;
          if (typeof Views !== 'undefined' && Views.coachPlayerDetail && typeof Modal !== 'undefined' && Modal.open) {
            const p = (Store.get().players || []).find(x => x.id === pid);
            Modal.open('Картка гравця · ' + ((p && (p.lastName || p.firstName)) || ''),
              '<div class="fifa-modal-wrap" data-compare-host="' + pid + '">' + Views.coachPlayerDetail(pid) + '</div>',
              [{ label: 'Закрити', cls: 'btn-s', action: 'cancel' }]);
            setTimeout(() => { try { const s2 = document.getElementById('playerCompareSel'); if (s2) { s2._msCmpBound = false; App._bindPlayerCompare(); } } catch (_) {} }, 40);
          }
          try { App.renderCurrent(); } catch (_) {}
        }
        return;
      }
      if (action === 'add-moment') {
        e.preventDefault(); e.stopPropagation();
        Toast.show('Памʼятний момент додається лише з подарунком — оберіть подарунок вище', 'warn');
        return;
      }
      if (action === 'attach-gift') {
        e.preventDefault(); e.stopPropagation();
        const gid = t.dataset.giftId;
        if (gid && typeof CoachTools !== 'undefined' && CoachTools.attachGift) CoachTools.attachGift(gid);
        try { if (typeof App !== 'undefined' && App.renderCurrent) App.renderCurrent(); } catch (_) {}
        return;
      }
      if (action === 'edit-player-form') {
        e.preventDefault(); e.stopPropagation();
        const pid = t.dataset.playerId;
        if (pid && typeof Actions !== 'undefined' && Actions.editPlayer) Actions.editPlayer(pid);
        return;
      }
      if (action === 'open-stopwatch') {
        e.preventDefault(); e.stopPropagation();
        return this.openStopwatch();
      }
      if (action === 'coach-easter') {
        e.preventDefault(); e.stopPropagation();
        return this.openCoachCard();
      }
      if (action === 'open-coach-card') {
        e.preventDefault(); e.stopPropagation();
        if (typeof App !== 'undefined' && App.openCoachCard) App.openCoachCard();
        return;
      }
      if (action === 'close-coach-card') {
        e.preventDefault(); e.stopPropagation();
        return this.closeCoachCard();
      }
      if (action === 'toggle-theme') {
        e.preventDefault(); e.stopPropagation();
        const set = t.dataset.themeSet;
        if (set === 'light' || set === 'dark') return this.applyThemeMode(set);
        return this.toggleTheme();
      }
      if (action === 'board-delete-selected') {
        e.preventDefault(); e.stopPropagation();
        try {
          if (typeof BoardEngine !== 'undefined' && BoardEngine.deleteSelected) {
            const sel = Store.get().activeBoard && Store.get().activeBoard.selectedId;
            if (!sel) { Toast.show('Спочатку виберіть об\'єкт', 'warn'); return; }
            BoardEngine.deleteSelected();
            Toast.show('Видалено', 'ok');
          }
        } catch (_) {}
        return;
      }
      if (action === 'toggle-bench') {
        e.preventDefault(); e.stopPropagation();
        try {
          if (typeof BoardEngine !== 'undefined' && BoardEngine.toggleBenchCollapsed) {
            const c = BoardEngine.toggleBenchCollapsed();
            Toast.show(c ? 'Лавку згорнуто' : 'Лавка відкрита', 'ok');
          } else {
            document.body.classList.toggle('bench-collapsed');
          }
        } catch (_) {}
        return;
      }
      if (action === 'toggle-tools-tray') {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        const ab = Store.get().activeBoard;
        if (!ab) return;
        ab.toolsTrayOpen = !ab.toolsTrayOpen;
        if (ab.toolsTrayOpen) ab.paletteOpen = false;
        document.body.classList.toggle('tools-tray-open', !!ab.toolsTrayOpen);
        // Re-render toolbar so tray HTML matches state, then force-open portal
        try { BoardEngine.renderToolbar && BoardEngine.renderToolbar(); } catch (_) {}
        const tray = document.getElementById('btbToolsTray');
        if (tray) {
          tray.classList.toggle('open', !!ab.toolsTrayOpen);
          tray.setAttribute('aria-hidden', ab.toolsTrayOpen ? 'false' : 'true');
          // Portal to body so overflow:hidden parents cannot clip it (iOS Telegram)
          if (ab.toolsTrayOpen && tray.parentElement !== document.body) {
            document.body.appendChild(tray);
          }
        }
        try { TelegramManager.haptic && TelegramManager.haptic('light'); } catch (_) {}
        return;
      }
      if (action === 'toggle-palette') {
        e.preventDefault(); e.stopPropagation();
        const ab = Store.get().activeBoard;
        ab.paletteOpen = !ab.paletteOpen;
        if (ab.paletteOpen) ab.toolsTrayOpen = false;
        document.body.classList.toggle('tools-tray-open', false);
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
        try { BoardEngine.closeToolsTray && BoardEngine.closeToolsTray(true); } catch (_) {}
        try { BoardEngine.leaveBoardMode && BoardEngine.leaveBoardMode(); } catch (_) {}
        try { BoardEngine.exitFullscreen && BoardEngine.exitFullscreen(); } catch (_) {}
        document.body.classList.remove(
          'board-fs-nav', 'board-only-mode', 'mode-board-focus', 'board-workspace',
          'present-mode', 'tools-tray-open', 'bench-collapsed', 'board-on', 'board-active'
        );
        try {
          document.querySelectorAll('body > #btbToolsTray, body > .btb-tray').forEach(el => el.remove());
        } catch (_) {}
        App.navigate('dashboard');
        return;
      }
      if (action === 'toggle-menu' || action === 'open-menu' || action === 'menu') {
        try {
          if (document.body.classList.contains('drawer-open')) App.closeDrawer();
          else App.openDrawer();
        } catch (_) {}
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
        // Застарілий атрибут: відкриваємо sheet (план+статистика), не форсуємо edit
        if (this._lpSuppressClick) return;
        return this.openTrainingActionSheet(t.dataset.editTraining);
      }
      // Короткий тап по картці тренування → план + статистика (не редагування)
      if (t.dataset.trainingId && t.classList && t.classList.contains('card-training')) {
        e.preventDefault();
        e.stopPropagation();
        if (this._lpSuppressClick) return;
        return this.openTrainingActionSheet(t.dataset.trainingId);
      }
      if (t.closest && t.closest('.card-training[data-training-id]') && !t.dataset.action) {
        const row = t.closest('.card-training[data-training-id]');
        if (row && !e.target.closest('button, a, input')) {
          e.preventDefault();
          e.stopPropagation();
          if (this._lpSuppressClick) return;
          return this.openTrainingActionSheet(row.dataset.trainingId);
        }
      }
      if (t.dataset.nextTraining) {
        e.preventDefault(); e.stopPropagation();
        if (this._lpSuppressClick) return;
        return this.openNextTrainingPreview(t.dataset.nextTraining);
      }
      if (t.dataset.playerSort) {
        e.preventDefault(); e.stopPropagation();
        const s = Store.get();
        s.ui = s.ui || {};
        const key = t.dataset.playerSort;
        if (s.ui.playerSort === key) s.ui.playerSortDir = s.ui.playerSortDir === 'desc' ? 'asc' : 'desc';
        else { s.ui.playerSort = key; s.ui.playerSortDir = 'asc'; }
        try { StorageManager.save(); } catch (_) {}
        App.renderCurrent();
        return;
      }
      if (t.dataset.coachTool) {
        e.preventDefault();
        e.stopPropagation();
        try {
          if (typeof CoachTools !== 'undefined') CoachTools.handleAction(t.dataset.coachTool);
        } catch (err) { console.warn('[coach-tool]', err); }
        return;
      }
      if (t.dataset.attendanceTraining) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        return Actions.openAttendance(t.dataset.attendanceTraining);
      }
      if (action === 'open-training-board') {
        e.preventDefault(); e.stopPropagation();
        const tid = t.dataset.tid || t.getAttribute('data-tid');
        if (tid && typeof Actions !== 'undefined' && Actions.openTrainingBoard) {
          return Actions.openTrainingBoard(tid);
        }
        Modal.close();
        App.allowBoardOnce('training-board');
        App.navigate('board');
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
        e.preventDefault(); e.stopPropagation();
        BoardEngine.applyScheme(t.dataset.b3Rot);
        App.allowBoardOnce('b3-phase');
        App.navigate('board');
        Toast.show('Ротація: ' + t.dataset.b3Rot, 'ok');
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
        if (!ex) { Toast.show('Вправу не знайдено', 'warn'); return; }
        const snap = ex.board || (ex.animationId && (Store.get().animations || []).find(a => a.id === ex.animationId)?.board);
        if (snap && typeof BoardLink !== 'undefined') {
          BoardLink.openSnapshot(snap, 'myex-board');
        } else if (snap) {
          Store.get().activeBoard.objects = JSON.parse(JSON.stringify(snap.objects || []));
          App.allowBoardOnce('myex-board');
          App.navigate('board');
        } else {
          App.allowBoardOnce('myex-board');
          App.navigate('board');
          Toast.show('У вправи немає дошки — відкрито порожню', 'warn');
        }
        return;
      }
      if (t.dataset.editDiary) {
        e.preventDefault(); e.stopPropagation();
        return Actions.editDiary(t.dataset.editDiary);
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
        return Actions.openDiaryBoard(t.dataset.loadDiaryBoard);
      }
      if (t.dataset.attachDiaryBoard) {
        e.preventDefault(); e.stopPropagation();
        const d = (Store.get().diary || []).find(x => x.id === t.dataset.attachDiaryBoard);
        if (!d) return;
        if (typeof BoardLink !== 'undefined') BoardLink.attachTo(d);
        else d.board = { objects: JSON.parse(JSON.stringify((Store.get().activeBoard || {}).objects || [])) };
        d.boardObjCount = (d.board && d.board.objects) ? d.board.objects.length : 0;
        StorageManager.save();
        Toast.show('Дошку прикріплено до запису', 'ok');
        try { TelegramManager.hapticSuccess && TelegramManager.hapticSuccess(); } catch (_) {}
        App.renderCurrent();
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
          App.allowBoardOnce('anim-board'); App.navigate('board'); Toast.show('Анімацію відкрито', 'ok');
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
        const tid = t.dataset.tid;
        if (tid && Actions.openTrainingBoard) return Actions.openTrainingBoard(tid);
        Modal.close();
        App.allowBoardOnce('training-board');
        App.navigate('board');
        return;
      }
      if (t.dataset.modalAction === 'confirm') {
        const fn = Modal._onConfirm;
        Modal.close();
        if (fn) fn();
        return;
      }
      // form submits via modal actions with specific handlers
      if (t.dataset.modalAction === 'create-myex') return Actions.createMyEx();
      if (t.dataset.modalAction === 'create-diary') return Actions.createDiary();
      if (t.dataset.modalAction === 'save-diary') return Actions.saveDiary(t.dataset.did);
      if (t.dataset.modalAction === 'open-diary-board') return Actions.openDiaryBoard(t.dataset.did);
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
        const isCoach = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
        let list = Store.get().trainings.slice();
        if (!isCoach) list = list.filter(t => t.status !== 'draft' && t.status !== 'pinned');
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        if (q) list = list.filter(t => (t.name || '').toLowerCase().includes(q));
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
;try {
  const _origRender = App.renderCurrent && App.renderCurrent.bind(App);
  if (_origRender && !App._clubBotWrapped) {
    App._clubBotWrapped = true;
    App.renderCurrent = function () {
      const r = _origRender.apply(this, arguments);
      try { if (typeof CoachTools !== 'undefined' && CoachTools.bindClubBot) CoachTools.bindClubBot(document); } catch (_) {}
      try { if (typeof ClubBot !== 'undefined' && ClubBot.autoPollEnabled && ClubBot.autoPollEnabled()) ClubBot.startScheduler(); } catch (_) {}
      return r;
    };
  }
} catch (_) {}
