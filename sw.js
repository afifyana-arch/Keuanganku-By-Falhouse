// Nama cache (Ganti v1 ke v2, v3 dst jika Anda update kode di masa depan agar user dapat versi baru)
const CACHE_NAME = 'keuanganku-v1';

// DAFTAR SEMUA FILE APLIKASI DI SINI
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  
  // Modul Fitur (HTML & JS)
  './dashboard.html', './dashboard.js',
  './tracking.html',  './tracking.js',
  './accounts.html',  './accounts.js',
  './budgeting.html', './budgeting.js',
  './history.html',   './history.js',
  './savings.html',   './savings.js',
  './debt.html',      './debt.js',
  './settings.html',  './settings.js',
  
  // Ikon (Pastikan file ini ada)
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// 1. Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Menyimpan file ke cache...');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Fetch: Gunakan strategi "Stale-While-Revalidate" atau "Network First"
// Agar saat Anda update codingan, user tidak terjebak di versi lama selamanya.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Kembalikan cache jika ada
      if (cachedResponse) {
        return cachedResponse;
      }
      // Jika tidak ada di cache, ambil dari jaringan
      return fetch(event.request);
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
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});