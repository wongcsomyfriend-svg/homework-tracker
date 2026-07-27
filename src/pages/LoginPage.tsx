import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../hooks/useData'
import {
  exportWorkspaceJson,
  getStorageDriver,
  importWorkspaceJson,
  readyStorage,
} from '../lib/store'
import { supabase, supabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const data = useData()
  const driver = getStorageDriver()
  const fileRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      setUserEmail(sessionData.session?.user.email ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null)
      void readyStorage().catch(() => undefined)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  function showOk(text: string) {
    setErr('')
    setMsg(text)
  }

  function showError(text: string) {
    setMsg('')
    setErr(text)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) {
      showError(
        '尚未設定 Supabase。請在 .env 填入 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY，並設 VITE_STORAGE_DRIVER=supabase。',
      )
      return
    }
    setBusy(true)
    setMsg('')
    setErr('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}login`,
      },
    })
    setBusy(false)
    if (error) showError(error.message)
    else showOk('已寄出登入連結，請檢查電郵。')
  }

  async function onSignOut() {
    if (!supabase) return
    setBusy(true)
    await supabase.auth.signOut()
    setBusy(false)
    showOk('已登出')
  }

  async function onExport() {
    setBusy(true)
    try {
      const json = await exportWorkspaceJson()
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `homework-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showOk('已匯出 JSON 備份')
    } catch (e) {
      showError(e instanceof Error ? e.message : '匯出失敗')
    } finally {
      setBusy(false)
    }
  }

  async function onImportFile(file: File) {
    setBusy(true)
    try {
      const text = await file.text()
      if (
        !confirm(
          '匯入會覆寫目前工作區資料（本機或已登入的雲端）。確定繼續？',
        )
      ) {
        setBusy(false)
        return
      }
      await importWorkspaceJson(text)
      showOk('已匯入資料')
    } catch (e) {
      showError(e instanceof Error ? e.message : '匯入失敗')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold">設定與登入</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          目前儲存：{data.storageMode}
        </p>
        {driver === 'local' && (
          <p className="mt-2 text-sm text-[var(--muted)]">
            本機模式資料存在瀏覽器 localStorage。切換雲端前請先匯出 JSON，再於登入後匯入。
          </p>
        )}
        {driver === 'supabase' && !userEmail && (
          <p className="mt-2 text-sm font-semibold text-amber-800">
            雲端模式需登入後才能讀寫資料。
          </p>
        )}
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold">資料備份</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          匯出／匯入 JSON（班別、學生、功課、提交）。可用於搬機或本機 → 雲端遷移。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || !data.storageReady}
            onClick={() => void onExport()}
          >
            匯出 JSON
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !data.storageReady}
            onClick={() => fileRef.current?.click()}
          >
            匯入 JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onImportFile(file)
            }}
          />
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold">雲端登入（Magic Link）</h2>
        {!supabaseConfigured ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            尚未設定 Supabase。在 `.env` 填入 `VITE_SUPABASE_URL`、
            `VITE_SUPABASE_ANON_KEY`，設 `VITE_STORAGE_DRIVER=supabase`，並在 SQL
            Editor 執行 `supabase/schema.sql` 後重新部署。
          </p>
        ) : userEmail ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm">
              已登入：<span className="font-semibold">{userEmail}</span>
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void onSignOut()}
            >
              登出
            </button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-[var(--muted)]">
              登入後會自動建立學校工作區（RLS 按學校隔離）。建議流程：本機匯出 →
              登入 → 匯入雲端。
            </p>
            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <div className="field">
                <label>電郵</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@school.edu.hk"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={busy}
              >
                {busy ? '傳送中…' : '寄送 Magic Link'}
              </button>
            </form>
          </>
        )}
        {msg && (
          <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{msg}</p>
        )}
        {err && (
          <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
            {err}
          </p>
        )}
        <Link to="/" className="btn btn-ghost mt-4 w-full">
          返回主頁
        </Link>
      </section>
    </div>
  )
}
