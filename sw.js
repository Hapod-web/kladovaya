// Сервис-воркер: после первого открытия сайт хранится в телефоне и работает без интернета.
// Когда интернет есть, файлы обновляются сами (сначала пробуем сеть, потом запасная копия).
var CACHE = 'kladovaya-v2';
var CORE = ['./', 'index.html', 'data.js', 'manifest.json', 'IMG_3441.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        // каждый файл отдельно: если какого-то нет, остальные всё равно сохранятся
        return Promise.all(CORE.map(function (u) {
          return fetch(u, { cache: 'reload' }).then(function (r) {
            if (r.ok) return c.put(u, r);
          }).catch(function () {});
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(new Promise(function (resolve) {
    var settled = false;
    function done(res) { if (!settled && res) { settled = true; resolve(res); } }
    function fromCache() {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('index.html') : null);
      });
    }
    // Если сеть отвечает дольше 3 секунд, отдаём копию из телефона
    var timer = setTimeout(function () { fromCache().then(done); }, 3000);

    fetch(req.url, { cache: 'no-cache' }).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      done(res);
    }).catch(function () {
      clearTimeout(timer);
      fromCache().then(function (hit) { done(hit || Response.error()); });
    });
  }));
});
