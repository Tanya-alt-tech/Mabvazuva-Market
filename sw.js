/* Vazuva: lets the site install as an app and open without a connection.
   Pages and code always come fresh from the internet when there is a
   connection, so your changes on GitHub still show up straight away.
   Database requests are never stored here. */
const CACHE = 'vazuva-v2';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'hero.jpg', 'icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  const isImage = /\.(jpe?g|png|webp|svg)$/i.test(url.pathname);
  if (isImage) {
    // Show the stored copy at once, refresh it in the background.
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const fresh = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || fresh;
    })));
    return;
  }

  // Pages, code and settings: internet first, stored copy when offline.
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
