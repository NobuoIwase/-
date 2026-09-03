import { useEffect, useState } from 'react'
import { Page } from '../components/Layout'
import { ExplanationView, QuestionView } from '../components/QuestionCard'
import { db } from '../db/db'
import { correctPos, isCorrect, useAppStore } from '../store/useAppStore'
import { CHOICE_LABELS, type SessionRecord } from '../types'

export default function Result({ id }: { id: number }) {
  const subject = useAppStore((s) => s.subject)
  const navigate = useAppStore((s) => s.navigate)
  const [session, setSession] = useState<SessionRecord>()
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    void db.sessions.get(id).then(setSession)
  }, [id])

  if (!session || !subject) return <Page title="結果"><p className="muted">…</p></Page>
  const items = session.items.map((it, i) => {
    const q = subject.byId.get(it.questionId)
    const ok = q ? isCorrect(q, it, session.answers[i]) : false
    return { it, q, ok, i }
  })
  const correct = items.filter((x) => x.ok).length
  const total = items.length
  const isExam = session.mode === 'exam'
  const pass = isExam ? correct >= subject.def.exam.passScore : undefined
  const byCat = new Map<number, { a: number; c: number }>()
  for (const x of items) {
    if (!x.q) continue
    const e = byCat.get(x.q.category) ?? { a: 0, c: 0 }
    e.a++
    if (x.ok) e.c++
    byCat.set(x.q.category, e)
  }
  const elapsed = session.finishedAt ? Math.round((session.finishedAt - session.startedAt) / 60000) : 0

  return (
    <Page title={isExam ? '模擬試験の結果' : '結果'}>
      <div className="card">
        <div className="grid2">
          <div className="stat"><div className="v">{correct} / {total}</div><div className="l">正解数</div></div>
          <div className="stat">
            <div className="v">{isExam ? (pass ? '合格' : '不合格') : `${Math.round((correct / Math.max(1, total)) * 100)}%`}</div>
            <div className="l">{isExam ? `合格基準 ${subject.def.exam.passScore} 問・所要 ${elapsed} 分` : '正答率'}</div>
          </div>
        </div>
      </div>
      <div className="card">
        <h2>分野別</h2>
        {subject.def.categories.map((c) => {
          const e = byCat.get(c.id)
          if (!e) return null
          return (
            <div className="bar" key={c.id}>
              <span>{c.short}</span>
              <div className="track"><div style={{ width: `${(e.c / e.a) * 100}%` }} /></div>
              <span>{e.c}/{e.a}</span>
            </div>
          )
        })}
      </div>
      <div className="card">
        <h2>各問（タップで解説）</h2>
        <div className="numgrid">
          {items.map((x) => (
            <button key={x.i} className={`${x.ok ? 'ok' : 'ng'} ${open === x.i ? 'current' : ''} ${session.flags[x.i] ? 'flag' : ''}`} onClick={() => setOpen(open === x.i ? null : x.i)}>
              {x.i + 1}
            </button>
          ))}
        </div>
      </div>
      {open != null && items[open].q && (
        <>
          <QuestionView q={items[open].q!} item={items[open].it} selected={session.answers[open]} reveal index={open} total={total} />
          <ExplanationView q={items[open].q!} item={items[open].it} selected={session.answers[open]} subjectCitation={subject.def.citation} />
          <p className="muted small">
            あなたの回答: {session.answers[open] != null ? CHOICE_LABELS[session.answers[open]] : '未回答'} / 正答: {CHOICE_LABELS[correctPos(items[open].q!, items[open].it)]}
          </p>
        </>
      )}
      <button className="btn primary" onClick={() => navigate({ name: 'home' })}>ホームへ</button>
    </Page>
  )
}
