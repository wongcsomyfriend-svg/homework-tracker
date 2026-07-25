import { Link } from 'react-router-dom'
import { useData } from '../hooks/useData'

export function HomePage() {
  const data = useData()
  const classCount = data.classes.length
  const studentCount = data.students.length
  const assignmentCount = data.assignments.length

  return (
    <div className="space-y-5">
      <section className="panel overflow-hidden p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Homework Tracker
        </p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">
          一次過掃描已交功課
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          把簿分成幾疊並排放好、只露右上角 ArUco 標籤，影一張最高解析度相，即可列出欠交名單。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/classes" className="btn btn-primary">
            管理班別
          </Link>
          <Link to="/spike" className="btn btn-secondary">
            Phase 0 辨識測試
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: '班別', value: classCount },
          { label: '學生', value: studentCount },
          { label: '功課紀錄', value: assignmentCount },
        ].map((item) => (
          <div key={item.label} className="panel p-4">
            <div className="text-sm text-[var(--muted)]">{item.label}</div>
            <div className="mt-1 text-3xl font-bold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold">建議工作流程</h2>
        <ol className="mt-3 space-y-2 text-[var(--muted)]">
          <li>1. 新增班別並匯入學生名單（自動分配 Marker ID 0–49）</li>
          <li>2. 列印標籤貼紙，貼在每本功課簿右上角</li>
          <li>3. 建立功課項目，用「一次過掃描」影相</li>
          <li>4. 人手修正後儲存，可匯出 CSV 或到統計頁查看慣常欠交同學</li>
        </ol>
      </section>
    </div>
  )
}
