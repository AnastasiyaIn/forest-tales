const CACHE_NAME = 'forest-tales-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/toc.html',
    '/story.html',
    '/interactive.html',
    '/styles.css',
    '/story.js',
    '/interactive.js',
    '/utils.js',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .catch(error => console.error('Service Worker: Cache failed:', error))
    );
});

self.addEventListener('fetch', event => {
    console.log('Service Worker: Fetching', event.request.url);
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    console.log('Service Worker: Found in cache', event.request.url);
                    return response;
                }
                console.log('Service Worker: Fetching from network', event.request.url);
                return fetch(event.request);
            })
            .catch(error => console.error('Service Worker: Fetch failed:', error))
    );
});

self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});