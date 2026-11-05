/* Service worker: keeps a copy of the app on the phone so it opens offline.
   Generated at build time: the version and file list below are filled in by vite.config.ts. */
const VERSION = '__VERSION__';
const ASSETS = __ASSETS__;
const CACHE = `gym-tracker-${VERSION}`;

self.addEventListener('install', (event) => {
  // No skipWaiting here: the new version waits until the user taps "Update" in the app.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gym-tracker-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match('./').then((hit) => hit || fetch(req)),
      ),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then((cache) => cache.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))),
  );
});
