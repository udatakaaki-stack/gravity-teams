/*
 * オフラインでも画面を開けるようにするための仕組み
 * 画面のファイルは「通信できればいつも最新、できない時は保存したもの」を使う。
 * サーバーとのやり取り（/api/）は保存しない。
 */
const CACHE = 'diet-connect-v1';
const SHELL = ['./', 'index.html', 'app.html', 'coach.html', 'style.css', 'js/calc.js', 'js/common.js', 'js/client.js', 'js/coach.js', 'icons/icon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request)));
});
