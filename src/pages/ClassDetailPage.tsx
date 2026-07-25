import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../hooks/useData'
import {
  createAssignment,
  getStudents,
  importStudents,
  parseStudentCsv,
} from '../lib/store'

export function ClassDetailPage() {
  const { classId = '' } = useParams()
  const data = useData()
  const room = data.classes.find((c) => c.id === classId)
  const students = useMemo(() => getStudents(classId), [data, classId])
  const assignments = data.assignments.filter((a) => a.classId === classId)

  const [paste, setPaste] = useState('1,陳大文\n2,李小美\n3,王小明')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [msg, setMsg] = useState('')

  if (!room) {
    return <div className="panel p-5">找不到班別。</div>
  }

  function onImport(e: FormEvent) {
    e.preventDefault()
    const rows = parseStudentCsv(paste)
    if (!rows.length) {
      setMsg('找不到有效名單（格式：學號,姓名）')
      return
    }
    const created = importStudents(classId, rows)
    setMsg(`已匯入 ${created.length} 位學生（最多 50 人）`)
  }

  function onCreateAssignment(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const a = createAssignment(classId, title, subject, dueDate)
    setTitle('')
    setMsg(`已建立功課「${a.title}」`)
  }

  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">{room.schoolYear}</p>
            <h1 className="text-2xl font-bold">{room.name}</h1>
            <p className="mt-1 text-[var(--muted)]">{students.length} 位學生</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/classes/${classId}/labels`} className="btn btn-secondary">
              列印標籤
            </Link>
            <Link to="/classes" className="btn btn-ghost">
              返回
            </Link>
          </div>
        </div>
        {msg && <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{msg}</p>}
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold">匯入學生名單</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          每行：學號,姓名（會依序分配 Marker ID 0、1、2…）
        </p>
        <form onSubmit={onImport} className="mt-3 space-y-3">
          <textarea
            className="min-h-36 w-full rounded-xl border border-[var(--line)] p-3 font-mono text-sm"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            匯入 / 覆寫名單
          </button>
        </form>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-3 font-bold">
          學生名單
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[var(--accent-soft)]">
              <tr>
                <th className="px-4 py-2">Marker</th>
                <th className="px-4 py-2">學號</th>
                <th className="px-4 py-2">姓名</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-2 font-mono">{s.markerId}</td>
                  <td className="px-4 py-2">{s.studentNo}</td>
                  <td className="px-4 py-2">{s.name}</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-[var(--muted)]">
                    尚未匯入學生
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold">建立功課並掃描</h2>
        <form
          onSubmit={onCreateAssignment}
          className="mt-3 grid gap-3 sm:grid-cols-2"
        >
          <div className="field">
            <label>功課標題</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如 單元一工作紙"
              required
            />
          </div>
          <div className="field">
            <label>科目</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="例如 中文"
            />
          </div>
          <div className="field">
            <label>截止日期</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={!students.length}
            >
              建立功課
            </button>
          </div>
        </form>

        <div className="mt-4 space-y-2">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] p-3"
            >
              <div>
                <div className="font-bold">{a.title}</div>
                <div className="text-sm text-[var(--muted)]">
                  {a.subject || '一般'} · 截止 {a.dueDate}
                </div>
              </div>
              <Link
                to={`/scan/${a.id}`}
                className={`btn ${students.length ? 'btn-primary' : 'btn-ghost'}`}
              >
                開始掃描
              </Link>
            </div>
          ))}
          {assignments.length === 0 && (
            <p className="text-sm text-[var(--muted)]">尚未有功課項目。</p>
          )}
        </div>
      </section>
    </div>
  )
}
