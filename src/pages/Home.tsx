import { useState } from 'react'
import { Page } from '../components/Layout'
import { useAppStore } from '../store/useAppStore'
import { daysBetween, todayStr } from '../engine/rng'
import { db } from '../db/db'
import { useEffect } from 'react'
import type { CategoryId } from '../types'

export default function Home() {
  const subject = useAppStore((s) => s.subject)
  const settings = useAppStore((s) => s.settings)
  const todayLog = useAppStore((s) => s.todayLog)
  const unfinished = useAppStore((s) => s.unfinished)
  const startSession = useAppStore((s) => s.startSession)
  const navigate = useAppStore((s) => s.navigate)
  const abandon = useAppStore((s) => s.abandonSession)
  const activeQuestions = useAppStore((s) => s.activeQuestions)
  const [cat, setCat] = useState<CategoryId>(1)
  const [busy, setBusy] = useState(false)
  const [streak, setStreak] = useState(0)
  const [err, setErr] = useState<string>()

  useEffect(() => {
    void (async () => {
      if (!subject) return
      const logs = await db.dailyLogs.where('subject').equals(subject.def.id).toArray()
      setStreak(calcStreak(logs.map((l) => ({ date: l.date, answered: l.answered })), settings.dailyGoal))
    })()
  }, [subject, todayLog, settings.dailyGoal])

  if (!subject) return null
  const answered = todayLog?.answered ?? 0
  const remaining = Math.max(0, settings.dailyGoal - answered)
  const active = activeQuestions()
  const daily = unfinished.find((s) => s.mode === 'daily')
  const exam = unfinished.find((s) => s.mode === 'exam')
  const category = unfinished.find((s) => s.mode === 'category')

  const start = async (mode: 'daily' | 'exam' | 'category') => {
    setBusy(true)
    setErr(undefined)
    try {
      await startSession(mode, mode === 'category' ? { category: cat, count: 10 } : undefined)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page
      title={subject.def.name}
      left={<span style={{ width: 4 }} />}
      right={
        <>
          <button className="iconbtn" onClick={() => navigate({ name: 'progress' })} aria-label="進捗">📈</button>
          <button className="iconbtn" onClick={() => navigate({ name: 'settings' })} aria-label="設定">⚙</button>
        </>
      }
    >
      <div className="card">
        <div className="grid2">
          <div className="stat"><div className="v">{remaining}</div><div className="l">今日の残り問題</div></div>
          <div className="stat"><div className="v">{streak}<span className="small">日</span></div><div className="l">連続日数</div></div>
        </div>
        <div className="progressbar" style={{ marginTop: 10 }}>
          <div style={{ width: `${Math.min(100, (answered / settings.dailyGoal) * 100)}%` }} />
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          今日 {answered} 問回答 / 正解 {todayLog?.correct ?? 0}・出題可能 {active.length} 問
        </div>
      </div>

      {active.length === 0 && (
        <div className="card">
          <p>問題データがまだありません。<code>public/data/{subject.def.id}/questions/</code> に問題 JSON を追加してください（docs/OPUS_TASK.md 参照）。</p>
        </div>
      )}

      <div className="card">
        <h2>デイリー練習（{settings.dailyGoal}問・即時解説）</h2>
        {daily ? (
          <>
            <button className="btn primary" onClick={() => navigate({ name: 'session', id: daily.id! })}>
              続きから（{Object.keys(daily.answers).length} / {daily.items.length} 回答済）
            </button>
            <button className="btn secondary" onClick={() => abandon(daily.id!)}>このセッションを破棄</button>
          </>
        ) : (
          <button className="btn primary" disabled={busy || active.length === 0} onClick={() => start('daily')}>
            今日の {settings.dailyGoal} 問を始める
          </button>
        )}
      </div>

      <div className="card">
        <h2>模擬試験（{subject.def.exam.questionCount}問・{settings.examMinutes}分・最後に採点）</h2>
        {exam ? (
          <>
            <button className="btn primary" onClick={() => navigate({ name: 'session', id: exam.id! })}>
              続きから（{Object.keys(exam.answers).length} / {exam.items.length} 回答済）
            </button>
            <button className="btn secondary" onClick={() => abandon(exam.id!)}>この試験を破棄</button>
          </>
        ) : (
          <button className="btn secondary" disabled={busy || active.length === 0} onClick={() => start('exam')}>
            模擬試験を始める
          </button>
        )}
      </div>

      <div className="card">
        <h2>分野別集中（10問）</h2>
        {category ? (
          <>
            <button className="btn primary" onClick={() => navigate({ name: 'session', id: category.id! })}>
              続きから（分野{category.category}）
            </button>
            <button className="btn secondary" onClick={() => abandon(category.id!)}>破棄</button>
          </>
        ) : (
          <div className="row">
            <select value={cat} onChange={(e) => setCat(Number(e.target.value))} style={{ flex: 1 }}>
              {subject.def.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id}. {c.name}（{subject.questions.filter((q) => q.status === 'active' && q.category === c.id).length}問）
                </option>
              ))}
            </select>
            <button className="btn secondary" style={{ width: 'auto' }} disabled={busy} onClick={() => start('category')}>
              開始
            </button>
          </div>
        )}
      </div>
      {err && <div className="note">⚠ {err}</div>}
      <button className="btn secondary" onClick={() => navigate({ name: 'history' })}>履歴を見る</button>
    </Page>
  )
}

/** 連続日数: 今日（または昨日）から遡って、目標問題数に達した日が連続する数 */
export function calcStreak(logs: { date: string; answered: number }[], goal: number, today = todayStr()): number {
  const done = new Set(logs.filter((l) => l.answered >= goal).map((l) => l.date))
  let streak = 0
  let d = today
  if (!done.has(d)) {
    // 今日まだ達成していなければ昨日から数える
    const y = new Date()
    y.setDate(y.getDate() - 1)
    d = todayStr(y)
    if (!done.has(d)) return 0
  }
  while (done.has(d)) {
    streak++
    const [yy, mm, dd] = d.split('-').map(Number)
    d = todayStr(new Date(yy, mm - 1, dd - 1))
    if (daysBetween(d, today) > 3650) break
  }
  return streak
}
