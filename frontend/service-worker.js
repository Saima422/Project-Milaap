const CACHE_VERSION = 'v1'
const CACHE_NAME = 'kumbh-sahayak-' + CACHE_VERSION

const CACHED_FILES = [
  '/intake.html',
  '/scanner.html',
  '/operator.html',
  '/dashboard.html',
  '/styles.css',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHED_FILES))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  if (url.hostname === 'localhost' &&
      (url.port === '3001' || url.port === '3002')) {
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/offline.html'))
    )
    return
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  )
})
