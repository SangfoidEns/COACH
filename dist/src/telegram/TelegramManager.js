/** Telegram Mini App — сучасна інтеграція WebApp SDK (2026–2028 UX) */
const TelegramManager = {
  tg: null,
  isTelegram: false,
  _viewStack: [],
  _mainBtnHandler: null,
  _secondaryBtnHandler: null,
  _backHandler: null,

  init() {
    try {
      this.tg = window.Telegram && window.Telegram.WebApp;
      if (!this.tg) return false;
      this.isTelegram = true;

      try { this.tg.ready(); } catch (_) {}
      try { this.tg.expand(); } catch (_) {}

      // Повний viewport / safe area
      try {
        if (typeof this.tg.requestFullscreen === 'function') {
          // не форсуємо fullscreen автоматично — лише готуємо CSS
        }
      } catch (_) {}

      try {
        if (typeof this.tg.enableClosingConfirmation === 'function') {
          this.tg.enableClosingConfirmation();
        }
      } catch (_) {}

      try {
        if (typeof this.tg.disableVerticalSwipes === 'function') {
          this.tg.disableVerticalSwipes();
        }
      } catch (_) {}

      this.applyTheme();
      this.applySafeArea();
      this.applyViewportCss();
      this._bindPlatformEvents();
      this._bindBackButton();
      this._bindSettingsButton();

      document.body.classList.add('tg-mini-app');
      if (this.tg.platform) {
        document.body.classList.add('tg-platform-' + String(this.tg.platform).toLowerCase());
      }
      return true;
    } catch (e) {
      console.warn('[TG]', e);
      return false;
    }
  },

  _bindPlatformEvents() {
    if (!this.tg || !this.tg.onEvent) return;
    this.tg.onEvent('viewportChanged', () => {
      this.applySafeArea();
      this.applyViewportCss();
      window.dispatchEvent(new Event('resize'));
    });
    this.tg.onEvent('themeChanged', () => this.applyTheme());
    this.tg.onEvent('fullscreenChanged', () => {
      document.body.classList.toggle('tg-fullscreen', !!this.tg.isFullscreen);
    });
    try {
      this.tg.onEvent('safeAreaChanged', () => this.applySafeArea());
      this.tg.onEvent('contentSafeAreaChanged', () => this.applySafeArea());
    } catch (_) {}
  },

  _bindBackButton() {
    try {
      if (!this.tg || !this.tg.BackButton) return;
      this.tg.BackButton.onClick(() => {
        this.haptic('light');
        if (typeof App !== 'undefined' && App.handleTelegramBack) {
          App.handleTelegramBack();
        } else if (typeof App !== 'undefined' && App.navigate) {
          App.navigate('dashboard');
        }
      });
    } catch (_) {}
  },

  _bindSettingsButton() {
    try {
      const sb = this.tg && this.tg.SettingsButton;
      if (!sb) return;
      sb.show();
      sb.onClick(() => {
        this.haptic('select');
        if (typeof App !== 'undefined' && App.navigate) App.navigate('settings');
      });
    } catch (_) {}
  },


  /**
   * Server-side initData HMAC validation.
   * API URL: window.__MS_AUTH_API__ or localStorage ms_auth_api or meta[name=ms-auth-api]
   * Returns { ok, user, source: 'server'|'unsafe'|'local'|'error', error? }
   */
  async validateSession() {
    const result = { ok: false, user: null, source: 'local', error: null };
    try {
      if (!this.tg) {
        result.ok = true;
        result.source = 'local';
        return result;
      }
      const initData = this.tg.initData || '';
      if (!initData) {
        // Browser without Telegram — allow local coach mode
        result.ok = true;
        result.source = 'local';
        result.user = this.getUser();
        return result;
      }

      let apiBase = '';
      try {
        if (typeof window !== 'undefined' && window.__MS_AUTH_API__) apiBase = String(window.__MS_AUTH_API__);
        if (!apiBase) apiBase = localStorage.getItem('ms_auth_api') || '';
        if (!apiBase) {
          const meta = document.querySelector('meta[name="ms-auth-api"]');
          if (meta && meta.content) apiBase = meta.content.trim();
        }
      } catch (_) {}

      if (!apiBase) {
        // No server configured — fall back to unsafe user but flag it
        result.ok = true;
        result.source = 'unsafe';
        result.user = this.getUser();
        result.error = 'auth_api_not_configured';
        console.warn('[TG] Auth API not configured — using initDataUnsafe (not production-safe)');
        return result;
      }

      apiBase = apiBase.replace(/\/+$/, '');
      const url = apiBase + '/api/telegram/validate';
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
          signal: ctrl ? ctrl.signal : undefined
        });
      } finally {
        if (timer) clearTimeout(timer);
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        result.ok = false;
        result.source = 'error';
        result.error = (data && data.error) || ('http_' + res.status);
        result.user = null;
        console.warn('[TG] initData validation failed:', result.error);
        return result;
      }

      result.ok = true;
      result.source = 'server';
      result.user = data.user || null;
      result.authDate = data.authDate;
      result.validatedAt = data.validatedAt;
      this._validatedUser = result.user;
      this._validationSource = 'server';
      return result;
    } catch (e) {
      result.ok = false;
      result.source = 'error';
      result.error = (e && e.name === 'AbortError') ? 'timeout' : ((e && e.message) || 'network');
      console.warn('[TG] validateSession', e);
      return result;
    }
  },

  getValidatedUser() {
    return this._validatedUser || null;
  },

  getValidationSource() {
    return this._validationSource || 'none';
  },

  getUser() {
    try {
      if (this.tg && this.tg.initDataUnsafe && this.tg.initDataUnsafe.user) {
        return this.tg.initDataUnsafe.user;
      }
    } catch (_) {}
    return null;
  },

  getUserPhotoUrl() {
    const u = this.getUser();
    return (u && u.photo_url) ? u.photo_url : '';
  },

  applyTheme() {
    if (!this.tg) return;
    const p = this.tg.themeParams || {};
    const r = document.documentElement;
    const map = {
      bg_color: '--bg',
      secondary_bg_color: '--panel',
      section_bg_color: '--panel-elevated',
      text_color: '--text',
      hint_color: '--muted',
      link_color: '--club-secondary',
      button_color: '--club-secondary',
      button_text_color: '--btn-text',
      destructive_text_color: '--danger',
      header_bg_color: '--header-bg',
      accent_text_color: '--club-accent',
      subtitle_text_color: '--muted',
      section_header_text_color: '--muted',
      section_separator_color: '--border'
    };
    Object.keys(map).forEach(k => {
      if (p[k]) r.style.setProperty(map[k], p[k]);
    });
    try {
      this.tg.setHeaderColor && this.tg.setHeaderColor(p.header_bg_color || p.bg_color || '#0d1117');
      this.tg.setBackgroundColor && this.tg.setBackgroundColor(p.bg_color || '#0d1117');
      this.tg.setBottomBarColor && this.tg.setBottomBarColor(p.secondary_bg_color || p.bg_color || '#0d1117');
    } catch (_) {}
  },

  applySafeArea() {
    if (!this.tg) return;
    const r = document.documentElement;
    const sa = this.tg.safeAreaInset || {};
    const csa = this.tg.contentSafeAreaInset || {};
    r.style.setProperty('--safe-top', ((sa.top || 0) + (csa.top || 0)) + 'px');
    r.style.setProperty('--safe-bottom', ((sa.bottom || 0) + (csa.bottom || 0)) + 'px');
    r.style.setProperty('--safe-left', ((sa.left || csa.left || 0)) + 'px');
    r.style.setProperty('--safe-right', ((sa.right || csa.right || 0)) + 'px');
    r.style.setProperty('--tg-safe-top', (sa.top || 0) + 'px');
    r.style.setProperty('--tg-safe-bottom', (sa.bottom || 0) + 'px');
  },

  applyViewportCss() {
    if (!this.tg) return;
    const r = document.documentElement;
    const h = this.tg.viewportStableHeight || this.tg.viewportHeight || window.innerHeight;
    r.style.setProperty('--tg-viewport-height', h + 'px');
    r.style.setProperty('--tg-viewport-stable', (this.tg.viewportStableHeight || h) + 'px');
  },

  /* ── Haptics ── */
  haptic(type) {
    try {
      const h = this.tg && this.tg.HapticFeedback;
      if (!h) return;
      if (type === 'select' && h.selectionChanged) h.selectionChanged();
      else if (h.impactOccurred) h.impactOccurred(type || 'light');
    } catch (_) {}
  },
  hapticSuccess() {
    try {
      const h = this.tg && this.tg.HapticFeedback;
      if (h && h.notificationOccurred) h.notificationOccurred('success');
    } catch (_) {}
  },
  hapticError() {
    try {
      const h = this.tg && this.tg.HapticFeedback;
      if (h && h.notificationOccurred) h.notificationOccurred('error');
    } catch (_) {}
  },
  hapticWarning() {
    try {
      const h = this.tg && this.tg.HapticFeedback;
      if (h && h.notificationOccurred) h.notificationOccurred('warning');
    } catch (_) {}
  },

  /* ── Back button + view stack ── */
  showBackButton() {
    try { if (this.tg && this.tg.BackButton) this.tg.BackButton.show(); } catch (_) {}
  },
  hideBackButton() {
    try { if (this.tg && this.tg.BackButton) this.tg.BackButton.hide(); } catch (_) {}
  },
  pushView(view) {
    if (!view) return;
    const last = this._viewStack[this._viewStack.length - 1];
    if (last !== view) this._viewStack.push(view);
    if (this._viewStack.length > 1) this.showBackButton();
    else this.hideBackButton();
  },
  popView() {
    if (this._viewStack.length > 1) this._viewStack.pop();
    const prev = this._viewStack[this._viewStack.length - 1] || 'dashboard';
    if (this._viewStack.length <= 1) this.hideBackButton();
    return prev;
  },
  resetStack(view) {
    this._viewStack = [view || 'dashboard'];
    this.hideBackButton();
  },

  /* ── Main / Secondary buttons (контекст екрана) ── */
  setMainButton(text, onClick, opts) {
    try {
      const mb = this.tg && this.tg.MainButton;
      if (!mb) return;
      opts = opts || {};
      if (this._mainBtnHandler && mb.offClick) {
        try { mb.offClick(this._mainBtnHandler); } catch (_) {}
      }
      this._mainBtnHandler = () => {
        this.haptic('medium');
        if (typeof onClick === 'function') onClick();
      };
      mb.setText(text || 'OK');
      if (mb.setParams) {
        mb.setParams({
          text: text || 'OK',
          color: opts.color || undefined,
          text_color: opts.textColor || undefined,
          is_active: opts.active !== false,
          is_visible: true
        });
      } else {
        mb.show();
      }
      if (mb.onClick) mb.onClick(this._mainBtnHandler);
      else mb.show();
      try { mb.show(); } catch (_) {}
    } catch (e) {
      console.warn('[TG] MainButton', e);
    }
  },

  hideMainButton() {
    try {
      const mb = this.tg && this.tg.MainButton;
      if (!mb) return;
      if (this._mainBtnHandler && mb.offClick) {
        try { mb.offClick(this._mainBtnHandler); } catch (_) {}
      }
      this._mainBtnHandler = null;
      mb.hide();
    } catch (_) {}
  },

  setSecondaryButton(text, onClick) {
    try {
      const sb = this.tg && this.tg.SecondaryButton;
      if (!sb) return;
      if (this._secondaryBtnHandler && sb.offClick) {
        try { sb.offClick(this._secondaryBtnHandler); } catch (_) {}
      }
      this._secondaryBtnHandler = () => {
        this.haptic('light');
        if (typeof onClick === 'function') onClick();
      };
      if (sb.setParams) {
        sb.setParams({ text: text || '', is_visible: true, position: 'left' });
      }
      if (sb.onClick) sb.onClick(this._secondaryBtnHandler);
      try { sb.show(); } catch (_) {}
    } catch (_) {}
  },

  hideSecondaryButton() {
    try {
      const sb = this.tg && this.tg.SecondaryButton;
      if (!sb) return;
      if (this._secondaryBtnHandler && sb.offClick) {
        try { sb.offClick(this._secondaryBtnHandler); } catch (_) {}
      }
      this._secondaryBtnHandler = null;
      sb.hide();
    } catch (_) {}
  },

  /** Контекстні кнопки: без MainButton «Дошка/+Гравець» — навігація лише через glass-tabbar */
  syncChromeForView(view) {
    try {
      if (!this.isTelegram) return;
      // Завжди ховаємо системні TG-кнопки внизу (конфліктують з glass-nav)
      this.hideMainButton();
      this.hideSecondaryButton();
      if (view === 'board') {
        this.showBackButton();
        try {
          if (this.tg.disableVerticalSwipes) this.tg.disableVerticalSwipes();
        } catch (_) {}
        return;
      }
      this.hideBackButton && this.hideBackButton();
    } catch (e) {
      console.warn('[TG] syncChrome', e);
    }
  },

  async requestFullscreen() {
    if (this.tg && this.tg.requestFullscreen) {
      try { await this.tg.requestFullscreen(); return true; } catch (e) { console.warn('[TG] FS', e); }
    }
    return false;
  },
  async exitFullscreen() {
    if (this.tg && this.tg.exitFullscreen) {
      try { await this.tg.exitFullscreen(); } catch (_) {}
    }
  },
  lockLandscape() {
    try { this.tg && this.tg.lockOrientation && this.tg.lockOrientation('landscape'); } catch (_) {}
  },

  /* ── Діалоги Telegram ── */
  showAlert(message) {
    return new Promise((resolve) => {
      try {
        if (this.tg && this.tg.showAlert) {
          this.tg.showAlert(String(message || ''), () => resolve(true));
          return;
        }
      } catch (_) {}
      try { alert(String(message || '')); } catch (_) {}
      resolve(true);
    });
  },

  showConfirm(message) {
    return new Promise((resolve) => {
      try {
        if (this.tg && this.tg.showConfirm) {
          this.tg.showConfirm(String(message || ''), (ok) => resolve(!!ok));
          return;
        }
      } catch (_) {}
      try { resolve(!!confirm(String(message || ''))); } catch (_) { resolve(false); }
    });
  },

  showPopup(params) {
    // params: { title, message, buttons: [{id, type, text}] }
    return new Promise((resolve) => {
      try {
        if (this.tg && this.tg.showPopup) {
          this.tg.showPopup(params || { message: '' }, (id) => resolve(id || null));
          return;
        }
      } catch (_) {}
      this.showAlert((params && (params.message || params.title)) || '').then(() => resolve('ok'));
    });
  },

  /** Надіслати дані боту (Telegram.WebApp.sendData) — для webhook-сценаріїв */
  sendDataToBot(payload) {
    try {
      if (!this.tg || !this.tg.sendData) {
        console.warn('[TG] sendData недоступний (лише в inline/keyboard webapps)');
        return false;
      }
      const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
      this.tg.sendData(text);
      this.hapticSuccess();
      return true;
    } catch (e) {
      console.warn('[TG] sendData', e);
      return false;
    }
  },

  openLink(url, tryInstant) {
    try {
      if (this.tg && this.tg.openLink) {
        this.tg.openLink(url, { try_instant_view: !!tryInstant });
        return true;
      }
    } catch (_) {}
    try { window.open(url, '_blank'); return true; } catch (_) { return false; }
  },

  openTelegramLink(url) {
    try {
      if (this.tg && this.tg.openTelegramLink) {
        this.tg.openTelegramLink(url);
        return true;
      }
    } catch (_) {}
    return this.openLink(url);
  },

  /** Поділитися текстом / файлом через системний Share або TG */
  async shareText(title, text) {
    try {
      if (navigator.share) {
        await navigator.share({ title: title || 'МЕТАЛІСТ ШТУТГАРТ', text: text || '' });
        this.hapticSuccess();
        return true;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text || '');
        this.hapticSuccess();
        if (typeof Toast !== 'undefined') Toast.show('Скопійовано в буфер', 'ok');
        return true;
      }
    } catch (_) {}
    return false;
  },

  async shareFile(blob, filename, title) {
    try {
      const file = new File([blob], filename || 'export.json', { type: blob.type || 'application/json' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: title || filename });
        this.hapticSuccess();
        return true;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
      console.warn('[TG] shareFile', e);
    }
    return false;
  },

  readClipboard() {
    return new Promise(async (resolve) => {
      try {
        if (this.tg && this.tg.readTextFromClipboard) {
          this.tg.readTextFromClipboard((text) => resolve(text || ''));
          return;
        }
      } catch (_) {}
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          resolve(await navigator.clipboard.readText());
          return;
        }
      } catch (_) {}
      resolve('');
    });
  },

  /** Запит на запис у CloudStorage / доступ */
  requestWriteAccess() {
    return new Promise((resolve) => {
      try {
        if (this.tg && this.tg.requestWriteAccess) {
          this.tg.requestWriteAccess((ok) => resolve(!!ok));
          return;
        }
      } catch (_) {}
      resolve(true);
    });
  },

  isExpanded() {
    try { return !!(this.tg && this.tg.isExpanded); } catch (_) { return false; }
  },

  platform() {
    try { return (this.tg && this.tg.platform) || 'unknown'; } catch (_) { return 'unknown'; }
  },

  colorScheme() {
    try { return (this.tg && this.tg.colorScheme) || 'dark'; } catch (_) { return 'dark'; }
  },

  unlockOrientation() {
    try { this.tg && this.tg.unlockOrientation && this.tg.unlockOrientation(); } catch (_) {}
  }
};

if (typeof window !== 'undefined') window.TelegramManager = TelegramManager;
