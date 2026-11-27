/* Norvex v3 service worker.
   Strategy: NETWORK-FIRST for pages + code (HTML/CSS/JS) so updates always land
   when online; CACHE-FIRST for images/fonts. Offline falls back to cache.
   The cache name is versioned — bumping it purges stale caches on activate. */
const CACHE = 'norvex-v7';
const PRECACHE = [
  '/css/nv.css',
  '/js/nv-core.js', '/js/nv-auth.js', '/js/ui.js', '/js/shell.js', '/js/catalog-snapshot.js',
  '/img/logo.png', '/img/logo-light.png', '/img/mark.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  const isMedia = /\.(png|jpe?g|svg|webp|woff2|ico)$/.test(url.pathname);

  if (isMedia) {
    /* cache-first for static media */
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }))
    );
    return;
  }

  /* network-first for pages + code: always try the network so edits propagate,
     fall back to the cached copy (ignoring ?v= cache-bust queries) when offline */
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
