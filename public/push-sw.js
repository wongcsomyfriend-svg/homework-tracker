/* Push notification handlers for Workbox-generated service worker.
 * Loaded via workbox.importScripts from vite.config.ts
 */

self.addEventListener('push', (event) => {
  let title = '功課提醒'
  let body = '有待處理的功課'
  let url = './'
  try {
    if (event.data) {
      const payload = event.data.json()
      title = payload.title || title
      body = payload.body || body
      url = payload.url || url
    }
  } catch {
    try {
      body = event.data?.text() || body
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      icon: './favicon.svg',
      badge: './favicon.svg',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || './'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(target)
    }),
  )
})
