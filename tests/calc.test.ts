import { describe, expect, it } from 'vitest'
import { allValidCalcs, buildCalc, instantiate } from '../src/engine/calc'
import { mulberry32 } from '../src/engine/rng'
import type { CalcTemplate, Question } from '../src/types'

const t: CalcTemplate = {
  params: { V: [100, 200], R: [10, 20, 25, 50] },
  formula: 'V * V / R',
  accept: 'answer >= 100 && answer <= 5000',
  distractors: ['answer / 2', 'answer * 2', 'V / R'],
  unit: 'W',
  round: 0,
  explanation: 'P = V²/R = {V}²/{R} = **{answer} W**',
}

describe('calc template', () => {
  it('全組合せで正答が選択肢に一意に存在する', () => {
    const all = allValidCalcs(t)
    expect(all.length).toBeGreaterThan(0)
    for (const r of all) {
      expect(r.choices.filter((c) => c === r.answer).length).toBe(1)
      expect(new Set(r.choices).size).toBe(4)
      expect(r.choices[r.answerIndex]).toBe(r.answer)
    }
  })
  it('accept 条件で除外される', () => {
    expect(buildCalc(t, { V: 100, R: 50 })?.answer).toBe(200)
    expect(buildCalc({ ...t, accept: 'answer > 1000' }, { V: 100, R: 50 })).toBeNull()
  })
  it('解説テンプレートに値が埋まる', () => {
    const r = buildCalc(t, { V: 200, R: 20 })!
    expect(r.explanation).toBe('P = V²/R = 200²/20 = **2000 W**')
  })
  it('誤答が重複したら既定ルールで補われる', () => {
    const r = buildCalc({ ...t, distractors: ['answer', 'answer', 'answer'] }, { V: 100, R: 10 })!
    expect(new Set(r.choices).size).toBe(4)
  })
  it('instantiate は計算問題の選択肢を昇順で返し、静的問題はシャッフルする', () => {
    const q: Question = {
      id: 'x', subject: 'denko2', category: 1, groupId: 'g', type: 'calc', stem: '{V} V {R} Ω', choices: ['a', 'b', 'c', 'd'], answer: 0,
      explanation: { whyCorrect: '', supplement: '' }, calcTemplate: t, status: 'active', source: { year: 2020, term: '上期', number: 1 },
    }
    const inst = instantiate(q, mulberry32(1))
    expect(inst.calc).toBeDefined()
    const nums = inst.calc!.choices.map((c) => parseFloat(c))
    expect([...nums].sort((a, b) => a - b)).toEqual(nums)
    const st = instantiate({ ...q, type: 'static', calcTemplate: undefined }, mulberry32(1))
    expect([...st.order].sort()).toEqual([0, 1, 2, 3])
  })
})
