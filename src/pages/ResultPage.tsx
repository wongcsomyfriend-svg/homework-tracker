import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../hooks/useData'
import {
  exportSubmissionsCsv,
  saveScanResult,
} from '../lib/store'
import type { SubmissionStatus } from '../lib/types'

interface Draft {
  detectedIds: number[]
  statuses: Record<string, SubmissionStatus>
}

function loadDraft(assignmentId: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(`scan:${assignmentId}`)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

export function ResultPage() {
  const { assignmentId = '' } = useParams()
  const data = useData()
  const assignment = data.assignments.find((a) => a.id === assignmentId)
  const students = useMemo(
    () =>
      data.students
        .filter((s) => s.classId === assignment?.classId)
        .sort((a, b) => a.markerId - b.markerId),
    [data, assignment?.classId],
  )

  const draft = useMemo(() => loadDraft(assignmentId), [assignmentId])
  const [statuses, setStatuses] = useState<Record<string, SubmissionStatus>>(
    () => {
      if (draft?.statuses) return { ...draft.statuses }
      const init: Record<string, SubmissionStatus> = {}
      const existing = data.submissions.filter(
        (s) => s.assignmentId === assignmentId,
      )
      if (existing.length) {
        for (const s of students) {
          init[s.id] =
            existing.find((e) => e.studentId === s.id)?.status ?? 'missing'
        }
        return init
      }
      for (const s of students) init[s.id] = 'missing'
      return init
    },
  )
  const [saved, setSaved] = useState(false)

  if (!assignment) {
    return <div className="panel p-5">找不到功課項目。</div>
  }

  const missing = students.filter((s) => statuses[s.id] === 'missing')
  const submitted = students.filter((s) => statuses[s.id] === 'submitted')

  function toggle(studentId: string) {
    setStatuses((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'submitted' ? 'missing' : 'submitted',
    }))
    setSaved(false)
  }

  function onSave() {
    const detectedIds = students
      .filter((s) => statuses[s.id] === 'submitted')
      .map((s) => s.markerId)
    saveScanResult({
      assignmentId,
      detectedIds,
      statuses,
    })
    setSaved(true)
  }

  function onExport() {
    if (!assignment) return
    onSave()
    const csv = exportSubmissionsCsv(assignmentId)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${assignment.title}-欠交.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <p className="text-sm text-[var(--muted)]">掃描結果</p>
        <h1 className="text-2xl font-bold">{assignment.title}</h1>
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="rounded-xl bg-[var(--accent-soft)] px-4 py-2 font-bold text-[var(--accent)]">
            已交 {submitted.length}
          </div>
          <div className="rounded-xl bg-red-100 px-4 py-2 font-bold text-red-700">
            欠交 {missing.length}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={onSave}>
            {saved ? '已儲存' : '儲存結果'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onExport}>
            匯出 CSV
          </button>
          <Link to={`/scan/${assignmentId}`} className="btn btn-ghost">
            返回補掃
          </Link>
          <Link to={`/classes/${assignment.classId}`} className="btn btn-ghost">
            回班別
          </Link>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-4 py-3 font-bold">
          點擊可人手修正已交 / 欠交
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {students.map((s) => {
            const status = statuses[s.id] ?? 'missing'
            const ok = status === 'submitted'
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--accent-soft)]/40"
                  onClick={() => toggle(s.id)}
                >
                  <div>
                    <div className="font-semibold">
                      {s.studentNo} {s.name}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      Marker #{s.markerId}
                    </div>
                  </div>
                  <span className={`badge ${ok ? 'badge-ok' : 'badge-missing'}`}>
                    {ok ? '已交' : '欠交'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {missing.length > 0 && (
        <section className="panel p-4">
          <h2 className="font-bold text-red-700">欠交名單</h2>
          <p className="mt-2 text-sm">
            {missing.map((s) => `${s.studentNo} ${s.name}`).join('、')}
          </p>
        </section>
      )}
    </div>
  )
}
