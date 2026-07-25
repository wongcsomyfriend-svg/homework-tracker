import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../hooks/useData'
import {
  addStudent,
  createAssignment,
  getStudents,
  importStudents,
  parseStudentCsv,
  reassignMarkerIds,
  removeStudent,
  updateStudent,
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
  const [err, setErr] = useState('')
  const [newNo, setNewNo] = useState('')
  const [newName, setNewName] = useState('')

  function showOk(text: string) {
    setErr('')
    setMsg(text)
  }

  function showError(text: string) {
    setMsg('')
    setErr(text)
  }

  function handleImport() {
    try {
      if (!classId) {
        showError('找不到班別 ID，請返回班別列表重新開啟')
        return
      }
      const rows = parseStudentCsv(paste)
      if (!rows.length) {
        showError('找不到有效名單。格式：每行「學號,姓名」，例如：1,陳大文')
        return
      }
      const created = importStudents(classId, rows)
      showOk(`已匯入 ${created.length} 位學生（最多 50 人，可在下方表格編輯）`)
    } catch (e) {
      showError(e instanceof Error ? e.message : '匯入失敗')
    }
  }

  function handleAddStudent(e: FormEvent) {
    e.preventDefault()
    try {
      if (!newNo.trim() || !newName.trim()) {
        showError('請填寫學號與姓名')
        return
      }
      addStudent(classId, newNo, newName)
      setNewNo('')
      setNewName('')
      showOk('已新增學生')
    } catch (e) {
      showError(e instanceof Error ? e.message : '新增失敗')
    }
  }

  function handleCreateAssignment(e: FormEvent) {
    e.preventDefault()
    try {
      if (!students.length) {
        showError('請先匯入或新增至少一位學生')
        return
      }
      if (!title.trim()) {
        showError('請填寫功課標題')
        return
      }
      const a = createAssignment(classId, title, subject, dueDate)
      setTitle('')
      showOk(`已建立功課「${a.title}」`)
    } catch (e) {
      showError(e instanceof Error ? e.message : '建立功課失敗')
    }
  }

  if (!room) {
    return (
      <div className="panel space-y-3 p-5">
        <p>找不到班別。</p>
        <Link to="/classes" className="btn btn-primary">
          返回班別列表
        </Link>
      </div>
    )
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
        {msg && (
          <p className="mt-3 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--accent)]">
            {msg}
          </p>
        )}
        {err && (
          <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
            {err}
          </p>
        )}
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold">匯入學生名單</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          每行：學號,姓名（會依序分配 Marker ID 0、1、2…）。匯入後可在下方表格直接改。
        </p>
        <div className="mt-3 space-y-3">
          <textarea
            className="min-h-36 w-full rounded-xl border border-[var(--line)] p-3 font-mono text-sm"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={'1,陳大文\n2,李小美\n3,王小明'}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleImport}
          >
            匯入 / 覆寫名單
          </button>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3">
          <div className="font-bold">學生名單（可編輯）</div>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!students.length}
            onClick={() => {
              try {
                reassignMarkerIds(classId)
                showOk('已按學號重新分配 Marker ID')
              } catch (e) {
                showError(e instanceof Error ? e.message : '重新分配失敗')
              }
            }}
          >
            重排 Marker ID
          </button>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[var(--accent-soft)]">
              <tr>
                <th className="px-3 py-2">Marker</th>
                <th className="px-3 py-2">學號</th>
                <th className="px-3 py-2">姓名</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2 font-mono">{s.markerId}</td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full min-w-16 rounded-lg border border-[var(--line)] px-2 py-1"
                      defaultValue={s.studentNo}
                      onBlur={(e) => {
                        if (e.target.value.trim() === s.studentNo) return
                        try {
                          updateStudent(s.id, { studentNo: e.target.value })
                          showOk('已更新學號')
                        } catch (error) {
                          showError(
                            error instanceof Error ? error.message : '更新失敗',
                          )
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full min-w-24 rounded-lg border border-[var(--line)] px-2 py-1"
                      defaultValue={s.name}
                      onBlur={(e) => {
                        if (e.target.value.trim() === s.name) return
                        try {
                          updateStudent(s.id, { name: e.target.value })
                          showOk('已更新姓名')
                        } catch (error) {
                          showError(
                            error instanceof Error ? error.message : '更新失敗',
                          )
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        if (!confirm(`刪除 ${s.studentNo} ${s.name}？`)) return
                        try {
                          removeStudent(s.id)
                          showOk('已刪除學生')
                        } catch (error) {
                          showError(
                            error instanceof Error ? error.message : '刪除失敗',
                          )
                        }
                      }}
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-[var(--muted)]">
                    尚未有學生。請先匯入，或在下方逐個新增。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <form
          onSubmit={handleAddStudent}
          className="grid gap-2 border-t border-[var(--line)] p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input
            className="rounded-xl border border-[var(--line)] px-3 py-2"
            placeholder="學號"
            value={newNo}
            onChange={(e) => setNewNo(e.target.value)}
          />
          <input
            className="rounded-xl border border-[var(--line)] px-3 py-2"
            placeholder="姓名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary">
            新增一位
          </button>
        </form>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold">建立功課並掃描</h2>
        {!students.length && (
          <p className="mt-2 text-sm text-amber-700">
            請先匯入或新增學生，之後才能建立功課。
          </p>
        )}
        <form
          onSubmit={handleCreateAssignment}
          className="mt-3 grid gap-3 sm:grid-cols-2"
        >
          <div className="field">
            <label>功課標題</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如 單元一工作紙"
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
