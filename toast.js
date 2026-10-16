/** Extracted module: src/core/toast.js lines 111-121 — DO NOT rewrite business logic */
/* ─── TOAST ─────────────────────────────────────────────── */
const Toast = {
  show(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'to ' + type;
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
};

