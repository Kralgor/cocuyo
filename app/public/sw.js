// Cocuyo service worker — hand-written, no next-pwa dependency.
//
// Cache strategy:
//   status.json  → network-first, cache fallback (live data)
//   everything else → cache-first, network fallback (app shell + assets)
//
// Offline: stale status.json served from cache.
// Frontend detects offline state and shows the "Offline" banner (api.ts).

const SHELL = 'cocuyo-shell-v1';
const DATA  = 'cocuyo-data-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(['/', '/manifest.json']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL && k !== DATA)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Network-first for status.json (must stay fresh; fallback to cache on outage)
  if (url.pathname.endsWith('status.json')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(DATA).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((cached) => cached || Response.error())
        )
    );
    return;
  }

  // Cache-first for shell and static assets
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          caches.open(SHELL).then((c) => c.put(e.request, res.clone()));
        }
        return res;
      });
    })
  );
});
