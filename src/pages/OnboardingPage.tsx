import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createSchool, getStorageDriver, joinSchool } from '../lib/store'
import { useData } from '../hooks/useData'

export function OnboardingPage() {
  const data = useData()
  const navigate = useNavigate()
  const cloud = getStorageDriver() === 'supabase'
  const [schoolName, setSchoolName] = useState('我的學校')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!cloud) {
    return (
      <div className="panel p-6">
        <h1 className="text-2xl font-bold">學校工作區</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          共用工作區需要雲端模式。本機模式可直接使用班別功能。
        </p>
        <Link to="/classes" className="btn btn-primary mt-4">
          前往班別
        </Link>
      </div>
    )
  }

  if (data.workspaceState === 'ready') {
    return (
      <div className="panel p-6">
        <h1 className="text-2xl font-bold">已加入工作區</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{data.school.name}</p>
        <Link to="/classes" className="btn btn-primary mt-4">
          前往班別
        </Link>
      </div>
    )
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await createSchool(schoolName)
      navigate('/classes', { replace: true })
    } catch (error) {
      setErr(error instanceof Error ? error.message : '建立失敗')
    } finally {
      setBusy(false)
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await joinSchool(joinCode)
      navigate('/classes', { replace: true })
    } catch (error) {
      setErr(error instanceof Error ? error.message : '加入失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold">加入學校工作區</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          同校老師共用同一個資料庫。可新建學校（你會成為管理員），或輸入同事的邀請碼加入。
        </p>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold">建立新學校</h2>
        <form onSubmit={onCreate} className="mt-3 space-y-3">
          <div className="field">
            <label>學校名稱</label>
            <input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            建立並成為管理員
          </button>
        </form>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold">用邀請碼加入</h2>
        <form onSubmit={onJoin} className="mt-3 space-y-3">
          <div className="field">
            <label>邀請碼</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="8 位代碼"
              className="font-mono tracking-widest uppercase"
              required
            />
          </div>
          <button type="submit" className="btn btn-secondary w-full" disabled={busy}>
            加入現有學校
          </button>
        </form>
      </section>

      {err && (
        <p className="rounded-xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
          {err}
        </p>
      )}
    </div>
  )
}
