import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../hooks/useData'
import { createClass, deleteClass, updateSchoolName } from '../lib/store'

export function ClassesPage() {
  const data = useData()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [schoolName, setSchoolName] = useState(data.school.name)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data.school.name) setSchoolName(data.school.name)
  }, [data.school.name])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('請輸入班別名稱')
      return
    }
    setBusy(true)
    try {
      const room = await createClass(name, year)
      setName('')
      setError('')
      navigate(`/classes/${room.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立班別失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {data.storageError && (
        <p className="rounded-xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
          {data.storageError}
        </p>
      )}
      <section className="panel p-5">
        <h1 className="text-2xl font-bold">班別管理</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{data.storageMode}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-xl border border-[var(--line)] px-3 py-2"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="學校名稱"
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => {
              void updateSchoolName(schoolName).catch((err) =>
                setError(err instanceof Error ? err.message : '儲存失敗'),
              )
            }}
          >
            儲存學校名
          </button>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold">新增班別</h2>
        <form onSubmit={onCreate} className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="field sm:col-span-1">
            <label>班別名稱</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如 3A"
              required
            />
          </div>
          <div className="field">
            <label>學年</label>
            <input value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={busy || !data.storageReady}
            >
              {busy ? '處理中…' : '新增並開啟'}
            </button>
          </div>
        </form>
        {error && (
          <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
      </section>

      <section className="space-y-3">
        {data.classes.length === 0 && (
          <div className="panel p-5 text-[var(--muted)]">尚未建立班別。</div>
        )}
        {data.classes.map((room) => {
          const count = data.students.filter((s) => s.classId === room.id).length
          return (
            <div
              key={room.id}
              className="panel flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <div className="text-lg font-bold">{room.name}</div>
                <div className="text-sm text-[var(--muted)]">
                  {room.schoolYear} · {count} 位學生
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/classes/${room.id}`} className="btn btn-primary">
                  開啟
                </Link>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    if (!confirm(`刪除班別 ${room.name}？`)) return
                    void deleteClass(room.id).catch((err) =>
                      setError(err instanceof Error ? err.message : '刪除失敗'),
                    )
                  }}
                >
                  刪除
                </button>
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
