import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function hasVapidKey() {
  return Boolean(VAPID_PUBLIC_KEY)
}

export async function getNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('此裝置不支援 Service Worker')
  }

  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) {
    return withTimeout(
      navigator.serviceWorker.ready,
      10000,
      'Service Worker 尚未就緒。請關閉 App 後從主畫面重新開啟。',
    )
  }

  const swUrl = `${import.meta.env.BASE_URL}sw.js`
  await withTimeout(
    navigator.serviceWorker.register(swUrl),
    10000,
    'Service Worker 註冊逾時。請關閉 App 後從主畫面重新開啟。',
  )
  return withTimeout(
    navigator.serviceWorker.ready,
    10000,
    'Service Worker 尚未就緒。請關閉 App 後從主畫面重新開啟。',
  )
}

export async function enablePush() {
  if (!supabase) throw new Error('此功能需要雲端模式')
  if (!isPushSupported()) throw new Error('此裝置不支援推送通知')
  if (!VAPID_PUBLIC_KEY) throw new Error('尚未設定 VITE_VAPID_PUBLIC_KEY')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('未允許通知權限')

  const registration = await getServiceWorkerRegistration()
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('無法取得推送訂閱資訊')
  }

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('請先認領身份或登入')

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: auth.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)
  return true
}

/** Re-register if permission already granted (no prompt). Safe to call on page load. */
export async function syncPushIfGranted() {
  if (!isPushSupported() || !hasVapidKey() || !supabase) return false
  if (Notification.permission !== 'granted') return false
  await enablePush()
  return true
}

export async function disablePush() {
  if (!supabase) return
  const registration = await getServiceWorkerRegistration().catch(() => null)
  if (!registration) return
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  }
}

export type ReminderRule = {
  id: string
  weekday: number
  timeOfDay: string
  timezone: string
  label: string
  classId: string | null
  enabled: boolean
}

export async function listReminderRules(): Promise<ReminderRule[]> {
  if (!supabase) throw new Error('此功能需要雲端模式')
  const { data, error } = await supabase
    .from('reminder_rules')
    .select('*')
    .order('weekday')
    .order('time_of_day')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    weekday: row.weekday as number,
    timeOfDay: String(row.time_of_day).slice(0, 5),
    timezone: row.timezone as string,
    label: (row.label as string) || '',
    classId: (row.class_id as string | null) ?? null,
    enabled: Boolean(row.enabled),
  }))
}

export async function createReminderRule(input: {
  weekday: number
  timeOfDay: string
  label: string
  classId?: string | null
}) {
  if (!supabase) throw new Error('此功能需要雲端模式')
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('請先認領身份或登入')
  const { error } = await supabase.from('reminder_rules').insert({
    user_id: auth.user.id,
    weekday: input.weekday,
    time_of_day: input.timeOfDay,
    timezone: 'Asia/Hong_Kong',
    label: input.label.trim(),
    class_id: input.classId || null,
    enabled: true,
  })
  if (error) throw new Error(error.message)
}

export async function deleteReminderRule(id: string) {
  if (!supabase) throw new Error('此功能需要雲端模式')
  const { error } = await supabase.from('reminder_rules').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setReminderEnabled(id: string, enabled: boolean) {
  if (!supabase) throw new Error('此功能需要雲端模式')
  const { error } = await supabase
    .from('reminder_rules')
    .update({ enabled })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
