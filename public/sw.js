/* Norvex v2 service worker — network-first for pages, cache-first for assets */
const CACHE = 'norvex-v2';
const ASSETS = [
  '/css/nv.css',
  '/js/nv-core.js', '/js/nv-auth.js', '/js/ui.js', '/js/shell.js', '/js/catalog-snapshot.js',
  '/img/logo.png', '/img/logo-light.png', '/img/mark.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  const isAsset = /\.(css|js|png|jpe?g|svg|webp|woff2)$/.test(url.pathname);
  if (isAsset) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    })));
  } else {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  }
});
