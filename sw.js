/* Which patrol are you? — service worker.
   Offline-first shell so the quiz still runs on the Gilwell field with no signal.

   Bump CACHE whenever index.html changes, or returning visitors keep the old copy
   until the network check succeeds. The Publish workflow does not do this for you. */
const CACHE = 'patrolfinder-v16';

/* Relative so this works at /patrolfinder/ on Pages and at / on any other host. */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* addAll is all-or-nothing; one 404 would leave the whole install failing,
       so each file is allowed to miss without sinking the rest. */
    await Promise.all(SHELL.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* the tally/log API lives elsewhere */

  /* Navigations: fresh copy when there is signal, cached shell when there is not. */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (_) {
        const cache = await caches.open(CACHE);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  /* Everything else in scope: cache first, refill in the background. */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const net = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => hit || Response.error());
    return hit || net;
  })());
});
