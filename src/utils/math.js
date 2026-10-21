export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const uid = () => 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
export const sanitize = (s) =>
  String(s ?? '').replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]
  );
