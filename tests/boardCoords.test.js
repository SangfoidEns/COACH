import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Lightweight pure helpers mirroring BoardEngine world clamp logic
function clampWorld(x, y) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  return { x: clamp(Number(x) || 0, 0.02, 0.98), y: clamp(Number(y) || 0, 0.02, 0.98) };
}
function sizeStage(cw, ch, AR = 68/105) {
  let w, h;
  if (cw / ch > AR) { h = ch; w = h * AR; }
  else { w = cw; h = w / AR; }
  return { w, h, left: (cw - w) / 2, top: (ch - h) / 2 };
}

describe('board coordinate integrity', () => {
  it('clampWorld keeps chips inside pitch', () => {
    assert.deepEqual(clampWorld(-1, 2), { x: 0.02, y: 0.98 });
    assert.deepEqual(clampWorld(0.5, 0.5), { x: 0.5, y: 0.5 });
  });
  it('sizeStage preserves 68:105 aspect in landscape container', () => {
    const s = sizeStage(1000, 600);
    assert.ok(Math.abs(s.w / s.h - 68/105) < 0.001);
    assert.ok(s.h <= 600 + 0.01);
    assert.ok(s.w <= 1000 + 0.01);
  });
  it('sizeStage preserves aspect in portrait container', () => {
    const s = sizeStage(390, 700);
    assert.ok(Math.abs(s.w / s.h - 68/105) < 0.001);
  });
});
