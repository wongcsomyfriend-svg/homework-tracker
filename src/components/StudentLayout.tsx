import { NavLink, Outlet } from 'react-router-dom'
import { isCloudMode } from '../lib/cloud'

const links = [
  { to: '/', label: '我的功課', end: true },
  { to: '/join', label: '連接' },
  { to: '/reminders', label: '提醒' },
]

export function StudentLayout() {
  const cloud = isCloudMode()

  return (
    <div className="app-shell">
      <header className="no-print sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(244,247,245,0.92)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-lg font-bold tracking-tight text-[var(--accent)]">
              我的功課
            </div>
            <div className="text-xs text-[var(--muted)]">
              學生端 · {cloud ? '雲端模式' : '需雲端模式'}
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
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <Outlet />
      </main>
    </div>
  )
}
