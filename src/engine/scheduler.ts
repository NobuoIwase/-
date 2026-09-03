import type { CategoryDef, GroupStat, Question, QuestionStat } from '../types'
import { addDays, daysBetween, shuffle, weightedPick, type Rng } from './rng'

/** 正解が続いた回数 → 次回までの間隔（日） */
export const INTERVALS = [1, 3, 7, 14, 30]

export function nextInterval(correctStreak: number): number {
  if (correctStreak <= 0) return 1
  return INTERVALS[Math.min(correctStreak - 1, INTERVALS.length - 1)]
}

export interface ScheduleInput {
  questions: Question[] // status === 'active' かつ有効分野のみ渡すこと
  categories: CategoryDef[]
  groupStats: Map<string, GroupStat> // groupId → stat
  questionStats: Map<string, QuestionStat> // questionId → stat
  today: string
  count: number
  /** 間隔内でも「忘れない内にもう一度」枠として混ぜる数 */
  reviewSlots?: number
  rng: Rng
}

/** 各分野の最低出題数（実試験の配分に比例、最大剰余法。データがある分野は最低1問） */
export function categoryMinimums(categories: CategoryDef[], count: number, available: Map<number, number>): Map<number, number> {
  const cats = categories.filter((c) => (available.get(c.id) ?? 0) > 0)
  const total = cats.reduce((s, c) => s + c.examCount, 0)
  const mins = new Map<number, number>()
  if (cats.length === 0 || total === 0) return mins
  const share = cats.map((c) => ({ id: c.id, exact: (c.examCount / total) * count }))
  let used = 0
  for (const s of share) {
    const n = Math.max(1, Math.floor(s.exact))
    mins.set(s.id, n)
    used += n
  }
  // 残りを小数部の大きい順に配る（count を超えないよう）
  const rest = share.map((s) => ({ id: s.id, frac: s.exact - Math.floor(s.exact) })).sort((a, b) => b.frac - a.frac)
  for (const r of rest) {
    if (used >= count) break
    mins.set(r.id, (mins.get(r.id) ?? 0) + 1)
    used++
  }
  // 利用可能数を超えない
  for (const [id, n] of mins) mins.set(id, Math.min(n, available.get(id) ?? 0))
  return mins
}

interface GroupCand {
  groupId: string
  category: number
  questions: Question[]
  priority: number
  due: boolean
  unseen: boolean
}

/** グループの出題優先度。未出題 > 直近で間違えた > 期限切れ > 間隔内 */
export function groupPriority(stat: GroupStat | undefined, today: string): { priority: number; due: boolean; unseen: boolean } {
  if (!stat) return { priority: 100, due: true, unseen: true }
  const overdue = daysBetween(stat.dueDate, today) // 正なら期限超過
  if (stat.correctStreak === 0) return { priority: 90 + Math.min(overdue, 10), due: true, unseen: false }
  if (overdue >= 0) return { priority: 60 + Math.min(overdue, 30), due: true, unseen: false }
  // 間隔内。正答率が低いほど、期限が近いほど高め
  const acc = stat.totalSeen > 0 ? stat.totalCorrect / stat.totalSeen : 1
  return { priority: 3 + (1 - acc) * 10 + Math.max(0, 5 + overdue) * 0.5, due: false, unseen: false }
}

/** グループ内から1問選ぶ。直近に出た問題は避け、出題回数の少ないものを優先 */
export function pickQuestionInGroup(qs: Question[], qstats: Map<string, QuestionStat>, today: string, rng: Rng): Question {
  const scored = qs.map((q) => {
    const s = qstats.get(q.id)
    const since = s ? daysBetween(s.lastSeen, today) : 9999
    const seen = s?.timesSeen ?? 0
    // 直近7日以内に出た問題は強く避ける
    const recentPenalty = since < 7 ? 1000 : 0
    return { q, score: recentPenalty + seen * 10 - Math.min(since, 60) / 10 }
  })
  const min = Math.min(...scored.map((s) => s.score))
  const best = scored.filter((s) => s.score <= min + 1e-9).map((s) => s.q)
  return best[Math.floor(rng() * best.length)]
}

/**
 * デイリー/分野別セッションの問題選択。
 * - 全分野を含める（分野別最低数）
 * - 同一 groupId は1問まで
 * - 優先度による重み付きランダム
 * - 候補が足りなければ正答率の低いグループから補充
 */
