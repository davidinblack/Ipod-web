// sw.js — la app se pide SIEMPRE a la red (así se actualiza sola al publicar cambios);
// la caché sólo se usa si no hay conexión.
const CACHE = 'ipod-shell';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'id3.js', 'db.js', 'library.js', 'player.js',
  'manifest.webmanifest', 'version.json', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-store' });
      if (res.ok && !url.search) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html');
      throw new Error('offline');
    }
  })());
});
