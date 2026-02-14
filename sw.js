// Golfeados Service Worker
const CACHE_NAME = 'golfeados-v1';
const ASSETS = [
  '/golfeados/',
  '/golfeados/index.html',
  '/golfeados/manifest.json',
  '/golfeados/icon-192.png',
  '/golfeados/icon-512.png'
];

// Install — cache assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .catch(() => {}) // don't fail if some assets missing
  );
  self.skipWaiting();
});

// Activate — clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', e => {
  // Only handle same-origin and https requests
  if (!e.request.url.startsWith('https://')) return;
  
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses for the app shell
        if (res.ok && e.request.url.includes('golfeados')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
