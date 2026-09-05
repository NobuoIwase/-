import { createContext, useContext, useState, type ReactNode } from 'react'
import type { GlossaryEntry } from '../types'
import { EMPTY_GLOSSARY, Glossary } from '../data/glossary'

interface Ctx {
  glossary: Glossary
  open: (entry: GlossaryEntry) => void
}

const GlossaryCtx = createContext<Ctx>({ glossary: EMPTY_GLOSSARY, open: () => {} })

export function useGlossary(): Ctx {
  return useContext(GlossaryCtx)
}

/**
 * 用語辞典を配下に配り、用語をタップしたときのシートを持つ。
 * アプリ全体を1つで包む。
 */
export function GlossaryProvider({ glossary, children }: { glossary: Glossary; children: ReactNode }) {
  const [stack, setStack] = useState<GlossaryEntry[]>([])
  const current = stack[stack.length - 1]
  const open = (entry: GlossaryEntry) => setStack((s) => (s[s.length - 1]?.term === entry.term ? s : [...s, entry]))
  const back = () => setStack((s) => s.slice(0, -1))
  const close = () => setStack([])

  return (
    <GlossaryCtx.Provider value={{ glossary, open }}>
      {children}
      {current && (
        <div className="sheet-backdrop" onClick={close} role="presentation">
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${current.term} の意味`}>
            <div className="sheet-head">
              {stack.length > 1 ? (
                <button className="iconbtn" onClick={back} aria-label="戻る">
                  ←
                </button>
              ) : (
                <span className="pill">ことば</span>
              )}
              <div className="sheet-title">
                <strong>{current.term}</strong>
                {current.reading && <span className="muted small">（{current.reading}）</span>}
              </div>
              <button className="iconbtn" onClick={close} aria-label="閉じる">
                ✕
              </button>
            </div>
            <p className="sheet-short">{current.short}</p>
            <p className="sheet-plain">{current.plain}</p>
            {current.related?.length ? (
              <div className="sheet-related">
                <span className="muted small">関連: </span>
                {current.related.map((r) => {
                  const e = glossary.byTerm.get(r)
                  return e ? (
                    <button key={r} className="term-chip" onClick={() => open(e)}>
                      {r}
                    </button>
                  ) : (
                    <span key={r} className="term-chip disabled">
                      {r}
                    </span>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </GlossaryCtx.Provider>
  )
}

/** 本文中の用語を点線つきのボタンにする。skip に入れた語は素の文字で描く */
export function GlossaryText({ text, skip }: { text: string; skip?: Set<string> }) {
  const { glossary, open } = useGlossary()
  if (glossary.size === 0) return <>{text}</>
  return (
    <>
      {glossary.split(text, skip).map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <button key={i} className="term" onClick={() => open(part.entry)} title={part.entry.short}>
            {part.text}
          </button>
        ),
      )}
    </>
  )
}

/** 「この問題に出てきた言葉」の一覧 */
export function GlossaryList({ entries }: { entries: GlossaryEntry[] }) {
  const { open } = useGlossary()
  if (!entries.length) return null
  return (
    <div className="glossary-list">
      <h4>この問題に出てきた言葉</h4>
      <div className="row">
        {entries.map((e) => (
          <button key={e.term} className="term-chip" onClick={() => open(e)}>
            {e.term}
            <span className="muted small">{e.short}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
