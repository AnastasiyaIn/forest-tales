// Имя кэша
const CACHE_NAME = 'forest-tales-cache-v3'; // Обновили версию, чтобы сбросить старый кэш

// Минимальный список файлов для кэширования
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
    '/interactives.json',
    '/stories.json',
    '/manifest.json',
    '/firebase-config.js',
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
            .then(() => {
                console.log('Service Worker: Installation complete');
                // Принудительно активируем новый Service Worker
                self.skipWaiting();
            })
            .catch(error => console.error('Service Worker: Cache failed:', error))
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
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
            // Принудительно берём контроль над страницей
            self.clients.claim();
        })
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
                return fetch(event.request)
                    .then(networkResponse => {
                        // Кэшируем новый ответ
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return networkResponse;
                    })
                    .catch(error => {
                        console.error('Service Worker: Fetch failed:', error);
                        // Если оффлайн и нет в кэше, возвращаем заглушку
                        return caches.match('/index.html');
                    });
            })
    );
});

// Сообщаем странице об обновлении Service Worker
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CHECK_FOR_UPDATES') {
        fetch('/index.html', { cache: 'no-store' })
            .then(() => {
                // Если есть обновления, Service Worker уже обновится (благодаря skipWaiting и clients.claim)
                event.source.postMessage({ type: 'UPDATE_AVAILABLE' });
            })
            .catch(err => {
                console.error('Error checking for updates:', err);
            });
    }
}); 