// Nama cache (Update versi agar browser mengambil file baru)
const CACHE_NAME = 'keuanganku-v3-root-icon';

// Daftar file yang akan disimpan di memori HP
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.png', // Ikon di root
  
  // Modul Fitur (HTML & JS)
  './dashboard.html', './dashboard.js',
  './tracking.html',  './tracking.js',
  './accounts.html',  './accounts.js',
  './budgeting.html', './budgeting.js',
  './history.html',   './history.js',
  './savings.html',   './savings.js',
  './debt.html',      './debt.js',
  './settings.html',  './settings.js'
];

// 1. Install Service Worker
self.addEventListener('install', event => {
  self.skipWaiting(); // Paksa aktif segera
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Menyimpan file aplikasi ke cache...');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Fetch Strategy: Cache First, Network Fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});

// 3. Activate: Hapus cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Membersihkan cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});