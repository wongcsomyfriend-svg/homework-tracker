import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { isCloudMode } from '../../lib/cloud'
import { claimStudent } from '../../lib/studentApi'

export function JoinPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const cloud = isCloudMode()

  useEffect(() => {
    const fromUrl = params.get('code')
    if (fromUrl) setCode(fromUrl.toUpperCase())
  }, [params])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!cloud) {
      setErr('學生端需要雲端模式（VITE_STORAGE_DRIVER=supabase）')
      return
    }
    setBusy(true)
    setErr('')
    setOk('')
    try {
      const result = await claimStudent(code)
      setOk(`已連接：${result.className} ${result.studentNo} ${result.name}`)
      navigate('/', { replace: true })
    } catch (error) {
      setErr(error instanceof Error ? error.message : '認領失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold">學生端 · 連接身份</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          掃描老師提供的 QR，或輸入 8 位認領碼，即可綁定自己的身份並查看欠交功課。
        </p>
        {!cloud && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            目前為本機模式，學生端無法使用。請切換雲端後再試。
          </p>
        )}
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div className="field">
            <label>認領碼</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="例如 A3K9M2P7"
              maxLength={12}
              required
              className="font-mono tracking-widest uppercase"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={busy || !cloud}
          >
            {busy ? '連接中…' : '連接身份'}
          </button>
        </form>
        {ok && (
          <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{ok}</p>
        )}
        {err && (
          <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
            {err}
          </p>
        )}
        <Link to="/" className="btn btn-ghost mt-4 w-full">
          已連接？查看我的功課
        </Link>
      </section>
    </div>
  )
}
