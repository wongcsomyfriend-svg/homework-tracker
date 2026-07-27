import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../hooks/useData'
import {
  exportWorkspaceJson,
  getJoinCode,
  getStorageDriver,
  importWorkspaceJson,
  readyStorage,
  rotateJoinCode,
} from '../lib/store'
import { getStudentAppUrl } from '../lib/cloud'
import { supabase, supabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const data = useData()
  const driver = getStorageDriver()
  const fileRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState<string | null>(null)

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

  useEffect(() => {
    if (data.workspaceState !== 'ready') {
      setJoinCode(null)
      return
    }
    void getJoinCode()
      .then(setJoinCode)
      .catch(() => setJoinCode(null))
  }, [data.workspaceState, data.school.id])

  function showOk(text: string) {
    setErr('')
    setMsg(text)
  }

  function showError(text: string) {
    setMsg('')
    setErr(text)
  }

  async function onSendCode(e: FormEvent) {
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
      email: email.trim(),
      options: {
        // Still set redirect for users who click the link; primary flow is OTP in-app.
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}login`,
      },
    })
    setBusy(false)
    if (error) showError(error.message)
    else {
      setOtpSent(true)
      setOtp('')
      showOk('已寄出 6 位數驗證碼，請查看電郵後在下方輸入（不用點連結）。')
    }
  }

  async function onVerifyCode(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    const token = otp.replace(/\s/g, '')
    if (!/^\d{6}$/.test(token)) {
      showError('請輸入電郵內的 6 位數字驗證碼')
      return
    }
    setBusy(true)
    setMsg('')
    setErr('')
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    })
    setBusy(false)
    if (error) showError(error.message)
    else {
      setOtpSent(false)
      setOtp('')
      showOk('登入成功')
      await readyStorage().catch(() => undefined)
    }
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

      {driver === 'supabase' && data.workspaceState === 'ready' && (
        <section className="panel p-6">
          <h2 className="text-lg font-bold">學校邀請碼</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            同事可用此碼加入同一個工作區，共用班別與欠交資料。
          </p>
          <p className="mt-3 font-mono text-2xl font-bold tracking-widest">
            {joinCode || '—'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || !joinCode}
              onClick={() => {
                if (!joinCode) return
                void navigator.clipboard.writeText(joinCode).then(
                  () => showOk('已複製邀請碼'),
                  () => showError('無法複製'),
                )
              }}
            >
              複製
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() =>
                void rotateJoinCode()
                  .then((code) => {
                    setJoinCode(code)
                    showOk('已重設邀請碼')
                  })
                  .catch((e) =>
                    showError(e instanceof Error ? e.message : '重設失敗'),
                  )
              }
            >
              重設邀請碼（僅管理員）
            </button>
            <Link to="/onboarding" className="btn btn-ghost">
              建立／加入學校
            </Link>
          </div>
        </section>
      )}

      {driver === 'supabase' && data.workspaceState === 'needsOnboarding' && (
        <section className="panel p-6">
          <h2 className="text-lg font-bold">尚未加入學校</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            登入後請建立新學校，或輸入同事邀請碼加入共用工作區。
          </p>
          <Link to="/onboarding" className="btn btn-primary mt-4">
            前往建立／加入
          </Link>
        </section>
      )}

      <section className="panel p-6">
        <h2 className="text-lg font-bold">學生端網址</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          學生請開啟獨立的「我的功課」網站（可加入主畫面）。認領 QR 已指向此網址。
        </p>
        <p className="mt-3 break-all font-mono text-sm">{getStudentAppUrl()}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={getStudentAppUrl()}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
          >
            開啟學生端
          </a>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              void navigator.clipboard.writeText(getStudentAppUrl()).then(
                () => showOk('已複製學生端網址'),
                () => showError('無法複製'),
              )
            }}
          >
            複製網址
          </button>
          <Link to="/reminders" className="btn btn-ghost">
            提醒設定
          </Link>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold">雲端登入（電郵驗證碼）</h2>
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
              iPhone 請用主畫面 App 完成登入：先寄驗證碼，再到電郵抄 6
              位數字回來輸入（不要點電郵裡的連結，以免開到 Chrome）。
            </p>
            <form onSubmit={onSendCode} className="mt-4 space-y-3">
              <div className="field">
                <label>電郵</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setOtpSent(false)
                  }}
                  placeholder="teacher@school.edu.hk"
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={busy}
              >
                {busy && !otpSent ? '傳送中…' : '寄送驗證碼'}
              </button>
            </form>
            {otpSent && (
              <form onSubmit={onVerifyCode} className="mt-4 space-y-3">
                <div className="field">
                  <label>6 位數驗證碼</label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="123456"
                    className="font-mono tracking-widest text-center text-xl"
                    autoComplete="one-time-code"
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary w-full"
                  disabled={busy || otp.length !== 6}
                >
                  {busy ? '驗證中…' : '確認登入'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  disabled={busy}
                  onClick={() => {
                    setOtpSent(false)
                    setOtp('')
                    setMsg('')
                    setErr('')
                  }}
                >
                  重新輸入電郵
                </button>
              </form>
            )}
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
