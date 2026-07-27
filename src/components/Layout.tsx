import { NavLink, Outlet } from 'react-router-dom'
import { useData } from '../hooks/useData'

const links = [
  { to: '/', label: '主頁', end: true },
  { to: '/classes', label: '班別' },
  { to: '/history', label: '統計' },
  { to: '/spike', label: 'Phase 0' },
  { to: '/login', label: '設定', end: false },
]

export function Layout() {
  const { storageMode, storageError, storageReady } = useData()

  return (
    <div className="app-shell">
      <header className="no-print sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(244,247,245,0.92)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-lg font-bold tracking-tight text-[var(--accent)]">
              功課掃描
            </div>
            <div className="text-xs text-[var(--muted)]">
              ArUco 欠交追蹤 · {storageReady ? storageMode : '載入中…'}
            </div>
          </div>
          <nav className="flex flex-wrap gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm font-semibold ${
                    isActive
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--muted)] hover:bg-[var(--accent-soft)]'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        {storageError && (
          <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-700">
            {storageError}
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <Outlet />
      </main>
    </div>
  )
}
