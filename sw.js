// 我的健康日誌 Service Worker v2.5
const CACHE_NAME = 'health-journal-v2.5';
const ASSETS = [
  '/health-journal/',
  '/health-journal/index.html',
];

// 安裝：快取核心資源
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 啟動：清除舊版快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 攔截請求：網路優先，失敗用快取
self.addEventListener('fetch', e => {
  // API 請求不快取
  if (e.request.url.includes('script.google.com') ||
      e.request.url.includes('api.anthropic.com') ||
      e.request.url.includes('fonts.googleapis.com')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 成功則更新快取
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
