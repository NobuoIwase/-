import type { ReactNode } from 'react'
import { useAppStore } from '../store/useAppStore'

export function TopBar({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <div className="topbar">
      {left ?? (
        <button className="iconbtn" onClick={() => navigate({ name: 'home' })} aria-label="ホーム">
          ⌂
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  )
}

export function Page({ title, children, left, right }: { title: string; children: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="app">
      <TopBar title={title} left={left} right={right} />
      <main>{children}</main>
    </div>
  )
}
