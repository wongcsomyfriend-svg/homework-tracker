import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../hooks/useData'
import {
  addStudent,
  createAssignment,
  deleteAssignment,
  getStudents,
  reassignMarkerIds,
  removeStudent,
  updateStudent,
} from '../lib/store'
import type { Student } from '../lib/types'

type Draft = Record<string, { studentNo: string; name: string }>

export function ClassDetailPage() {
  const { classId = '' } = useParams()
  const data = useData()
  const room = data.classes.find((c) => c.id === classId)
  const students = useMemo(() => getStudents(classId), [data, classId])
  const assignments = data.assignments.filter((a) => a.classId === classId)

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [newNo, setNewNo] = useState('')
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>({})

  useEffect(() => {
    if (!editing) return
    const next: Draft = {}
    for (const s of students) {
      next[s.id] = { studentNo: s.studentNo, name: s.name }
    }
    setDraft(next)
  }, [editing, students])

  function showOk(text: string) {
    setErr('')
    setMsg(text)
  }

  function showError(text: string) {
    setMsg('')
    setErr(text)
  }

  async function handleAddStudent(e: FormEvent) {
    e.preventDefault()
    try {
      if (!newNo.trim() || !newName.trim()) {
        showError('請填寫學號與姓名')
        return
      }
      const no = newNo.trim()
      const name = newName.trim()
      await addStudent(classId, no, name)
      setNewNo('')
      setNewName('')
      showOk(`已新增：${no} ${name}`)
    } catch (e) {
      showError(e instanceof Error ? e.message : '新增失敗')
    }
  }

  function startEdit() {
    const next: Draft = {}
    for (const s of students) {
      next[s.id] = { studentNo: s.studentNo, name: s.name }
    }
    setDraft(next)
    setEditing(true)
    setMsg('')
    setErr('')
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    setErr('')
  }

  async function saveEdit() {
    try {
      const seen = new Map<string, string>()
      for (const s of students) {
        const row = draft[s.id]
        if (!row) continue
        const studentNo = row.studentNo.trim()
        const name = row.name.trim()
        if (!studentNo || !name) {
          showError(`Marker #${s.markerId} 的學號或姓名不能留空`)
          return
        }
        const prev = seen.get(studentNo)
        if (prev) {
          showError(`學號「${studentNo}」重複（${prev} 與 ${name}），請修改`)
          return
        }
        seen.set(studentNo, name)
      }
      for (const s of students) {
        const row = draft[s.id]
        if (!row) continue
        const studentNo = row.studentNo.trim()
        const name = row.name.trim()
        if (studentNo !== s.studentNo || name !== s.name) {
          await updateStudent(s.id, { studentNo, name })
        }
      }
      setEditing(false)
      setDraft({})
      showOk('已儲存名單修改')
    } catch (e) {
      showError(e instanceof Error ? e.message : '儲存失敗')
    }
  }

  async function handleDeleteAssignment(assignmentId: string, titleText: string) {
    if (!confirm(`刪除功課「${titleText}」？相關掃描紀錄也會一併刪除。`)) return
    try {
      await deleteAssignment(assignmentId)
      showOk(`已刪除功課「${titleText}」`)
    } catch (e) {
      showError(e instanceof Error ? e.message : '刪除功課失敗')
    }
  }

  async function handleDelete(s: Student) {
    if (!confirm(`刪除 ${s.studentNo} ${s.name}？`)) return
    try {
      await removeStudent(s.id)
      showOk('已刪除學生')
    } catch (e) {
      showError(e instanceof Error ? e.message : '刪除失敗')
    }
  }

  async function handleCreateAssignment(e: FormEvent) {
    e.preventDefault()
    try {
      if (!students.length) {
        showError('請先新增至少一位學生')
        return
      }
      if (!title.trim()) {
        showError('請填寫功課標題')
        return
      }
      const a = await createAssignment(classId, title, subject, dueDate)
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
          填寫學號與姓名後新增；會自動分配 Marker ID（每班最多 50 人）。
        </p>
        <form
          onSubmit={handleAddStudent}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div className="field">
            <label htmlFor="student-no">學號</label>
            <input
              id="student-no"
              value={newNo}
              onChange={(e) => setNewNo(e.target.value)}
              placeholder="例如 1"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="student-name">姓名</label>
            <input
              id="student-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如 陳大文"
              autoComplete="off"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full">
              新增學生
            </button>
          </div>
        </form>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3">
          <div className="font-bold">學生名單{editing ? '（編輯中）' : ''}</div>
          <div className="flex flex-wrap gap-2">
            {!editing ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!students.length}
                  onClick={startEdit}
                >
                  編輯名單
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!students.length}
                  onClick={() => {
                    void reassignMarkerIds(classId)
                      .then(() => showOk('已按學號重新分配 Marker ID'))
                      .catch((e) =>
                        showError(
                          e instanceof Error ? e.message : '重新分配失敗',
                        ),
                      )
                  }}
                >
                  重排 Marker ID
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-primary" onClick={saveEdit}>
                  儲存
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                  取消
                </button>
              </>
            )}
          </div>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[var(--accent-soft)]">
              <tr>
                <th className="px-3 py-2">Marker</th>
                <th className="px-3 py-2">學號</th>
                <th className="px-3 py-2">姓名</th>
                {editing && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2 font-mono">{s.markerId}</td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <input
                        className="w-full min-w-16 rounded-lg border border-[var(--line)] px-2 py-1"
                        value={draft[s.id]?.studentNo ?? s.studentNo}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [s.id]: {
                              studentNo: e.target.value,
                              name: prev[s.id]?.name ?? s.name,
                            },
                          }))
                        }
                      />
                    ) : (
                      s.studentNo
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <input
                        className="w-full min-w-24 rounded-lg border border-[var(--line)] px-2 py-1"
                        value={draft[s.id]?.name ?? s.name}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [s.id]: {
                              studentNo: prev[s.id]?.studentNo ?? s.studentNo,
                              name: e.target.value,
                            },
                          }))
                        }
                      />
                    ) : (
                      s.name
                    )}
                  </td>
                  {editing && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => handleDelete(s)}
                      >
                        刪除
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td
                    colSpan={editing ? 4 : 3}
                    className="px-4 py-6 text-[var(--muted)]"
                  >
                    尚未有學生。請在上方用學號、姓名新增。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold">建立功課並掃描</h2>
        {!students.length && (
          <p className="mt-2 text-sm text-amber-700">
            請先新增學生，之後才能建立功課。
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
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/scan/${a.id}`}
                  className={`btn ${students.length ? 'btn-primary' : 'btn-ghost'}`}
                >
                  開始掃描
                </Link>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleDeleteAssignment(a.id, a.title)}
                >
                  刪除
                </button>
              </div>
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
