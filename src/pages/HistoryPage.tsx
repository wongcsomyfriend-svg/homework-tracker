import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../hooks/useData'
import { deleteAssignment, getStudentMissingCounts } from '../lib/store'

export function HistoryPage() {
  const data = useData()
  const [classId, setClassId] = useState(data.classes[0]?.id ?? '')
  const [msg, setMsg] = useState('')
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)

  const assignments = useMemo(
    () => data.assignments.filter((a) => !classId || a.classId === classId),
    [data, classId],
  )

  const students = useMemo(
    () =>
      data.students
        .filter((s) => s.classId === classId)
        .sort((a, b) => a.markerId - b.markerId),
    [data, classId],
  )

  const missingCounts = useMemo(
    () => (classId ? getStudentMissingCounts(classId) : new Map()),
    [data, classId],
  )

  const missingByStudent = useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; subject: string; dueDate: string }[]
    >()
    if (!classId) return map

    const classAssignments = data.assignments.filter((a) => a.classId === classId)
    for (const student of students) {
      const missing = classAssignments
        .filter((a) =>
          data.submissions.some(
            (s) =>
              s.assignmentId === a.id &&
              s.studentId === student.id &&
              s.status === 'missing',
          ),
        )
        .map((a) => ({
          id: a.id,
          title: a.title,
          subject: a.subject || '一般',
          dueDate: a.dueDate,
        }))
        .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
      map.set(student.id, missing)
    }
    return map
  }, [data, classId, students])

  const ranked = useMemo(() => {
    return [...students]
      .map((s) => ({
        student: s,
        count: missingCounts.get(s.id) ?? 0,
        missingAssignments: missingByStudent.get(s.id) ?? [],
      }))
      .sort((a, b) => b.count - a.count)
  }, [students, missingCounts, missingByStudent])

  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <h1 className="text-2xl font-bold">歷史與統計</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          查看每位學生累計欠交次數，以及各次功課的提交紀錄。按「欠交 x 次」可展開明細。
        </p>
        <div className="field mt-4 max-w-sm">
          <label>班別</label>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value)
              setExpandedStudentId(null)
            }}
          >
            {data.classes.length === 0 && <option value="">未有班別</option>}
            {data.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {msg && (
          <p className="mt-3 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--accent)]">
            {msg}
          </p>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-4 py-3 font-bold">
          學生欠交排行
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {ranked.map(({ student, count, missingAssignments }) => {
            const open = expandedStudentId === student.id
            return (
              <li key={student.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {student.studentNo} {student.name}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      Marker #{student.markerId}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`badge ${count ? 'badge-missing' : 'badge-ok'} ${
                      count ? 'cursor-pointer underline-offset-2 hover:underline' : 'cursor-default'
                    }`}
                    disabled={!count}
                    aria-expanded={open}
                    onClick={() =>
                      setExpandedStudentId((prev) =>
                        prev === student.id ? null : student.id,
                      )
                    }
                  >
                    欠交 {count} 次{count > 0 ? (open ? ' ▲' : ' ▼') : ''}
                  </button>
                </div>

                {open && (
                  <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
                    <div className="mb-2 text-sm font-semibold text-red-700">
                      {student.studentNo} {student.name} 欠交的功課
                    </div>
                    {missingAssignments.length === 0 ? (
                      <p className="text-sm text-[var(--muted)]">沒有欠交紀錄</p>
                    ) : (
                      <ul className="space-y-2">
                        {missingAssignments.map((a) => (
                          <li
                            key={a.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                          >
                            <div>
                              <div className="font-medium">{a.title}</div>
                              <div className="text-xs text-[var(--muted)]">
                                {a.subject} · 截止 {a.dueDate}
                              </div>
                            </div>
                            <Link
                              to={`/result/${a.id}`}
                              className="btn btn-secondary"
                            >
                              查看
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}
          {ranked.length === 0 && (
            <li className="px-4 py-6 text-[var(--muted)]">未有學生資料</li>
          )}
        </ul>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-4 py-3 font-bold">
          功課紀錄
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {assignments.map((a) => {
            const subs = data.submissions.filter((s) => s.assignmentId === a.id)
            const missing = subs.filter((s) => s.status === 'missing').length
            const submitted = subs.filter((s) => s.status === 'submitted').length
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-sm text-[var(--muted)]">
                    {a.subject || '一般'} · {a.dueDate}
                    {subs.length > 0 &&
                      ` · 已交 ${submitted} / 欠交 ${missing}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/result/${a.id}`} className="btn btn-secondary">
                    查看
                  </Link>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      if (
                        !confirm(
                          `刪除功課「${a.title}」？相關掃描紀錄也會一併刪除。`,
                        )
                      ) {
                        return
                      }
                      try {
                        deleteAssignment(a.id)
                        setMsg(`已刪除功課「${a.title}」`)
                        setExpandedStudentId(null)
                      } catch (e) {
                        setMsg(e instanceof Error ? e.message : '刪除失敗')
                      }
                    }}
                  >
                    刪除
                  </button>
                </div>
              </li>
            )
          })}
          {assignments.length === 0 && (
            <li className="px-4 py-6 text-[var(--muted)]">未有功課紀錄</li>
          )}
        </ul>
      </section>
    </div>
  )
}
