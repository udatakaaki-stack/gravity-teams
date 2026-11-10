// オフライン用キャッシュ。一度ネットのある場所で開けば、電波のない球場でも起動できる
const CACHE = 'tell-alert-v2.1.2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png',
  './fonts/NotoSansJP-subset-Regular.woff2', './fonts/NotoSansJP-subset-Bold.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// 同じサイト内のファイルだけ扱う（AIへの通信はキャッシュしない）
// 電波が弱いと読み込みが止まるので、3秒で諦めてキャッシュを使う
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000));
  e.respondWith(
    Promise.race([fetch(e.request), timeout])
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then(r => r || caches.match('./index.html')))
  );
});
