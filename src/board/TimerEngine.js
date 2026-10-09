/** Extracted module: src/board/TimerEngine.js lines 497-598 — DO NOT rewrite business logic */
/* ─── TIMER ENGINE (Date.now based) ─────────────────────── */
const TimerEngine = {
  _raf: null,

  tick() {
    const s = Store.get();
    if (!s) return;
    const t = s.timer;
    if (t.mainRunning && t.mainStart) {
      const elapsed = t.mainElapsed + Math.floor((Date.now() - t.mainStart) / 1000);
      const el = document.getElementById('timerMain');
      if (el) el.textContent = fmtTime(elapsed);
      if (s.settings.sound && elapsed > 0 && elapsed % 300 === 0 && elapsed !== t._lastBeep) {
        t._lastBeep = elapsed;
        this.beep();
      }
    }
    if (t.exRunning && t.exStart) {
      const elapsed = t.exElapsed + Math.floor((Date.now() - t.exStart) / 1000);
      const el = document.getElementById('timerEx');
      if (el) el.textContent = fmtTime(elapsed);
    }
    this._raf = requestAnimationFrame(() => this.tick());
  },

  start() {
    const s = Store.get();
    if (s.timer.mainRunning) return;
    s.timer.mainRunning = true;
    s.timer.mainStart = Date.now();
    if (!this._raf) this.tick();
  },

  pause() {
    const s = Store.get();
    if (!s.timer.mainRunning) return;
    s.timer.mainElapsed += Math.floor((Date.now() - s.timer.mainStart) / 1000);
    s.timer.mainRunning = false;
    s.timer.mainStart = null;
  },

  reset() {
    const s = Store.get();
    s.timer.mainRunning = false;
    s.timer.mainStart = null;
    s.timer.mainElapsed = 0;
    s.timer._lastBeep = 0;
    const el = document.getElementById('timerMain');
    if (el) el.textContent = '00:00';
  },

  add(sec) {
    const s = Store.get();
    if (s.timer.mainRunning) {
      s.timer.mainElapsed += Math.floor((Date.now() - s.timer.mainStart) / 1000);
      s.timer.mainStart = Date.now();
    }
    s.timer.mainElapsed = Math.max(0, s.timer.mainElapsed + sec);
    const el = document.getElementById('timerMain');
    if (el) el.textContent = fmtTime(s.timer.mainElapsed);
  },

  startEx() {
    const s = Store.get();
    if (s.timer.exRunning) return;
    s.timer.exRunning = true;
    s.timer.exStart = Date.now();
    if (!this._raf) this.tick();
  },

  pauseEx() {
    const s = Store.get();
    if (!s.timer.exRunning) return;
    s.timer.exElapsed += Math.floor((Date.now() - s.timer.exStart) / 1000);
    s.timer.exRunning = false;
    s.timer.exStart = null;
  },

  resetEx() {
    const s = Store.get();
    s.timer.exRunning = false;
    s.timer.exStart = null;
    s.timer.exElapsed = 0;
    const el = document.getElementById('timerEx');
    if (el) el.textContent = '00:00';
  },

  beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.25;
      o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 180);
    } catch (_) {}
  },

  stopLoop() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }
};

