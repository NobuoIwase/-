import type { CalcTemplate, Question, QuestionInstance } from '../types'
import type { Rng } from './rng'
import { shuffle } from './rng'

/** 式を評価する。データは自前の JSON なので Function で評価する（外部入力は評価しない） */
function evalExpr(expr: string, scope: Record<string, number>): number {
  const names = Object.keys(scope)
  const fn = new Function(...names, 'Math', `"use strict"; return (${expr});`) as (...a: unknown[]) => unknown
  const v = fn(...names.map((n) => scope[n]), Math)
  return typeof v === 'number' ? v : Number(v)
}

function roundTo(v: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.round(v * f) / f
}

export function formatNumber(v: number, digits: number): string {
  const r = roundTo(v, digits)
  // 1440 → "1 440" のような実試験の空白区切りは使わず、通常表記
  return digits > 0 ? r.toFixed(digits).replace(/\.?0+$/, '') : String(r)
}

/** 全パラメータ組合せを列挙（プールが大きい場合はランダムに最大 maxCombos 件） */
export function* combos(params: Record<string, number[]>): Generator<Record<string, number>> {
  const keys = Object.keys(params)
  const idx = keys.map(() => 0)
  if (keys.some((k) => params[k].length === 0)) return
  while (true) {
    const o: Record<string, number> = {}
    keys.forEach((k, i) => (o[k] = params[k][idx[i]]))
    yield o
    let i = keys.length - 1
    while (i >= 0) {
      idx[i]++
      if (idx[i] < params[keys[i]].length) break
      idx[i] = 0
      i--
    }
    if (i < 0) return
  }
}

export interface CalcResult {
  params: Record<string, number>
  answer: number
  choices: number[]
  answerIndex: 0 | 1 | 2 | 3
  explanation: string
}

/** 1組のパラメータから正答・誤答を生成。条件を満たさなければ null */
export function buildCalc(t: CalcTemplate, params: Record<string, number>): CalcResult | null {
  const digits = t.round ?? 0
  let answer: number
  try {
    answer = evalExpr(t.formula, params)
  } catch {
    return null
  }
  if (!Number.isFinite(answer)) return null
  const scope = { ...params, answer }
  if (t.accept) {
    try {
      if (!evalExpr(t.accept, scope)) return null
    } catch {
      return null
    }
  }
  const ra = roundTo(answer, digits)
  const seen = new Set<number>([ra])
  const ds: number[] = []
  for (const d of t.distractors) {
    let v: number
    try {
      v = evalExpr(d, scope)
    } catch {
      continue
    }
    if (!Number.isFinite(v) || v < 0) continue
    const rv = roundTo(v, digits)
    if (seen.has(rv)) continue
    seen.add(rv)
    ds.push(rv)
    if (ds.length === 3) break
  }
  // 誤答が3つ揃わなければ既定ルールで補う
  const fallback = [ra * 2, ra / 2, ra * 1.5, ra * 3, ra / 4, ra + Math.max(1, Math.abs(ra) / 5)]
  for (const f of fallback) {
    if (ds.length === 3) break
    const rv = roundTo(f, digits)
    if (rv > 0 && !seen.has(rv)) {
      seen.add(rv)
      ds.push(rv)
    }
  }
  if (ds.length < 3) return null
  const choices = [ra, ...ds].sort((a, b) => a - b) // 実試験は数値の昇順
  const answerIndex = choices.indexOf(ra) as 0 | 1 | 2 | 3
  const expl = t.explanation.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (k === 'answer') return formatNumber(ra, digits)
    if (k in params) return String(params[k])
    // {expr:...} 形式は非対応。未知のキーはそのまま残す
    return `{${k}}`
  })
  return { params, answer: ra, choices, answerIndex, explanation: expl }
}

/** 採用可能な全組合せを列挙（データ検証用） */
export function allValidCalcs(t: CalcTemplate): CalcResult[] {
  const out: CalcResult[] = []
  for (const p of combos(t.params)) {
    const r = buildCalc(t, p)
    if (r) out.push(r)
  }
  return out
}

/** 出題用に1組を選ぶ。元問題の数値 (original) は 1/(候補数) の確率で自然に含まれる */
export function pickCalc(t: CalcTemplate, rng: Rng): CalcResult | null {
  const all = allValidCalcs(t)
  if (all.length === 0) return null
  return all[Math.floor(rng() * all.length)]
}

/** 問題を具体化する（選択肢順の決定・計算問題の数値決定） */
export function instantiate(q: Question, rng: Rng): QuestionInstance {
  const doShuffle = q.shuffleChoices ?? (q.choicesFigure ? false : q.type !== 'calc')
  const order = (doShuffle ? shuffle([0, 1, 2, 3], rng) : [0, 1, 2, 3]) as [number, number, number, number]
  if (q.type === 'calc' && q.calcTemplate) {
    const c = pickCalc(q.calcTemplate, rng)
    if (c) {
      const unit = q.calcTemplate.unit ? ` ${q.calcTemplate.unit}` : ''
      const digits = q.calcTemplate.round ?? 0
      return {
        questionId: q.id,
        order: [0, 1, 2, 3],
        calc: {
          params: c.params,
          choices: c.choices.map((v) => formatNumber(v, digits) + unit) as [string, string, string, string],
          answer: c.answerIndex,
          explanation: c.explanation,
        },
      }
    }
  }
  return { questionId: q.id, order }
}
