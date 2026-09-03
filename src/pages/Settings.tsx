import { useRef, useState } from 'react'
import { Page } from '../components/Layout'
import { exportAll, importAll, resetAll } from '../db/db'
import { figureUrl } from '../data/loader'
import { useAppStore } from '../store/useAppStore'

export default function Settings() {
  const subject = useAppStore((s) => s.subject)
  const subjectsIndex = useAppStore((s) => s.subjectsIndex)
  const settings = useAppStore((s) => s.settings)
  const save = useAppStore((s) => s.saveSettings)
  const switchSubject = useAppStore((s) => s.switchSubject)
  const reload = useAppStore((s) => s.reloadStats)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string>()
  const [dl, setDl] = useState<{ done: number; total: number } | null>(null)
  if (!subject) return null
  const sid = subject.def.id
  const enabled = settings.enabledCategories[sid] ?? subject.def.categories.map((c) => c.id)

  const toggleCat = (id: number) => {
    const next = enabled.includes(id) ? enabled.filter((x) => x !== id) : [...enabled, id].sort()
    if (next.length === 0) return
    void save({ enabledCategories: { ...settings.enabledCategories, [sid]: next } })
  }

  const doExport = async () => {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kakomon-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const doImport = async (f: File) => {
    try {
      const data = JSON.parse(await f.text())
      if (!confirm('現在の進捗を上書きしてインポートします。よろしいですか？')) return
      await importAll(data, 'replace')
      await reload()
      setMsg('インポートしました')
    } catch (e) {
      setMsg(`インポート失敗: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const prefetchFigures = async () => {
    const urls = new Set<string>()
    for (const q of subject.questions) {
      for (const p of [q.figure, q.sharedFigure, q.choicesFigure, ...(q.choiceFigures ?? [])]) if (p) urls.add(figureUrl(sid, p))
    }
    const list = [...urls]
    setDl({ done: 0, total: list.length })
    let done = 0
    const cache = 'caches' in window ? await caches.open('figures') : null
    for (const u of list) {
      try {
        if (cache) {
          if (!(await cache.match(u))) await cache.add(u)
        } else await fetch(u)
      } catch {
        /* 続行 */
      }
      done++
      setDl({ done, total: list.length })
    }
    setMsg(`図 ${done} 件をオフライン用に保存しました`)
  }

  return (
    <Page title="設定">
      {subjectsIndex && subjectsIndex.subjects.length > 1 && (
        <div className="card">
          <h2>試験種別</h2>
          <select value={sid} onChange={(e) => switchSubject(e.target.value)}>
            {subjectsIndex.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      <div className="card">
        <h2>1日の問題数</h2>
        <div className="row">
          <input type="number" min={5} max={100} step={5} value={settings.dailyGoal} onChange={(e) => save({ dailyGoal: Math.max(5, Math.min(100, Number(e.target.value) || 30)) })} />
          <span className="muted">問（既定 30）</span>
        </div>
      </div>
      <div className="card">
        <h2>模擬試験の制限時間</h2>
        <div className="row">
          <input type="number" min={10} max={240} step={10} value={settings.examMinutes} onChange={(e) => save({ examMinutes: Math.max(10, Math.min(240, Number(e.target.value) || 120)) })} />
          <span className="muted">分（実試験 {subject.def.exam.minutes} 分）</span>
        </div>
      </div>
      <div className="card">
        <h2>出題する分野（デイリー・分野別に適用。模擬試験は常に全分野）</h2>
        {subject.def.categories.map((c) => (
          <label className="check" key={c.id}>
            <input type="checkbox" checked={enabled.includes(c.id)} onChange={() => toggleCat(c.id)} />
            <span>{c.id}. {c.name}</span>
          </label>
        ))}
      </div>
      <div className="card">
        <h2>表示</h2>
        <select value={settings.theme} onChange={(e) => save({ theme: e.target.value as 'auto' | 'light' | 'dark' })}>
          <option value="auto">端末の設定に従う</option>
          <option value="light">ライト</option>
          <option value="dark">ダーク</option>
        </select>
      </div>
      <div className="card">
        <h2>オフライン</h2>
        <p className="small muted">問題文はインストール時に保存済みです。図・写真は表示した時に保存されますが、ここで一括保存もできます。</p>
        <button className="btn secondary" disabled={!!dl && dl.done < dl.total} onClick={prefetchFigures}>
          {dl && dl.done < dl.total ? `保存中 ${dl.done}/${dl.total}` : '図・写真を一括保存'}
        </button>
      </div>
      <div className="card">
        <h2>バックアップ（機種変更用）</h2>
        <button className="btn secondary" onClick={doExport}>進捗をエクスポート（JSON）</button>
        <button className="btn secondary" onClick={() => fileRef.current?.click()}>進捗をインポート</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        <button
          className="btn secondary"
          style={{ color: 'var(--ng)' }}
          onClick={async () => {
            if (!confirm('すべての進捗を削除します。よろしいですか？')) return
            await resetAll()
            await reload()
            setMsg('進捗を削除しました')
          }}
        >
          進捗をすべて削除
        </button>
      </div>
      <p className="muted small">
        問題は一般財団法人 電気技術者試験センターが公表した過去問題を使用しています（出典は各問に表示）。解説は本アプリ独自のものです。
      </p>
      {msg && <div className="toast" onClick={() => setMsg(undefined)}>{msg}</div>}
    </Page>
  )
}
