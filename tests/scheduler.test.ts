import { describe, expect, it } from 'vitest'
import { categoryMinimums, nextInterval, selectExam, selectQuestions, updateGroupStat } from '../src/engine/scheduler'
import { mulberry32 } from '../src/engine/rng'
import type { CategoryDef, GroupStat, Question, QuestionStat } from '../src/types'

const categories: CategoryDef[] = [
  { id: 1, name: 'a', short: 'a', examCount: 5 },
  { id: 2, name: 'b', short: 'b', examCount: 6 },
  { id: 3, name: 'c', short: 'c', examCount: 7 },
  { id: 4, name: 'd', short: 'd', examCount: 6 },
  { id: 5, name: 'e', short: 'e', examCount: 4 },
  { id: 6, name: 'f', short: 'f', examCount: 19 },
  { id: 7, name: 'g', short: 'g', examCount: 3 },
]

function makeQuestions(perCategory = 30, perGroup = 3): Question[] {
  const qs: Question[] = []
  for (const c of categories) {
    for (let g = 0; g < perCategory; g++) {
      for (let k = 0; k < perGroup; k++) {
        qs.push({
          id: `q-${c.id}-${g}-${k}`,
          subject: 'denko2',
          category: c.id,
          groupId: `g-${c.id}-${g}`,
          type: 'static',
          stem: 's',
          choices: ['a', 'b', 'c', 'd'],
          answer: 0,
          explanation: { whyCorrect: '', supplement: '' },
          status: 'active',
          source: { year: 2020, term: '上期', number: 1 },
          sharedFigure: c.id === 6 ? `fig-${g % 5}` : undefined,
        })
      }
    }
  }
  return qs
}

describe('categoryMinimums', () => {
  it('30問で全分野を含み合計が30になる', () => {
    const avail = new Map(categories.map((c) => [c.id, 100]))
    const m = categoryMinimums(categories, 30, avail)
    expect([...m.values()].reduce((a, b) => a + b, 0)).toBe(30)
    for (const c of categories) expect(m.get(c.id)! >= 1).toBe(true)
  })
  it('50問では実試験配分と一致する', () => {
    const avail = new Map(categories.map((c) => [c.id, 100]))
    const m = categoryMinimums(categories, 50, avail)
    expect([...m.values()]).toEqual([5, 6, 7, 6, 4, 19, 3])
  })
})

describe('selectQuestions', () => {
  it('30問・全分野・groupId 重複なし（100回試行）', () => {
    const qs = makeQuestions()
    for (let seed = 1; seed <= 100; seed++) {
      const picked = selectQuestions({ questions: qs, categories, groupStats: new Map(), questionStats: new Map(), today: '2026-09-03', count: 30, rng: mulberry32(seed) })
      expect(picked.length).toBe(30)
      const groups = new Set(picked.map((q) => q.groupId))
      expect(groups.size).toBe(30)
      const cats = new Set(picked.map((q) => q.category))
      expect(cats.size).toBe(7)
    }
  })
  it('同じ図面の問題は連続する', () => {
    const qs = makeQuestions()
    const picked = selectQuestions({ questions: qs, categories, groupStats: new Map(), questionStats: new Map(), today: '2026-09-03', count: 30, rng: mulberry32(7) })
    let lastFig: string | undefined
    const seen = new Set<string>()
    for (const q of picked) {
      if (!q.sharedFigure) continue
      if (q.sharedFigure !== lastFig) {
        expect(seen.has(q.sharedFigure)).toBe(false)
        seen.add(q.sharedFigure)
        lastFig = q.sharedFigure
      }
    }
  })
  it('間隔内のグループは復習枠以外では出ない／未出題・期限切れが優先される', () => {
    const qs = makeQuestions(10, 1)
    const gs = new Map<string, GroupStat>()
    // 分野1のグループ 0..7 を「正解続きで間隔内」にする
    for (let g = 0; g < 8; g++) {
      gs.set(`g-1-${g}`, { key: '', subject: 'denko2', groupId: `g-1-${g}`, lastSeen: '2026-09-02', correctStreak: 3, totalSeen: 3, totalCorrect: 3, intervalDays: 7, dueDate: '2026-09-09' })
    }
    let inIntervalCount = 0
    for (let seed = 1; seed <= 50; seed++) {
      const picked = selectQuestions({ questions: qs, categories, groupStats: gs, questionStats: new Map(), today: '2026-09-03', count: 30, rng: mulberry32(seed), reviewSlots: 0 })
      const cat1 = picked.filter((q) => q.category === 1)
      inIntervalCount += cat1.filter((q) => gs.has(q.groupId)).length
      // 分野1は未出題の g-1-8, g-1-9 が優先されるはず（最低数が2なら間隔内は出ない）
      expect(cat1.some((q) => q.groupId === 'g-1-8' || q.groupId === 'g-1-9')).toBe(true)
    }
    expect(inIntervalCount).toBeLessThanOrEqual(50) // 分野1の最低数3に対し未出題2 → 間隔内は各回1つまで
  })
  it('直近に出した問題はグループ内の別問題で代替される', () => {
    const qs = makeQuestions(10, 3)
    const qstats = new Map<string, QuestionStat>()
    qstats.set('q-1-0-0', { key: '', subject: 'denko2', questionId: 'q-1-0-0', lastSeen: '2026-09-02', timesSeen: 1, timesCorrect: 1, lastCorrect: true })
    for (let seed = 1; seed <= 30; seed++) {
      const picked = selectQuestions({ questions: qs, categories, groupStats: new Map(), questionStats: qstats, today: '2026-09-03', count: 30, rng: mulberry32(seed) })
      expect(picked.some((q) => q.id === 'q-1-0-0')).toBe(false)
    }
  })
  it('候補が少なくても落ちない', () => {
    const qs = makeQuestions(2, 1)
    const picked = selectQuestions({ questions: qs, categories, groupStats: new Map(), questionStats: new Map(), today: '2026-09-03', count: 30, rng: mulberry32(1) })
    expect(picked.length).toBe(14)
  })
})

describe('selectExam', () => {
  it('50問・実試験配分・配線図は後半にまとまる', () => {
    const qs = makeQuestions()
    const picked = selectExam({ questions: qs, categories, groupStats: new Map(), questionStats: new Map(), today: '2026-09-03', rng: mulberry32(3) })
    expect(picked.length).toBe(50)
    expect(picked.filter((q) => q.category === 6).length).toBe(19)
    const firstCat6 = picked.findIndex((q) => q.category === 6)
    expect(picked.slice(firstCat6).every((q) => q.category === 6)).toBe(true)
    expect(new Set(picked.map((q) => q.groupId)).size).toBe(50)
  })
})

describe('interval', () => {
  it('正解が続くほど間隔が伸び、間違えると戻る', () => {
    expect([1, 2, 3, 4, 5, 6].map(nextInterval)).toEqual([1, 3, 7, 14, 30, 30])
    let s = updateGroupStat(undefined, { subject: 'denko2', groupId: 'g' }, true, '2026-09-03')
    expect(s.dueDate).toBe('2026-09-04')
    s = updateGroupStat(s, { subject: 'denko2', groupId: 'g' }, true, '2026-09-04')
    expect(s.intervalDays).toBe(3)
    s = updateGroupStat(s, { subject: 'denko2', groupId: 'g' }, false, '2026-09-07')
    expect(s.correctStreak).toBe(0)
    expect(s.intervalDays).toBe(1)
  })
})
