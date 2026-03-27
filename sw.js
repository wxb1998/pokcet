// Service Worker - 离线缓存支持
const CACHE_NAME = 'shanhaijing-v12';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/state.js',
  './js/utils.js',
  './js/save.js',
  './js/constants/index.js',
  './js/constants/elements.js',
  './js/constants/skills.js',
  './js/constants/species.js',
  './js/constants/zones.js',
  './js/constants/treasure-data.js',
  './js/constants/talents.js',
  './js/constants/capture-items.js',
  './js/constants/rune-data.js',
  './js/constants/dungeon-data.js',
  './js/systems/pet.js',
  './js/systems/battle.js',
  './js/systems/capture.js',
  './js/systems/comprehend.js',
  './js/systems/treasure.js',
  './js/systems/garden.js',
  './js/systems/rune.js',
  './js/systems/dungeon.js',
  './js/ui/header-ui.js',
  './js/ui/battle-ui.js',
  './js/ui/pets-ui.js',
  './js/ui/formation-ui.js',
  './js/ui/treasure-ui.js',
  './js/ui/dex-ui.js',
  './js/ui/shop-ui.js',
  './js/ui/garden-ui.js',
  './js/ui/rune-ui.js',
  './js/ui/dungeon-ui.js',
  './js/ui/sprites.js',
  './js/ui/tooltip.js'
];

// 安装时缓存所有资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 请求拦截：缓存优先，网络回退
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // 缓存新请求的资源
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // 完全离线时返回首页
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
