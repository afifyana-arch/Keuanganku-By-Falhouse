/**
 * SERVICE WORKER (Revisi #2 - Cache System PWA)
 * Menangani caching aset agar aplikasi bisa berjalan Offline
 * dan update otomatis saat online.
 */

const CACHE_NAME = 'keuanganku-v2'; // Ganti versi ini jika ada update besar di masa depan

// Daftar file yang WAJIB disimpan di memori HP user
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon.png',
    
    // HTML Fragments
    './dashboard.html',
    './tracking.html',
    './history.html',
    './accounts.html',
    './budgeting.html',
    './savings.html',
    './debt.html',
    './settings.html',

    // Javascript Modules
    './dashboard.js',
    './tracking.js',
    './history.js',
    './accounts.js',
    './budgeting.js',
    './savings.js',
    './debt.js',
    './settings.js',

    // CDN Libraries (Agar offline tetap jalan)
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// 1. INSTALL SERVICE WORKER
// Menyimpan semua file aset ke dalam Cache saat pertama kali dibuka
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching App Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Paksa SW baru untuk segera aktif
});

// 2. ACTIVATE SERVICE WORKER
// Menghapus Cache versi lama jika ada update versi (CACHE_NAME berubah)
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Ambil alih kontrol halaman segera
});

// 3. FETCH EVENT (Strategi: Stale-While-Revalidate)
// Cek Cache dulu (biar cepat), tapi tetap download versi baru di background untuk kunjungan berikutnya.
self.addEventListener('fetch', (event) => {
    // Abaikan request selain GET atau request ke API/Extension
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Ambil dari jaringan (Network)
            const networkFetch = fetch(event.request)
                .then((response) => {
                    // Update cache dengan versi terbaru dari jaringan
                    const resClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, resClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Jika offline dan tidak ada di cache (misal gambar baru), biarkan error atau kasih fallback
                    // Untuk aplikasi ini, cachedResponse biasanya sudah cukup.
                });

            // Kembalikan Cache jika ada, jika tidak tunggu Network
            return cachedResponse || networkFetch;
        })
    );
});