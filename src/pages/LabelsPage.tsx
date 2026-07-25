import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../hooks/useData'
import { generateMarkerSvg } from '../lib/dict4x4_50'
import { getStudents } from '../lib/store'

export function LabelsPage() {
  const { classId = '' } = useParams()
  const data = useData()
  const room = data.classes.find((c) => c.id === classId)
  const students = useMemo(() => getStudents(classId), [data, classId])
  const [sizeCm, setSizeCm] = useState(1.2)

  if (!room) return <div className="panel p-5">找不到班別。</div>

  return (
    <div className="space-y-4">
      <section className="panel no-print p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{room.name} 標籤貼紙</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              建議印在啞面貼紙。實際輸出尺寸以 cm 為準，列印時關閉「適合頁面」。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-semibold text-[var(--muted)]">
              尺寸
              <select
                className="ml-2 rounded-lg border border-[var(--line)] px-2 py-1"
                value={sizeCm}
                onChange={(e) => setSizeCm(Number(e.target.value))}
              >
                <option value={1}>1.0 cm</option>
                <option value={1.2}>1.2 cm</option>
                <option value={1.5}>1.5 cm</option>
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              列印
            </button>
            <Link to={`/classes/${classId}`} className="btn btn-ghost">
              返回
            </Link>
          </div>
        </div>
      </section>

      {students.length === 0 ? (
        <div className="panel p-5 text-[var(--muted)]">請先匯入學生名單。</div>
      ) : (
        <section className="panel p-4">
          <div className="mb-3 text-sm font-semibold text-[var(--muted)]">
            {room.name} · {sizeCm} cm · DICT_4X4_50
          </div>
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8">
            {students.map((s) => (
              <div key={s.id} className="break-inside-avoid text-center">
                <div
                  className="mx-auto"
                  style={{ width: `${sizeCm}cm`, height: `${sizeCm}cm` }}
                  dangerouslySetInnerHTML={{
                    __html: generateMarkerSvg(s.markerId),
                  }}
                />
                <div className="mt-1 text-[10px] font-bold leading-tight">
                  {room.name} #{s.markerId}
                  <br />
                  {s.studentNo} {s.name}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
