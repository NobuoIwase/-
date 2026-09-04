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

/**
 * 実試験の表記に合わせて数値を文字列にする。
 * 4 桁以上の整数部は半角スペースで 3 桁ずつ区切る（実試験の「1 440」「1 600」と同じ書き方）。
 */
export function formatNumber(v: number, digits: number): string {
  const r = roundTo(v, digits)
  const s = digits > 0 ? r.toFixed(digits).replace(/\.?0+$/, '') : String(r)
  const [intPart, frac] = s.split('.')
  const sign = intPart.startsWith('-') ? '-' : ''
  const body = sign ? intPart.slice(1) : intPart
  const grouped = body.length >= 4 ? body.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : body
  return sign + grouped + (frac ? `.${frac}` : '')
}

/**
 * パラメータを表示用の文字列にする。プール内の値の小数桁に合わせるので、
 * 電線の直径 2.0 mm が「2 mm」になるような桁落ちを防ぐ。
 */
export function formatParams(pool: Record<string, number[]>, chosen: Record<string, number>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(chosen)) {
    const digits = Math.max(0, ...(pool[k] ?? [v]).map((n) => (String(n).split('.')[1] ?? '').length))
    out[k] = digits > 0 ? v.toFixed(digits) : String(v)
  }
  return out
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
  /** 表示用に桁を保った値（2.0 が "2" にならないようにする） */
  paramsText: Record<string, string>
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
  const paramsText = formatParams(t.params, params)
  const expl = t.explanation.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (k === 'answer') return formatNumber(ra, digits)
    if (k in paramsText) return paramsText[k]
    // {expr:...} 形式は非対応。未知のキーはそのまま残す
    return `{${k}}`
  })
  return { params, paramsText, answer: ra, choices, answerIndex, explanation: expl }
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
          paramsText: c.paramsText,
          choices: c.choices.map((v) => formatNumber(v, digits) + unit) as [string, string, string, string],
          answer: c.answerIndex,
          explanation: c.explanation,
        },
      }
    }
  }
  return { questionId: q.id, order }
}
