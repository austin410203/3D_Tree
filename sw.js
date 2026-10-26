// Offline support for the web/PWA build: app files are network-first so updates land.
const CACHE = 'seasontree-v13';
const CORE = ['./', 'index.html', 'style.css', 'app.js', 'core.js', 'tree.js', 'audio.js', 'native.js', 'i18n.js', 'manifest.webmanifest',
  'scenes/common.js', 'scenes/sea.js', 'scenes/lotus.js', 'scenes/candle.js', 'scenes/aurora.js',
  'scenes/rain.js', 'scenes/snow.js', 'scenes/camp.js', 'scenes/whale.js', 'scenes/overlook.js', 'scenes/lighthouse.js', 'scenes/mountain.js', 'scenes/deer.js',
  'vendor/three/three.module.js', 'vendor/three/addons/controls/OrbitControls.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
  }
});
