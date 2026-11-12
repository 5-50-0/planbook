// 설치형 앱용: 인터넷이 되면 항상 새 파일, 안 되면 저장해 둔 파일
const CACHE = 'planbook-v1.5.2';
const SHELL = ['./', './index.html', './css/app.css?v=1.2.0', './js/app.js?v=1.2.0', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    // 항상 서버에 새 파일이 있는지 확인 (업데이트 직후 예전 파일을 쓰지 않도록)
    fetch(e.request, { cache: 'no-cache' }).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
