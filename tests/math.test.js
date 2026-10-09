import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, dist, uid } from '../src/utils/math.js';

describe('math utils', () => {
  it('clamp', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(99, 0, 10), 10);
  });

  it('lerp', () => {
    assert.equal(lerp(0, 10, 0.5), 5);
  });

  it('dist', () => {
    assert.ok(Math.abs(dist({ x: 0, y: 0 }, { x: 3, y: 4 }) - 5) < 1e-9);
  });

  it('uid unique', () => {
    assert.notEqual(uid(), uid());
  });
});
