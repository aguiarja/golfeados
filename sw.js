// Golfeados Service Worker — v4.3.1
// Network-first for HTML, cache-first for static assets
const CACHE_NAME = 'golfeados-v4.4.0';
const STATIC_ASSETS = [
  'icon-192.png',
  'icon-512.png'
];

// Install: cache static assets only
self.addEventListener('install', event => {
  console.log('[SW] Install', CACHE_NAME);
  // Skip waiting immediately — take control ASAP
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

// Activate: delete ALL old caches, claim clients immediately
self.addEventListener('activate', event => {
  console.log('[SW] Activate', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => {
        console.log('[SW] Deleting old cache:', n);
        return caches.delete(n);
      }))
    ).then(() => self.clients.claim())
  );
});

// Fetch: NETWORK-FIRST for HTML/navigation, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Navigation requests (HTML pages) — ALWAYS network first
  if (event.request.mode === 'navigate' ||
      event.request.destination === 'document' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets (images, icons) — cache first with network fallback
  if (event.request.destination === 'image' || url.pathname.match(/\.(png|jpg|svg|ico|webp)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return resp;
      }))
    );
    return;
  }

  // Everything else (JS, CSS, API calls) — network first
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// Listen for skip-waiting message from client
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    console.log('[SW] Received skipWaiting message');
    self.skipWaiting();
  }
});
