/** Telegram Mini App — повна інтеграція WebApp SDK */
const TelegramManager = {
  tg: null,
  isTelegram: false,

  init() {
    try {
      this.tg = window.Telegram && window.Telegram.WebApp;
      if (!this.tg) return false;
      this.isTelegram = true;

      // Обов'язково для повного екрана в Telegram WebView
      try { this.tg.ready(); } catch (_) {}
      try { this.tg.expand(); } catch (_) {}

      // Захист від випадкового закриття під час роботи з дошкою
      try {
        if (typeof this.tg.enableClosingConfirmation === 'function') {
          this.tg.enableClosingConfirmation();
        }
      } catch (_) {}

      // Блокування вертикального swipe-to-close (Bot API 7.7+)
      try {
        if (typeof this.tg.disableVerticalSwipes === 'function') {
          this.tg.disableVerticalSwipes();
        }
      } catch (_) {}

      this.applyTheme();
      this.applySafeArea();
      this.applyViewportCss();

      if (this.tg.onEvent) {
        this.tg.onEvent('viewportChanged', () => {
          this.applySafeArea();
          this.applyViewportCss();
          window.dispatchEvent(new Event('resize'));
        });
        this.tg.onEvent('themeChanged', () => this.applyTheme());
        this.tg.onEvent('fullscreenChanged', () => {
          document.body.classList.toggle('tg-fullscreen', !!this.tg.isFullscreen);
        });
      }

      // Системна кнопка «Назад»
      try {
        if (this.tg.BackButton) {
          this.tg.BackButton.onClick(() => {
            if (typeof App !== 'undefined' && App.navigate) {
              App.navigate('dashboard');
            }
          });
        }
      } catch (_) {}

      document.body.classList.add('tg-mini-app');
      return true;
    } catch (e) {
      console.warn('[TG]', e);
      return false;
    }
  },

  applyTheme() {
    if (!this.tg) return;
    const p = this.tg.themeParams || {};
    const r = document.documentElement;
    if (p.bg_color) r.style.setProperty('--bg', p.bg_color);
    if (p.secondary_bg_color) r.style.setProperty('--panel', p.secondary_bg_color);
    if (p.text_color) r.style.setProperty('--text', p.text_color);
    if (p.hint_color) r.style.setProperty('--muted', p.hint_color);
    if (p.button_color) r.style.setProperty('--club-secondary', p.button_color);
    try {
      this.tg.setHeaderColor && this.tg.setHeaderColor(p.bg_color || '#0d1117');
      this.tg.setBackgroundColor && this.tg.setBackgroundColor(p.bg_color || '#0d1117');
    } catch (_) {}
  },

  applySafeArea() {
    if (!this.tg) return;
    const sa = this.tg.safeAreaInset || {};
    const csa = this.tg.contentSafeAreaInset || {};
    const r = document.documentElement;
    r.style.setProperty('--safe-top', ((sa.top || csa.top || 0)) + 'px');
    r.style.setProperty('--safe-bottom', ((sa.bottom || csa.bottom || 0)) + 'px');
    r.style.setProperty('--safe-left', ((sa.left || csa.left || 0)) + 'px');
    r.style.setProperty('--safe-right', ((sa.right || csa.right || 0)) + 'px');
  },

  applyViewportCss() {
    if (!this.tg) return;
    const r = document.documentElement;
    const h = this.tg.viewportStableHeight || this.tg.viewportHeight || window.innerHeight;
    r.style.setProperty('--tg-viewport-height', h + 'px');
    r.style.setProperty('--tg-viewport-stable', (this.tg.viewportStableHeight || h) + 'px');
  },

  showBackButton() {
    try {
      if (this.tg && this.tg.BackButton) this.tg.BackButton.show();
    } catch (_) {}
  },

  hideBackButton() {
    try {
      if (this.tg && this.tg.BackButton) this.tg.BackButton.hide();
    } catch (_) {}
  },

  /** type: light | medium | heavy | rigid | soft */
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

  unlockOrientation() {
    try { this.tg && this.tg.unlockOrientation && this.tg.unlockOrientation(); } catch (_) {}
  }
};
