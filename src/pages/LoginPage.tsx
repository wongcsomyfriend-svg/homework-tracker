import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) {
      setMsg('尚未設定 Supabase。請在 .env 填入 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY。')
      return
    }
    setBusy(true)
    setMsg('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    setMsg(error ? error.message : '已寄出登入連結，請檢查電郵。')
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold">登入</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {supabaseConfigured
            ? '使用 Magic Link 登入後可同步雲端資料（多校隔離）。'
            : '目前為本機模式：資料存在瀏覽器 localStorage，無需登入即可使用。'}
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
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? '傳送中…' : '寄送 Magic Link'}
          </button>
        </form>
        {msg && <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{msg}</p>}
        <Link to="/" className="btn btn-ghost mt-4 w-full">
          返回主頁
        </Link>
      </section>
    </div>
  )
}
