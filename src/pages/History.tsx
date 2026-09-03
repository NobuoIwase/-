import { useEffect, useState } from 'react'
import { Page } from '../components/Layout'
import { db } from '../db/db'
import { isCorrect, useAppStore } from '../store/useAppStore'
import type { SessionRecord } from '../types'

export default function History() {
  const subject = useAppStore((s) => s.subject)
  const navigate = useAppStore((s) => s.navigate)
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  useEffect(() => {
    if (!subject) return
    void db.sessions.where('subject').equals(subject.def.id).reverse().sortBy('createdAt').then((s) => setSessions(s.filter((x) => x.finishedAt)))
  }, [subject])
  if (!subject) return null
  const label = { daily: 'デイリー', exam: '模擬試験', category: '分野別' }
  return (
    <Page title="履歴">
      <div className="card">
        {sessions.length === 0 && <p className="muted">まだ記録がありません</p>}
        {sessions.map((s) => {
          const correct = s.items.filter((it, i) => {
            const q = subject.byId.get(it.questionId)
            return q && isCorrect(q, it, s.answers[i])
          }).length
          return (
            <div className="list-item" key={s.id}>
              <div>
                <div>{label[s.mode]}{s.category ? `（分野${s.category}）` : ''}</div>
                <div className="muted small">{new Date(s.createdAt).toLocaleString('ja-JP')}</div>
              </div>
              <div className="row">
                <span className={`pill ${s.mode === 'exam' ? (correct >= subject.def.exam.passScore ? 'ok' : 'ng') : ''}`}>{correct}/{s.items.length}</span>
                <button className="iconbtn" onClick={() => navigate({ name: 'result', id: s.id! })}>詳細</button>
              </div>
            </div>
          )
        })}
      </div>
    </Page>
  )
}
