import { useEffect, useMemo, useState } from 'react'
import { Page } from '../components/Layout'
import { ExplanationView, QuestionView } from '../components/QuestionCard'
import { useAppStore } from '../store/useAppStore'

export default function Session({ id }: { id: number }) {
  const session = useAppStore((s) => s.session)
  const subject = useAppStore((s) => s.subject)
  const resume = useAppStore((s) => s.resumeSession)
  const answer = useAppStore((s) => s.answer)
  const goTo = useAppStore((s) => s.goTo)
  const toggleFlag = useAppStore((s) => s.toggleFlag)
  const finish = useAppStore((s) => s.finishSession)
  const navigate = useAppStore((s) => s.navigate)
  const [showList, setShowList] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!session || session.id !== id) void resume(id)
  }, [id, session, resume])

  const isExam = session?.mode === 'exam'
  useEffect(() => {
    if (!isExam) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isExam])

  const remainingSec = useMemo(() => {
    if (!session?.timeLimitSec) return undefined
    return Math.max(0, session.timeLimitSec - Math.floor((now - session.startedAt) / 1000))
  }, [session, now])

  useEffect(() => {
    if (isExam && remainingSec === 0 && session && !session.finishedAt) void finish()
  }, [isExam, remainingSec, session, finish])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [session?.current])

  if (!session || !subject || session.id !== id) return <Page title="読み込み中"><p className="muted">…</p></Page>
  if (session.finishedAt) {
    navigate({ name: 'result', id })
    return null
  }
  const i = session.current
  const item = session.items[i]
  const q = subject.byId.get(item.questionId)
  if (!q) return <Page title="エラー"><p>問題 {item.questionId} が見つかりません（データ更新後の古いセッション）。ホームから破棄してください。</p></Page>
  const selected = session.answers[i]
  const answered = selected != null
  const reveal = !isExam && answered
  const total = session.items.length
  const answeredCount = Object.keys(session.answers).length
  const isLast = i === total - 1
  const title = isExam ? '模擬試験' : session.mode === 'category' ? `分野${session.category} 集中` : 'デイリー練習'

  return (
    <div className="app">
      <div className="topbar">
        <button className="iconbtn" onClick={() => navigate({ name: 'home' })} aria-label="ホーム">⌂</button>
        <h1>{title}</h1>
        {isExam && remainingSec != null && (
          <span className={`timer ${remainingSec < 600 ? 'warn' : ''}`}>
            {String(Math.floor(remainingSec / 60)).padStart(2, '0')}:{String(remainingSec % 60).padStart(2, '0')}
          </span>
        )}
        <button className={`iconbtn ${session.flags[i] ? 'active' : ''}`} onClick={() => toggleFlag(i)} aria-label="見直しフラグ">
          {session.flags[i] ? '🚩' : '⚑'}
        </button>
        <button className={`iconbtn ${showList ? 'active' : ''}`} onClick={() => setShowList((v) => !v)} aria-label="問題一覧">☰</button>
      </div>
      <div className="progressbar" style={{ borderRadius: 0 }}>
        <div style={{ width: `${(answeredCount / total) * 100}%` }} />
      </div>
      <main>
        {showList && (
          <div className="card">
            <h2>問題一覧（{answeredCount}/{total} 回答済）</h2>
            <div className="numgrid">
              {session.items.map((_, k) => {
                const a = session.answers[k] != null
                let cls = a ? 'answered' : ''
                if (k === i) cls += ' current'
                if (session.flags[k]) cls += ' flag'
                return (
                  <button key={k} className={cls} onClick={() => { void goTo(k); setShowList(false) }}>
                    {k + 1}
                  </button>
                )
              })}
            </div>
            {isExam && (
              <p className="muted small" style={{ marginTop: 8 }}>
                未回答: {total - answeredCount} 問・フラグ: {Object.values(session.flags).filter(Boolean).length} 問
              </p>
            )}
          </div>
        )}
        <QuestionView q={q} item={item} selected={selected} reveal={reveal} onSelect={(pos) => answer(i, pos)} index={i} total={total} />
        {reveal && <ExplanationView q={q} item={item} selected={selected} subjectCitation={subject.def.citation} />}
      </main>
      <div className="bottombar">
        <button className="btn secondary" style={{ flex: 1 }} disabled={i === 0} onClick={() => goTo(i - 1)}>
          ← 前
        </button>
        {isExam ? (
          isLast || answeredCount === total ? (
            <button className="btn primary" style={{ flex: 2 }} onClick={() => { if (answeredCount < total && !confirm(`未回答が ${total - answeredCount} 問あります。採点しますか？`)) return; void finish() }}>
              採点する
            </button>
          ) : (
            <button className="btn primary" style={{ flex: 2 }} onClick={() => goTo(i + 1)}>
              次へ →
            </button>
          )
        ) : isLast ? (
          <button className="btn primary" style={{ flex: 2 }} disabled={!answered} onClick={() => finish()}>
            結果を見る
          </button>
        ) : (
          <button className="btn primary" style={{ flex: 2 }} disabled={!answered} onClick={() => goTo(i + 1)}>
            次の問題 →
          </button>
        )}
      </div>
    </div>
  )
}
