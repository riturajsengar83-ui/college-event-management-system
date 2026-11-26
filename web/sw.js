// college-event-system/web/sw.js
// Service worker for PWA installability + offline cache
const CACHE = 'college-event-v12';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/config.js?v=1',
  '/js/login.js?v=8',
  '/js/app.js?v=11',
  '/manifest.json',
  '/images/mits_logo.jpg',
  '/images/icon-192.svg',
  '/images/icon-512.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  // Never cache API calls - the dashboard must always see fresh data.
  if (url.pathname.startsWith('/api/')) return;
  const isAppShell = request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/';
  if (isAppShell) {
    e.respondWith(
      fetch(request).then((resp) => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return resp;
      }).catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((resp) => {
        if (resp.ok && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return resp;
      })
    )
  );
});
