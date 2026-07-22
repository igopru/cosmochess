const CACHE = 'cosmochess-v1';
const URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/stockfish.js',
  '/manifest.json',
  '/vendor/jquery-3.5.1.min.js',
  '/vendor/chess-0.10.3.min.js',
  '/vendor/chessboard-1.0.0.min.js',
  '/vendor/chessboard-1.0.0.min.css',
  '/img/icon-192x192.png',
  '/img/icon-512x512.png',
  '/img/chesspieces/wikipedia/bB.png',
  '/img/chesspieces/wikipedia/bK.png',
  '/img/chesspieces/wikipedia/bN.png',
  '/img/chesspieces/wikipedia/bP.png',
  '/img/chesspieces/wikipedia/bQ.png',
  '/img/chesspieces/wikipedia/bR.png',
  '/img/chesspieces/wikipedia/wB.png',
  '/img/chesspieces/wikipedia/wK.png',
  '/img/chesspieces/wikipedia/wN.png',
  '/img/chesspieces/wikipedia/wP.png',
  '/img/chesspieces/wikipedia/wQ.png',
  '/img/chesspieces/wikipedia/wR.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return c.addAll(URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('/api/') !== -1) {
    e.respondWith(fetch(e.request).catch(function() { return new Response('', { status: 503 }); }));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(r) {
      return r || fetch(e.request).then(function(res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
        }
        return res;
      });
    }).catch(function() {
      return new Response('', { status: 408 });
    })
  );
});
