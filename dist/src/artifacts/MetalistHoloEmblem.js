/* Metalist Stuttgart — exclusive holographic edition based on the club crest supplied by the user. */
(function (root) {
  'use strict';
  const svg = '<svg class="ms-holo-svg" viewBox="0 0 100 112" role="img" aria-label="Голографічна емблема Metalist Stuttgart: кінь, футбольний м’яч, синьо-золоті смуги та 2025" focusable="false">' +
    '<defs>' +
      '<linearGradient id="msHoloGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3a1"/><stop offset=".22" stop-color="#e7b83d"/><stop offset=".48" stop-color="#fff0a0"/><stop offset=".72" stop-color="#a66d12"/><stop offset="1" stop-color="#ffdc68"/></linearGradient>' +
      '<linearGradient id="msHoloNavy" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#102b50"/><stop offset=".55" stop-color="#071629"/><stop offset="1" stop-color="#1b3760"/></linearGradient>' +
      '<linearGradient id="msHoloGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ffaff" stop-opacity=".45"/><stop offset=".5" stop-color="#c8aaff" stop-opacity=".08"/><stop offset="1" stop-color="#67f5ff" stop-opacity=".35"/></linearGradient>' +
      '<filter id="msHoloGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<clipPath id="msHoloShieldClip"><path d="M7 5H93V68Q92 82 50 107Q8 82 7 68Z"/></clipPath>' +
    '</defs>' +
    '<circle class="ms-holo-orbit ms-holo-orbit-a" cx="50" cy="55" r="48"/><circle class="ms-holo-orbit ms-holo-orbit-b" cx="50" cy="55" r="44"/>' +
    '<path d="M5 3H95V68Q94 84 50 109Q6 84 5 68Z" fill="#050b14" stroke="url(#msHoloGold)" stroke-width="1.8" filter="url(#msHoloGlow)"/>' +
    '<path d="M8 6H92V67Q91 81 50 105Q9 81 8 67Z" fill="url(#msHoloGold)"/>' +
    '<g clip-path="url(#msHoloShieldClip)">' +
      '<rect x="8" y="6" width="84" height="62" fill="url(#msHoloGold)"/>' +
      '<rect x="8" y="69" width="84" height="40" fill="url(#msHoloNavy)"/>' +
      '<path d="M15 69H24V102L18 99Z M34 69H43V105L34 100Z M53 69H62V105L53 101Z M72 69H81V99L72 103Z" fill="url(#msHoloGold)"/>' +
      '<path d="M8 68H92" stroke="#07111e" stroke-width="2.3"/><path d="M8 6H92V68H8Z" fill="url(#msHoloGlass)"/>' +
      '<path class="ms-holo-scanline" d="M8 15H92M8 21H92M8 27H92M8 33H92M8 39H92M8 45H92M8 51H92M8 57H92M8 63H92"/>' +
    '</g>' +
    '<path d="M9 7H91V67Q90 81 50 103Q10 81 9 67Z" fill="none" stroke="#fff0a0" stroke-opacity=".8" stroke-width=".65"/>' +
    /* football */
    '<g transform="translate(21 22)" stroke="#07111e" stroke-width=".8"><circle r="7.2" fill="url(#msHoloGold)"/><path d="M-2.1-2.8 1.8-2.8 3.1.8 0 3.1-3.2.8Z" fill="#101722"/><path d="M-2.1-2.8-4.5-5.1M1.8-2.8 4.8-4.6M3.1.8 5.8 2.1M0 3.1-.4 6.8M-3.2.8-6.5 1.6M-4.5-5.1-1.1-6.9 4.8-4.6" fill="none"/></g>' +
    /* abstracted rearing horse silhouette echoing the supplied crest */
    '<path class="ms-holo-horse" d="M53 18Q57 13 64 13L61 16 69 15 65 19 71 20 66 23Q65 28 61 30L63 35 68 39 66 44 61 42 57 36 53 34 50 39 53 47 49 53 46 51 48 43 44 37 45 32 50 29 51 24 48 21 50 18Z M60 29 65 31 68 29 71 31 68 35 63 35Z M49 51 47 58 43 62 46 64 51 60 54 53Z M61 43 64 49 61 56 64 59 68 54 67 47 65 42Z M66 23 72 21 75 17 74 24 69 28Z" fill="#091321" stroke="#07111e" stroke-width=".45"/>' +
    '<circle cx="65.8" cy="23.4" r=".7" fill="#fff2a0"/>' +
    '<path d="M14 54H86" stroke="#091321" stroke-opacity=".6" stroke-width=".6"/>' +
    '<text x="50" y="61" text-anchor="middle" class="ms-holo-name">METALIST STUTTGART</text>' +
    '<text x="50" y="88" text-anchor="middle" class="ms-holo-year">2025</text>' +
    '<path class="ms-holo-glint" d="M9 9 90 9"/><path class="ms-holo-glint ms-holo-glint-low" d="M12 72 86 72"/><circle class="ms-holo-node" cx="8" cy="55" r="1.3"/><circle class="ms-holo-node" cx="92" cy="55" r="1.3"/>' +
    '</svg>';
  root.MetalistHoloEmblem = {
    id: 'metalist_holo_emblem',
    markup: function (className) { return '<span class="ms-holo-artifact ' + (className || '') + '" aria-hidden="true">' + svg + '</span>'; },
    inspectMarkup: function () { return '<div class="ms-holo-inspect" role="img" aria-label="Голографічна клубна емблема Metalist Stuttgart на основі офіційного зображення"><div class="ms-holo-inspect-stage">' + svg + '</div><div class="ms-holo-inspect-caption">METALIST <span>STUTTGART</span></div><div class="ms-holo-serial">CLUB SIGNAL · 001 · 2025 · HOLOGRAPHIC CREST</div></div>'; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
