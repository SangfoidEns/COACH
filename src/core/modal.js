/** Extracted module: src/core/modal.js lines 1438-1476 — DO NOT rewrite business logic */
const Modal = {
  _onConfirm: null,
  open(title, body, buttons) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalFooter').innerHTML = (buttons || []).map(b =>
      `<button class="btn ${b.cls || 'btn-s'}" data-modal-action="${b.action || ''}">${b.label}</button>`
    ).join('');
    document.getElementById('modal').classList.add('show');
    // focus first input
    setTimeout(() => {
      const inp = document.querySelector('#modalBody input, #modalBody textarea, #modalBody select');
      if (inp) inp.focus();
    }, 50);
  },
  close() {
    document.getElementById('modal').classList.remove('show');
    this._onConfirm = null;
  },
  confirm(msg, onYes) {
    this._onConfirm = onYes;
    this.open('Підтвердження', `<p style="font-size:14px">${sanitize(msg)}</p>`, [
      { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
      { label: 'Підтвердити', cls: 'btn-d', action: 'confirm' }
    ]);
  },
  prompt(title, def, onOk) {
    this._onConfirm = () => {
      const v = document.getElementById('promptInput')?.value;
      onOk(v);
    };
    this.open(title, `<div class="fgr full"><input id="promptInput" value="${sanitize(def || '')}"></div>`, [
      { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
      { label: 'OK', cls: 'btn-p', action: 'confirm' }
    ]);
  }
};

/* ─── DOMAIN: LOAD ──────────────────────────────────────── */
