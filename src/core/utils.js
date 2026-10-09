/** Extracted module: src/core/utils.js lines 1-45 — DO NOT rewrite business logic */

/* ═══════════════════════════════════════════════════════════
   МЕТАЛІСТ ШТУТГАРТ — Coach Board v2 (Production Prototype)
   Architecture: UI → AppState → Domain → StorageManager
   Schema Version: 2
   ═══════════════════════════════════════════════════════════ */

'use strict';

const SCHEMA_VERSION = 2;
const STORAGE_KEY = 'metalist_stuttgart_coach_v2';
const BACKUP_KEY = 'metalist_stuttgart_coach_backup';
const LEGACY_KEY = 'metalist_stuttgart_coach_v1';

/* ─── UTILITIES ─────────────────────────────────────────── */
const uid = () => 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = d => {
  try { return new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '—'; }
};
const fmtTime = s => {
  const n = Math.max(0, Math.floor(s));
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const sanitize = s => String(s || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]);
const isInput = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

/* ─── ERROR MANAGER ─────────────────────────────────────── */
const ErrorManager = {
  log(ctx, err) {
    console.error('[CoachBoard]', ctx, err);
    Toast.show('Помилка: ' + (err?.message || ctx), 'err');
  },
  wrap(ctx, fn) {
    return (...args) => {
      try { return fn(...args); }
      catch (e) { this.log(ctx, e); return null; }
    };
  }
};


