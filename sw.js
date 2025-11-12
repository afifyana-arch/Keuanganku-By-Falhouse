// Nama cache
const CACHE_NAME = 'keuanganku-cache-v1';

// Daftar file inti yang perlu di-cache
const urlsToCache = [
  '.', // Ini mewakili start_url (index.html)
  'index.html',
  'app.js',
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png'
  // Kita tidak men-cache file CDN (Bootstrap, Chart.js) agar tetap up-to-date
  // dan menghindari kompleksitas.
];

// 1. Saat Instalasi: Buka cache dan tambahkan file inti
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Saat Fetch (Permintaan): Coba ambil dari cache dulu,
//    jika tidak ada, ambil dari jaringan (network).
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Jika ada di cache, kembalikan dari cache
        if (response) {
          return response;
        }
        // Jika tidak, ambil dari jaringan
        return fetch(event.request);
      })
  );
});

// 3. Saat Aktivasi: Hapus cache lama jika ada versi baru
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});