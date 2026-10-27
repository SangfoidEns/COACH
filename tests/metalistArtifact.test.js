import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/artifacts/MetalistHoloEmblem.js', import.meta.url), 'utf8');
test('Metalist holographic emblem artifact is isolated and renderable', () => {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const artifact = context.window.MetalistHoloEmblem;
  assert.equal(artifact.id, 'metalist_holo_emblem');
  assert.match(artifact.markup(), /ms-holo-svg/);
  assert.match(artifact.markup(), /aria-hidden="true"/);
  assert.match(artifact.inspectMarkup(), /CLUB SIGNAL · 001/);
  assert.match(artifact.inspectMarkup(), /METALIST/);
});
