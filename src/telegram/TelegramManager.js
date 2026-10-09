/** Extracted module: src/telegram/TelegramManager.js lines 46-110 — DO NOT rewrite business logic */
/* ─── TELEGRAM MINI APP ─────────────────────────────────── */
const TelegramManager = {
  tg: null,
  isTelegram: false,
  init() {
    try {
      this.tg = window.Telegram && window.Telegram.WebApp;
      if (!this.tg) return false;
      this.isTelegram = true;
      this.tg.ready();
      this.tg.expand();
      this.applyTheme();
      this.applySafeArea();
      if (this.tg.onEvent) {
        this.tg.onEvent('viewportChanged', () => { this.applySafeArea(); window.dispatchEvent(new Event('resize')); });
        this.tg.onEvent('fullscreenChanged', () => {
          document.body.classList.toggle('tg-fullscreen', !!this.tg.isFullscreen);
        });
      }
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
  async requestFullscreen() {
    if (this.tg && this.tg.requestFullscreen) {
      try { await this.tg.requestFullscreen(); return true; } catch (e) { console.warn('[TG] FS', e); }
    }
    return false;
  },
  async exitFullscreen() {
    if (this.tg && this.tg.exitFullscreen) {
      try { await this.tg.exitFullscreen(); return; } catch (_) {}
    }
  },
  lockLandscape() {
    try { this.tg && this.tg.lockOrientation && this.tg.lockOrientation('landscape'); } catch (_) {}
  },
  unlockOrientation() {
    try { this.tg && this.tg.unlockOrientation && this.tg.unlockOrientation(); } catch (_) {}
  }
};

