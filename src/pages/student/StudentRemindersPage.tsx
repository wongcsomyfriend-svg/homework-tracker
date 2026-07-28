import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { isCloudMode } from '../../lib/cloud'
import { ensureAnonymousSession } from '../../lib/studentApi'
import {
  createReminderRule,
  deleteReminderRule,
  disablePush,
  enablePush,
  getNotificationPermission,
  hasVapidKey,
  isPushSupported,
  listReminderRules,
  setReminderEnabled,
  syncPushIfGranted,
  type ReminderRule,
} from '../../lib/push'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function StudentRemindersPage() {
  const cloud = isCloudMode()
  const [rules, setRules] = useState<ReminderRule[]>([])
  const [permission, setPermission] = useState<string>('default')
  const [weekday, setWeekday] = useState(1)
  const [timeOfDay, setTimeOfDay] = useState('08:00')
  const [label, setLabel] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    if (!cloud) return
    await ensureAnonymousSession()
    setRules(await listReminderRules())
    setPermission(await getNotificationPermission())
  }

  useEffect(() => {
    void (async () => {
      try {
        await refresh()
        await syncPushIfGranted().catch(() => undefined)
        setPermission(await getNotificationPermission())
      } catch (error) {
        setErr(error instanceof Error ? error.message : '載入失敗')
      }
    })()
  }, [cloud])

  async function onEnablePush() {
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      await ensureAnonymousSession()
      await enablePush()
      setPermission('granted')
      setMsg('已開啟推送通知')
    } catch (error) {
      setErr(error instanceof Error ? error.message : '無法開啟推送')
    } finally {
      setBusy(false)
    }
  }

  async function onDisablePush() {
    setBusy(true)
    setErr('')
    try {
      await disablePush()
      setMsg('已關閉此裝置推送')
    } catch (error) {
      setErr(error instanceof Error ? error.message : '關閉失敗')
    } finally {
      setBusy(false)
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      await ensureAnonymousSession()
      // Save reminder first so push failures never block scheduling.
      await createReminderRule({
        weekday,
        timeOfDay,
        label: label || `每週${WEEKDAYS[weekday]} ${timeOfDay} 欠交提醒`,
        classId: null,
      })
      setLabel('')
      await refresh()
      setMsg('已新增提醒')

      if (isPushSupported() && hasVapidKey()) {
        try {
          await enablePush()
          setPermission('granted')
          setMsg('已新增提醒，並已開啟此裝置推送')
        } catch (pushError) {
          const pushMsg =
            pushError instanceof Error ? pushError.message : '無法開啟推送'
          setErr(`提醒已儲存，但推送未開啟：${pushMsg}`)
        }
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : '新增失敗')
    } finally {
      setBusy(false)
    }
  }

  if (!cloud) {
    return (
      <div className="panel p-6">
        <h1 className="text-2xl font-bold">提醒設定</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">提醒功能需要雲端模式。</p>
        <Link to="/" className="btn btn-ghost mt-4">
          返回
        </Link>
      </div>
    )
  }

  const pushBlocked = !isPushSupported() || !hasVapidKey()

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h1 className="text-2xl font-bold">提醒設定</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          設定每週固定時間提醒自己尚欠交的功課。新增提醒時會一併嘗試開啟推送（iOS
          需用主畫面 App）。
        </p>
        {!isPushSupported() && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            此瀏覽器不支援 Web Push。請用 Safari「加入主畫面」後再開啟。
          </p>
        )}
        {!hasVapidKey() && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            尚未設定 VITE_VAPID_PUBLIC_KEY，無法註冊推送。
          </p>
        )}
        {msg && (
          <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{msg}</p>
        )}
        {err && (
          <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
            {err}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || pushBlocked}
            onClick={() => void onEnablePush()}
          >
            {busy ? '處理中…' : `開啟推送（權限：${permission}）`}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => void onDisablePush()}
          >
            關閉此裝置推送
          </button>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold">新增每週提醒</h2>
        <form onSubmit={onCreate} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="field">
            <label>星期</label>
            <select
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  星期{d}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>時間</label>
            <input
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              required
            />
          </div>
          <div className="field sm:col-span-2">
            <label>說明（可選）</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例如：每朝提醒欠交功課"
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-secondary" disabled={busy}>
              {busy ? '處理中…' : '新增提醒'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-4 py-3 font-bold">
          我的提醒
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <div className="font-semibold">
                  每週{WEEKDAYS[r.weekday]} {r.timeOfDay}
                </div>
                <div className="text-sm text-[var(--muted)]">
                  {r.label || '欠交提醒'}
                  {!r.enabled ? ' · 已停用' : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    void setReminderEnabled(r.id, !r.enabled)
                      .then(refresh)
                      .catch((error) =>
                        setErr(error instanceof Error ? error.message : '更新失敗'),
                      )
                  }
                >
                  {r.enabled ? '停用' : '啟用'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() =>
                    void deleteReminderRule(r.id)
                      .then(refresh)
                      .catch((error) =>
                        setErr(error instanceof Error ? error.message : '刪除失敗'),
                      )
                  }
                >
                  刪除
                </button>
              </div>
            </li>
          ))}
          {rules.length === 0 && (
            <li className="px-4 py-4 text-sm text-[var(--muted)]">尚未設定提醒</li>
          )}
        </ul>
      </section>
    </div>
  )
}
