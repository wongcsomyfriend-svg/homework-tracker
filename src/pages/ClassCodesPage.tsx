import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { useData } from '../hooks/useData'
import { getStudentAppUrl, getStudentJoinUrl } from '../lib/cloud'
import { getStudents } from '../lib/store'

export function ClassCodesPage() {
  const { classId = '' } = useParams()
  const data = useData()
  const room = data.classes.find((c) => c.id === classId)
  const students = useMemo(() => getStudents(classId), [data, classId])
  const [qrMap, setQrMap] = useState<Record<string, string>>({})
  const studentAppUrl = getStudentAppUrl()

  useEffect(() => {
    let cancelled = false
    async function build() {
      const next: Record<string, string> = {}
      for (const s of students) {
        if (!s.claimCode) continue
        next[s.id] = await QRCode.toDataURL(getStudentJoinUrl(s.claimCode), {
          margin: 1,
          width: 256,
          errorCorrectionLevel: 'M',
        })
      }
      if (!cancelled) setQrMap(next)
    }
    void build()
    return () => {
      cancelled = true
    }
  }, [students])

  if (!room) {
    return <div className="panel p-5">找不到班別。</div>
  }

  return (
    <div className="space-y-4">
      <section className="panel p-5 no-print">
        <h1 className="text-2xl font-bold">{room.name} · 學生認領碼</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          列印後給學生用「學生端」App 掃描 QR，或手動輸入 8 位認領碼。
        </p>
        <p className="mt-2 break-all text-xs text-[var(--muted)]">
          學生端網址：{studentAppUrl}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            列印
          </button>
          <Link to={`/classes/${classId}`} className="btn btn-ghost">
            回班別
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {students.map((s) => (
          <div key={s.id} className="panel break-inside-avoid p-4 text-center">
            <div className="text-lg font-bold">
              {s.studentNo} {s.name}
            </div>
            <div className="text-xs text-[var(--muted)]">Marker #{s.markerId}</div>
            {qrMap[s.id] ? (
              <img
                src={qrMap[s.id]}
                alt={`QR ${s.claimCode}`}
                className="mx-auto mt-3 h-40 w-40"
              />
            ) : (
              <div className="mx-auto mt-3 flex h-40 w-40 items-center justify-center text-sm text-[var(--muted)]">
                無認領碼
              </div>
            )}
            <div className="mt-2 font-mono text-xl font-bold tracking-widest">
              {s.claimCode || '—'}
            </div>
          </div>
        ))}
        {students.length === 0 && (
          <div className="panel p-5 text-[var(--muted)]">尚未有學生。</div>
        )}
      </section>
    </div>
  )
}
