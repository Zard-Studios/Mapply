/**
 * Service Worker – Offline caching for Mapply
 * Caches all static assets for offline use
 */

const CACHE_NAME = 'mapply-v1';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles/themes.css',
  '/styles/main.css',
  '/styles/canvas.css',
  '/styles/nodes.css',
  '/js/app.js',
  '/js/canvas.js',
  '/js/nodes.js',
  '/js/connections.js',
  '/js/storage.js',
  '/js/io.js',
  '/js/schema.js',
  '/js/ui.js',
  '/js/aiAdapter.js'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cached) => cached || fetch(event.request))
      .catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});
