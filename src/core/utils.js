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




/** Мінімальний GIF89a encoder (RGB frames → animated GIF) */
const GifEncoder = {
  encode(frames, width, height, delayCs) {
    const bytes = [];
    const put = (arr) => { for (let i = 0; i < arr.length; i++) bytes.push(arr[i] & 255); };
    // Header
    put([0x47,0x49,0x46,0x38,0x39,0x61]); // GIF89a
    put([width & 255, (width >> 8) & 255, height & 255, (height >> 8) & 255]);
    put([0x00, 0x00, 0x00]); // no global color table
    // Netscape loop
    put([0x21, 0xFF, 0x0B]);
    for (const c of 'NETSCAPE2.0') put([c.charCodeAt(0)]);
    put([0x03, 0x01, 0x00, 0x00, 0x00]);

    frames.forEach(imgData => {
      const { palette, indexed } = this.quantize(imgData.data, width * height);
      // Graphic control
      put([0x21, 0xF9, 0x04, 0x00, delayCs & 255, (delayCs >> 8) & 255, 0x00, 0x00]);
      // Image descriptor
      put([0x2C, 0,0,0,0, width & 255, (width >> 8) & 255, height & 255, (height >> 8) & 255]);
      const gctSize = 7; // 256 colors
      put([0x80 | gctSize]); // local color table 256
      for (let i = 0; i < 256; i++) {
        if (i < palette.length) put([palette[i][0], palette[i][1], palette[i][2]]);
        else put([0,0,0]);
      }
      // LZW
      const minCodeSize = 8;
      put([minCodeSize]);
      const compressed = this.lzw(indexed, minCodeSize);
      // sub-blocks
      let offset = 0;
      while (offset < compressed.length) {
        const sz = Math.min(255, compressed.length - offset);
        put([sz]);
        for (let i = 0; i < sz; i++) put([compressed[offset + i]]);
        offset += sz;
      }
      put([0x00]);
    });
    put([0x3B]); // trailer
    return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
  },

  quantize(rgba, n) {
    // Simple median-cut lite: sample + map to 256 palette by 3-3-2-ish buckets then unique
    const map = new Map();
    const palette = [];
    const indexed = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const r = rgba[i * 4] & 0xE0;
      const g = rgba[i * 4 + 1] & 0xE0;
      const b = rgba[i * 4 + 2] & 0xE0;
      const key = (r << 16) | (g << 8) | b;
      let idx = map.get(key);
      if (idx == null) {
        if (palette.length < 256) {
          idx = palette.length;
          palette.push([r, g, b]);
          map.set(key, idx);
        } else {
          idx = 0;
        }
      }
      indexed[i] = idx;
    }
    if (!palette.length) palette.push([0,0,0]);
    return { palette, indexed };
  },

  lzw(indexStream, minCodeSize) {
    const clear = 1 << minCodeSize;
    const eoi = clear + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = eoi + 1;
    const dict = new Map();
    const out = [];
    let bitBuf = 0, bitLen = 0;
    const write = (code) => {
      bitBuf |= code << bitLen;
      bitLen += codeSize;
      while (bitLen >= 8) {
        out.push(bitBuf & 255);
        bitBuf >>= 8;
        bitLen -= 8;
      }
    };
    write(clear);
    let w = [indexStream[0]];
    for (let i = 1; i < indexStream.length; i++) {
      const k = indexStream[i];
      const wk = w.concat([k]);
      const key = wk.join(',');
      if (dict.has(key)) {
        w = wk;
      } else {
        const wkey = w.join(',');
        const code = w.length === 1 ? w[0] : dict.get(wkey);
        write(code);
        if (nextCode < 4096) {
          dict.set(key, nextCode++);
          if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
        } else {
          write(clear);
          dict.clear();
          codeSize = minCodeSize + 1;
          nextCode = eoi + 1;
        }
        w = [k];
      }
    }
    const wkey = w.join(',');
    write(w.length === 1 ? w[0] : (dict.get(wkey) || 0));
    write(eoi);
    if (bitLen > 0) out.push(bitBuf & 255);
    return out;
  }
};
