// GH Hostels Service Worker — push notifications + offline caching

const CACHE_NAME = 'ahms-v1'

// Static assets to cache on install
const PRECACHE_URLS = [
  '/offline',
]

// ── Install: precache offline page ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  )
  self.skipWaiting()
})

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: network-first with offline fallback for navigation ────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin navigation
  if (
    event.request.method !== 'GET' ||
    !event.request.url.startsWith(self.location.origin)
  ) return

  const url = new URL(event.request.url)

  // Skip API and auth routes — always network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  // For navigation requests, try network then fall back to offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match('/offline')
        return cached ?? new Response('Offline', { status: 503 })
      })
    )
  }
})

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { data = { title: 'Alert', body: event.data.text() } }

  const title   = data.title ?? 'GH Hostels'
  const options = {
    body:  data.body  ?? '',
    icon:  '/icons/icon.svg',
    badge: '/icons/icon.svg',
    tag:   data.tag   ?? 'ahms-alert',
    data:  { url: data.url ?? '/' },
    requireInteraction: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
