const CACHE_NAME = 'metalist-coach-v20261028l';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './assets/metalist-mark.svg',
  './src/styles/app.css',
  './src/core/utils.js', './src/core/toast.js', './src/core/store.js',
  './src/core/auth.js', './src/core/storage.js', './src/core/modal.js', './src/core/loadModel.js',
  './src/telegram/TelegramManager.js', './src/data/demo.js', './src/data/schemes.js',
  './src/board/TimerEngine.js', './src/board/BoardEngine.js',
  './src/ui/views.js', './src/ui/ai.js', './src/ui/app.js', './src/ui/actions.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
