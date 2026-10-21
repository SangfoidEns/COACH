import { cp, mkdir, rm } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const item of ['index.html','manifest.webmanifest','sw.js','assets','src']) {
  try { await cp(new URL('../'+item, import.meta.url), new URL('../dist/'+item, import.meta.url), { recursive: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
console.log('Production build ready: dist/');
