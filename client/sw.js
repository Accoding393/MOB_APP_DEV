const CACHE = 'crms-shell-v3';
const SHELL = ['/', '/index.html', '/app.js?v=7', '/styles.css', '/vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.css'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('crms-shell-') && key !== CACHE).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (!SHELL.includes(url.pathname + url.search) && !SHELL.includes(url.pathname)) return;
  event.respondWith(fetch(event.request, { signal: AbortSignal.timeout(3000) }).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(() => caches.match(event.request)));
});
