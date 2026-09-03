import { useEffect, useState } from 'react'
import { Page } from '../components/Layout'
import { db } from '../db/db'
import { addDays, todayStr } from '../engine/rng'
import { useAppStore } from '../store/useAppStore'
import { calcStreak } from './Home'
import type { DailyLog } from '../types'

export default function Progress() {
  const subject = useAppStore((s) => s.subject)
  const settings = useAppStore((s) => s.settings)
  const groupStats = useAppStore((s) => s.groupStats)
  const questionStats = useAppStore((s) => s.questionStats)
  const [logs, setLogs] = useState<DailyLog[]>([])

  useEffect(() => {
    if (!subject) return
    void db.dailyLogs.where('subject').equals(subject.def.id).toArray().then(setLogs)
  }, [subject])
  if (!subject) return null

  const today = todayStr()
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29))
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const maxAnswered = Math.max(settings.dailyGoal, ...days.map((d) => byDate.get(d)?.answered ?? 0))
  const streak = calcStreak(logs, settings.dailyGoal)
  const totalAnswered = logs.reduce((s, l) => s + l.answered, 0)
  const totalCorrect = logs.reduce((s, l) => s + l.correct, 0)

  // 分野別正答率（全期間）
  const cat = new Map<number, { a: number; c: number }>()
  for (const l of logs) {
    for (const [k, v] of Object.entries(l.byCategory)) {
      const e = cat.get(Number(k)) ?? { a: 0, c: 0 }
      e.a += v.answered
      e.c += v.correct
      cat.set(Number(k), e)
    }
  }
  const groupsTotal = new Set(subject.questions.filter((q) => q.status === 'active').map((q) => q.groupId)).size
  const groupsSeen = groupStats.size
  const groupsStable = [...groupStats.values()].filter((g) => g.correctStreak >= 3).length
  const qSeen = questionStats.size
  const qTotal = subject.questions.filter((q) => q.status === 'active').length

  const W = 300, H = 120, pad = 4
  const bw = (W - pad * 2) / 30

  return (
    <Page title="進捗">
      <div className="card">
        <div className="grid2">
          <div className="stat"><div className="v">{streak}<span className="small">日</span></div><div className="l">連続日数</div></div>
          <div className="stat"><div className="v">{totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0}%</div><div className="l">通算正答率（{totalAnswered}問）</div></div>
        </div>
      </div>
      <div className="card">
        <h2>直近30日（棒: 回答数、線: 正答率）</h2>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <line x1={pad} x2={W - pad} y1={H - pad - ((H - pad * 2) * settings.dailyGoal) / maxAnswered} y2={H - pad - ((H - pad * 2) * settings.dailyGoal) / maxAnswered} stroke="var(--muted)" strokeDasharray="3 3" />
          {days.map((d, i) => {
            const l = byDate.get(d)
            const h = l ? ((H - pad * 2) * l.answered) / maxAnswered : 0
            return <rect key={d} x={pad + i * bw + 1} y={H - pad - h} width={bw - 2} height={h} fill="var(--accent)" opacity={0.8} />
          })}
          <polyline
            fill="none"
            stroke="var(--ok)"
            strokeWidth={2}
            points={days
              .map((d, i) => {
                const l = byDate.get(d)
                if (!l || !l.answered) return null
                return `${pad + i * bw + bw / 2},${H - pad - (H - pad * 2) * (l.correct / l.answered)}`
              })
              .filter(Boolean)
              .join(' ')}
          />
        </svg>
        <div className="row muted small" style={{ justifyContent: 'space-between' }}><span>{days[0]}</span><span>{today}</span></div>
      </div>
      <div className="card">
        <h2>分野別正答率</h2>
        {subject.def.categories.map((c) => {
          const e = cat.get(c.id)
          const pct = e && e.a ? (e.c / e.a) * 100 : 0
          return (
            <div className="bar" key={c.id}>
              <span>{c.short}</span>
              <div className="track"><div style={{ width: `${pct}%`, background: pct >= 60 ? 'var(--ok)' : 'var(--ng)' }} /></div>
              <span>{e && e.a ? `${Math.round(pct)}%` : '—'}</span>
            </div>
          )
        })}
      </div>
      <div className="card">
        <h2>学習範囲</h2>
        <p className="small">出題済みグループ: {groupsSeen} / {groupsTotal}（うち3連続正解 {groupsStable}）</p>
        <p className="small">出題済み問題: {qSeen} / {qTotal}</p>
        <p className="small muted">期限切れ（今日以前に復習予定）: {[...groupStats.values()].filter((g) => g.dueDate <= today).length} グループ</p>
      </div>
    </Page>
  )
}
