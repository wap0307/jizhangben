/**
 * 月记账本 Service Worker（v8.21）
 *
 * 策略：network-first（先走网络，失败才用缓存）
 * 这样不会缓存旧版本——避免老妹最怕的"改了半天看不到更新"。
 *
 * 缓存范围：只缓存静态资产（HTML / JS / CSS / 图标 / manifest）。
 * 不缓存 API 调用（记账本是纯前端，无 API）。
 *
 * 兼容性：file:// 下 navigator.serviceWorker 不可用 → 注册代码已加守卫，
 *         本地双击打开不报错。
 */
const CACHE_NAME = 'ledger-app-v8.21';
const PRECACHE = [
  './',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  // 立即激活，无需等所有旧客户端关闭
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(() => {/* 单个文件缺失不致命 */}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // 清掉旧版本缓存（避免旧版数据残留）
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 不代理跨域

  event.respondWith((async () => {
    try {
      // 网络优先：拿最新
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      // 网络失败：兜底用缓存（飞机模式能记账）
      const cached = await caches.match(req);
      if (cached) return cached;
      // 整个页面离线兜底
      if (req.mode === 'navigate') {
        return caches.match('./') || new Response('离线 + 没缓存，请联网打开一次。', { status: 503 });
      }
      return new Response('offline', { status: 503 });
    }
  })());
});