/* Push notification handlers for Workbox-generated service worker.
 * Loaded via workbox.importScripts from vite.config.ts
 *
 * Note: iOS Safari / home-screen PWAs ignore sound, vibrate, requireInteraction,
 * actions, and custom icons. System decides delivery; cannot match WhatsApp.
 */

self.addEventListener('push', (event) => {
  let title = '功課提醒'
  let body = '有待處理的功課'
  let url = './'
  let tag = 'homework-reminder'
  try {
    if (event.data) {
      const payload = event.data.json()
      title = payload.title || title
      body = payload.body || body
      url = payload.url || url
      tag = payload.tag || tag
    }
  } catch {
    try {
      body = event.data?.text() || body
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body,
        data: { url },
        tag,
        renotify: true,
        // Helps Android keep the alert visible; iOS ignores this.
        requireInteraction: true,
        silent: false,
        icon: './favicon.svg',
        badge: './favicon.svg',
      })
      try {
        if (self.navigator?.setAppBadge) {
          await self.navigator.setAppBadge(1)
        }
      } catch {
        /* badge unsupported */
      }
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || './'
  event.waitUntil(
    (async () => {
      try {
        if (self.navigator?.clearAppBadge) await self.navigator.clearAppBadge()
      } catch {
        /* ignore */
      }
      const clientList = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(target)
    })(),
  )
})
