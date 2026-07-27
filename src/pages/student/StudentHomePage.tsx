import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isCloudMode } from '../../lib/cloud'
import {
  getMyAssignments,
  listMyIdentities,
  unlinkSelf,
  type StudentAssignmentRow,
  type StudentIdentity,
} from '../../lib/studentApi'

export function StudentHomePage() {
  const cloud = isCloudMode()
  const [identities, setIdentities] = useState<StudentIdentity[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [rows, setRows] = useState<StudentAssignmentRow[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(true)

  const selected = useMemo(
    () => identities.find((i) => i.studentId === selectedId) ?? null,
    [identities, selectedId],
  )

  const missing = rows.filter((r) => r.status === 'missing' || r.status === 'late')
  const done = rows.filter((r) => r.status === 'submitted' || r.status === 'excused')

  async function refresh() {
    if (!cloud) {
      setBusy(false)
      return
    }
    setBusy(true)
    setErr('')
    try {
      const list = await listMyIdentities()
      setIdentities(list)
      const nextId =
        list.find((i) => i.studentId === selectedId)?.studentId ??
        list[0]?.studentId ??
        ''
      setSelectedId(nextId)
      if (nextId) {
        setRows(await getMyAssignments(nextId))
      } else {
        setRows([])
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : '載入失敗')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedId || !cloud) return
    void getMyAssignments(selectedId)
      .then(setRows)
      .catch((error) =>
        setErr(error instanceof Error ? error.message : '載入功課失敗'),
      )
  }, [selectedId, cloud])

  async function onUnlink() {
    if (!selected) return
    if (!confirm(`解除綁定「${selected.className} ${selected.studentNo} ${selected.name}」？`)) {
      return
    }
    try {
      await unlinkSelf(selected.studentId)
      await refresh()
    } catch (error) {
      setErr(error instanceof Error ? error.message : '解除失敗')
    }
  }

  if (!cloud) {
    return (
      <div className="panel p-6">
        <h1 className="text-2xl font-bold">我的功課</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          學生端需要雲端模式。請老師先完成 Supabase 設定。
        </p>
        <Link to="/join" className="btn btn-primary mt-4">
          前往連接
        </Link>
      </div>
    )
  }

  if (!busy && identities.length === 0) {
    return (
      <div className="panel p-6">
        <h1 className="text-2xl font-bold">我的功課</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          尚未連接任何身份。請掃描老師的 QR 或輸入認領碼。
        </p>
        <Link to="/join" className="btn btn-primary mt-4">
          連接身份
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h1 className="text-2xl font-bold">我的功課</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          老師掃描後，欠交狀態會自動更新到這裡。
        </p>
        {identities.length > 1 && (
          <div className="field mt-4 max-w-sm">
            <label>身份</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {identities.map((i) => (
                <option key={i.studentId} value={i.studentId}>
                  {i.className} · {i.studentNo} {i.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {selected && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-lg font-bold">
                {selected.className} · {selected.studentNo} {selected.name}
              </div>
              <div className="text-xs text-[var(--muted)]">
                Marker #{selected.markerId}
              </div>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => void onUnlink()}>
              解除綁定
            </button>
          </div>
        )}
        {err && (
          <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
            {err}
          </p>
        )}
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold text-red-700">
          欠交 {missing.length}
        </h2>
        {busy ? (
          <p className="mt-2 text-sm text-[var(--muted)]">載入中…</p>
        ) : missing.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">沒有欠交功課，很棒！</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {missing.map((r) => (
              <li key={r.assignmentId} className="py-3">
                <div className="font-semibold">{r.title}</div>
                <div className="text-sm text-[var(--muted)]">
                  {r.subject} · 截止 {r.dueDate || '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold">已交 / 其他 {done.length}</h2>
        <ul className="mt-3 divide-y divide-[var(--line)]">
          {done.map((r) => (
            <li key={r.assignmentId} className="flex items-center justify-between py-3">
              <div>
                <div className="font-semibold">{r.title}</div>
                <div className="text-sm text-[var(--muted)]">
                  {r.subject} · 截止 {r.dueDate || '—'}
                </div>
              </div>
              <span className="badge badge-ok">
                {r.status === 'excused' ? '豁免' : '已交'}
              </span>
            </li>
          ))}
          {!busy && done.length === 0 && (
            <li className="py-3 text-sm text-[var(--muted)]">尚無紀錄</li>
          )}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link to="/join" className="btn btn-secondary">
          連接另一個身份
        </Link>
        <Link to="/reminders" className="btn btn-ghost">
          提醒設定
        </Link>
      </div>
    </div>
  )
}