export function selectQuestions(input: ScheduleInput): Question[] {
  const { questions, categories, groupStats, questionStats, today, count, rng } = input
  const reviewSlots = input.reviewSlots ?? Math.min(2, Math.floor(count / 10))
  const byGroup = new Map<string, Question[]>()
  for (const q of questions) {
    if (!byGroup.has(q.groupId)) byGroup.set(q.groupId, [])
    byGroup.get(q.groupId)!.push(q)
  }
  const cands: GroupCand[] = []
  for (const [groupId, qs] of byGroup) {
    const p = groupPriority(groupStats.get(groupId), today)
    cands.push({ groupId, category: qs[0].category, questions: qs, ...p })
  }
  const availableByCat = new Map<number, number>()
  for (const c of cands) availableByCat.set(c.category, (availableByCat.get(c.category) ?? 0) + 1)
  const mins = categoryMinimums(categories, count, availableByCat)

  const chosen: GroupCand[] = []
  const used = new Set<string>()
  const take = (pool: GroupCand[]): GroupCand | undefined => {
    const c = weightedPick(pool, (g) => g.priority, rng)
    if (!c) return undefined
    used.add(c.groupId)
    chosen.push(c)
    return c
  }
  // 1) 分野別最低数（期限切れ・未出題を優先。足りなければ間隔内からも）
  for (const [cat, n] of mins) {
    for (let i = 0; i < n; i++) {
      const duePool = cands.filter((c) => c.category === cat && !used.has(c.groupId) && c.due)
      const anyPool = cands.filter((c) => c.category === cat && !used.has(c.groupId))
      if (!take(duePool.length ? duePool : anyPool)) break
    }
  }
  // 2) 復習枠: 間隔内のグループから少数
  for (let i = 0; i < reviewSlots && chosen.length < count; i++) {
    const pool = cands.filter((c) => !used.has(c.groupId) && !c.due)
    if (!pool.length) break
    take(pool)
  }
  // 3) 残りは期限切れ・未出題から優先度重みで
  while (chosen.length < count) {
    const pool = cands.filter((c) => !used.has(c.groupId) && c.due)
    if (!pool.length) break
    take(pool)
  }
  // 4) それでも足りなければ正答率の低い順に補充
  if (chosen.length < count) {
    const rest = cands
      .filter((c) => !used.has(c.groupId))
      .sort((a, b) => b.priority - a.priority)
    for (const c of rest) {
      if (chosen.length >= count) break
      used.add(c.groupId)
      chosen.push(c)
    }
  }
  const picked = chosen.map((c) => pickQuestionInGroup(c.questions, questionStats, today, rng))
  return orderForSession(picked, rng)
}

/** 順序: ランダム。ただし同じ図面 (sharedFigure) の問題は連続させ、配線図問題は後半にまとめる（実試験と同じ体験） */
export function orderForSession(qs: Question[], rng: Rng): Question[] {
  const normal = qs.filter((q) => !q.sharedFigure)
  const withFig = qs.filter((q) => q.sharedFigure)
  const groups = new Map<string, Question[]>()
  for (const q of withFig) {
    const k = q.sharedFigure!
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(q)
  }
  const figBlocks = shuffle([...groups.values()], rng).map((g) => g.sort((a, b) => a.source.number - b.source.number))
  return [...shuffle(normal, rng), ...figBlocks.flat()]
}

/** 模擬試験: 実試験の分野配分どおりに 50 問。groupId 重複なし。分野内はランダム */
export function selectExam(input: Omit<ScheduleInput, 'count' | 'reviewSlots'> & { count?: number }): Question[] {
  const { questions, categories, questionStats, today, rng } = input
  const total = input.count ?? categories.reduce((s, c) => s + c.examCount, 0)
  const byGroup = new Map<string, Question[]>()
  for (const q of questions) {
    if (!byGroup.has(q.groupId)) byGroup.set(q.groupId, [])
    byGroup.get(q.groupId)!.push(q)
  }
  const groupsByCat = new Map<number, string[]>()
  for (const [gid, qs] of byGroup) {
    const c = qs[0].category
    if (!groupsByCat.has(c)) groupsByCat.set(c, [])
    groupsByCat.get(c)!.push(gid)
  }
  const available = new Map<number, number>()
  for (const [c, g] of groupsByCat) available.set(c, g.length)
  const quota = categoryMinimums(categories, total, available)
  const picked: Question[] = []
  const used = new Set<string>()
  for (const [cat, n] of quota) {
    const gids = shuffle(groupsByCat.get(cat) ?? [], rng)
    for (const gid of gids.slice(0, n)) {
      used.add(gid)
      picked.push(pickQuestionInGroup(byGroup.get(gid)!, questionStats, today, rng))
    }
  }
  // 端数を埋める
  if (picked.length < total) {
    const rest = shuffle([...byGroup.keys()].filter((g) => !used.has(g)), rng)
    for (const gid of rest) {
      if (picked.length >= total) break
      picked.push(pickQuestionInGroup(byGroup.get(gid)!, questionStats, today, rng))
    }
  }
  // 実試験の順: 一般問題(分野1〜5,7)を分野順→配線図(6)。分野内はランダム
  const cat6 = picked.filter((q) => q.category === 6)
  const others = picked.filter((q) => q.category !== 6)
  const ordered = [...others].sort((a, b) => a.category - b.category || rng() - 0.5)
  return [...ordered, ...orderForSession(cat6, rng)]
}

/** 回答結果でグループ統計を更新（SM-2 簡略版） */
export function updateGroupStat(prev: GroupStat | undefined, base: { subject: string; groupId: string }, correct: boolean, today: string): GroupStat {
  const streak = correct ? (prev?.correctStreak ?? 0) + 1 : 0
  const interval = nextInterval(streak)
  return {
    key: `${base.subject}:${base.groupId}`,
    subject: base.subject,
    groupId: base.groupId,
    lastSeen: today,
    correctStreak: streak,
    totalSeen: (prev?.totalSeen ?? 0) + 1,
    totalCorrect: (prev?.totalCorrect ?? 0) + (correct ? 1 : 0),
    intervalDays: interval,
    dueDate: addDays(today, interval),
  }
}

export function updateQuestionStat(prev: QuestionStat | undefined, base: { subject: string; questionId: string }, correct: boolean, today: string): QuestionStat {
  return {
    key: `${base.subject}:${base.questionId}`,
    subject: base.subject,
    questionId: base.questionId,
    lastSeen: today,
    timesSeen: (prev?.timesSeen ?? 0) + 1,
    timesCorrect: (prev?.timesCorrect ?? 0) + (correct ? 1 : 0),
    lastCorrect: correct,
  }
}
