import { figureUrl } from '../data/loader'
import { CHOICE_LABELS, type GlossaryEntry, type Question, type QuestionInstance } from '../types'
import { correctPos, displayChoices } from '../store/useAppStore'
import { Figure } from './FigureView'
import { GlossaryList, GlossaryText, useGlossary } from './Glossary'

/**
 * 簡易 Markdown: 段落・改行・**強調**・`code` だけ対応。
 * glossary を true にすると、地の文の用語をタップできるようにする（強調・コード内は対象外）。
 * skip を渡すと、同じ用語を1回だけ光らせる。
 */
export function Md({ text, glossary, skip }: { text: string; glossary?: boolean; skip?: Set<string> }) {
  const paras = text.split(/\n{2,}/)
  return (
    <>
      {paras.map((p, i) => (
        <p key={i}>{inline(p, glossary, skip)}</p>
      ))}
    </>
  )
}
function inline(s: string, glossary?: boolean, skip?: Set<string>) {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/)
  return parts.map((part, i) => {
    if (part === '\n') return <br key={i} />
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    return glossary ? <GlossaryText key={i} text={part} skip={skip} /> : part
  })
}

/** 計算問題: 問題文中の {R} などをインスタンスの値に置換 */
export function renderStem(q: Question, item: QuestionInstance): string {
  if (!item.calc) return q.stem
  const { params, paramsText } = item.calc
  return q.stem.replace(/\{(\w+)\}/g, (m, k: string) =>
    paramsText && k in paramsText ? paramsText[k] : k in params ? String(params[k]) : m,
  )
}

export function QuestionView({
  q,
  item,
  selected,
  reveal,
  onSelect,
  index,
  total,
}: {
  q: Question
  item: QuestionInstance
  selected?: number
  reveal: boolean
  onSelect?: (pos: number) => void
  index: number
  total: number
}) {
  const choices = displayChoices(q, item)
  const correct = correctPos(q, item)
  // 同じ用語は1問につき1回だけ光らせる（本文が下線だらけにならないように）
  const termSkip = new Set<string>()
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="muted">
          {index + 1} / {total}
        </span>
        <span className="pill">
          分野{q.category}
          {q.type === 'calc' && item.calc ? '・数値変更' : ''}
        </span>
      </div>
      {q.sharedFigure && <Figure src={figureUrl(q.subject, q.sharedFigure)} alt="配線図" />}
      {q.premise && (
        <details className="premise">
          <summary>前提条件（この問題群に共通）</summary>
          <Md text={q.premise} glossary skip={termSkip} />
        </details>
      )}
      <div className="stem">
        <Md text={renderStem(q, item)} glossary skip={termSkip} />
      </div>
      {q.figure && <Figure src={figureUrl(q.subject, q.figure)} />}
      {q.note && <div className="note">⚠ {q.note}</div>}
      {q.choicesFigure && <Figure src={figureUrl(q.subject, q.choicesFigure)} alt="選択肢" />}
      <div className="choices">
        {choices.map((c, pos) => {
          let cls = 'choice'
          if (reveal) {
            if (pos === correct) cls += ' correct'
            else if (pos === selected) cls += ' wrong'
          } else if (pos === selected) cls += ' selected'
          const fig = q.choiceFigures?.[item.order[pos]]
          return (
            <button key={pos} className={cls} disabled={reveal || !onSelect} onClick={() => onSelect?.(pos)}>
              <span className="label">{CHOICE_LABELS[pos]}</span>
              <span>
                {fig && <img src={figureUrl(q.subject, fig)} alt={`選択肢${CHOICE_LABELS[pos]}`} />}
                {(!fig || !q.choicesFigure) && <Md text={c} />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ExplanationView({ q, item, selected, subjectCitation }: { q: Question; item: QuestionInstance; selected?: number; subjectCitation: string }) {
  const correct = correctPos(q, item)
  const isOk = selected === correct
  const termSkip = new Set<string>()
  const chosenOrig = selected != null ? item.order[selected] : undefined
  const whyWrong = !item.calc && chosenOrig != null && !isOk ? q.explanation.whyOthersWrong?.[chosenOrig] : undefined
  const cite = subjectCitation
    .replace('{year}', String(q.source.year))
    .replace('{term}', q.source.term)
    .replace('{session}', q.source.session ? `（${q.source.session}）` : '')
    .replace('{exam}', q.source.year >= 2023 ? '学科' : '筆記')
  return (
    <div className={`feedback ${isOk ? 'ok' : 'ng'}`}>
      <h3>{isOk ? '正解！' : selected == null ? '未回答' : '不正解'}</h3>
      {!isOk && (
        <p>
          正答は <strong>{CHOICE_LABELS[correct]}</strong>
        </p>
      )}
      {item.calc ? (
        <>
          <h4>解き方</h4>
          <Md text={item.calc.explanation} glossary skip={termSkip} />
        </>
      ) : (
        !isOk && (
          <>
            <h4>なぜ {CHOICE_LABELS[correct]} が正答か</h4>
            <Md text={q.explanation.whyCorrect} glossary skip={termSkip} />
            {whyWrong && (
              <>
                <h4>選んだ {CHOICE_LABELS[selected!]} が違う理由</h4>
                <Md text={whyWrong} glossary skip={termSkip} />
              </>
            )}
          </>
        )
      )}
      {/* 補足は計算問題でも出す（周辺知識・覚え方は数値が変わっても役に立つ） */}
      <h4>{isOk ? '補足' : 'ポイント'}</h4>
      <Md text={q.explanation.supplement} glossary skip={termSkip} />
      {isOk && !item.calc && q.explanation.whyCorrect && (
        <details>
          <summary>根拠を見る</summary>
          <Md text={q.explanation.whyCorrect} glossary skip={termSkip} />
        </details>
      )}
      {q.explanation.references?.length ? <p className="small muted">根拠: {q.explanation.references.join('、')}</p> : null}
      <p className="small muted">
        {cite} 問{q.source.number}
        {item.calc ? '（数値を変更して出題）' : ''}
      </p>
    </div>
  )
}

/**
 * 「もっと分かりやすく！」と用語の一覧。解説カードの下に置く。
 * 専門用語に慣れていなくても、ここだけ読めば何を問われたのか分かるようにする。
 */
export function SimpleView({ q, item }: { q: Question; item: QuestionInstance }) {
  const { glossary } = useGlossary()
  const simple = q.explanation.simple
  const terms: GlossaryEntry[] = glossary.collect([
    renderStem(q, item),
    q.explanation.whyCorrect,
    q.explanation.supplement,
    simple,
  ])
  if (!simple && !terms.length) return null
  const skip = new Set<string>()
  return (
    <div className="simple">
      {simple && (
        <>
          <h3>
            <span aria-hidden="true">💡</span> もっと分かりやすく！
          </h3>
          <Md text={simple} glossary skip={skip} />
        </>
      )}
      <GlossaryList entries={terms} />
    </div>
  )
}
