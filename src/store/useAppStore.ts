import { create } from 'zustand'
import { db } from '../db/db'
import { loadSubject, loadSubjectsIndex, type LoadedSubject, type SubjectsIndex } from '../data/loader'
import { instantiate } from '../engine/calc'
import { mulberry32, todayStr } from '../engine/rng'
import { selectExam, selectQuestions, updateGroupStat, updateQuestionStat } from '../engine/scheduler'
import { DEFAULT_SETTINGS, type CategoryId, type DailyLog, type GroupStat, type Question, type QuestionStat, type SessionMode, type SessionRecord, type Settings } from '../types'

export type Route =
  | { name: 'home' }
  | { name: 'session'; id: number }
  | { name: 'result'; id: number }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'history' }

interface AppState {
  ready: boolean
  error?: string
  route: Route
  subjectsIndex?: SubjectsIndex
  subject?: LoadedSubject
  settings: Settings
  groupStats: Map<string, GroupStat>
  questionStats: Map<string, QuestionStat>
  todayLog?: DailyLog
  session?: SessionRecord
  unfinished: SessionRecord[]

  init: () => Promise<void>
  navigate: (r: Route) => void
  switchSubject: (id: string) => Promise<void>
  saveSettings: (patch: Partial<Settings>) => Promise<void>
  activeQuestions: () => Question[]
  startSession: (mode: SessionMode, opts?: { category?: CategoryId; count?: number }) => Promise<number>
  resumeSession: (id: number) => Promise<void>
  answer: (index: number, displayPos: number) => Promise<void>
  toggleFlag: (index: number) => Promise<void>
  goTo: (index: number) => Promise<void>
  finishSession: () => Promise<void>
  abandonSession: (id: number) => Promise<void>
  reloadStats: () => Promise<void>
}

function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, '')
  const [name, arg] = h.split('/')
  if (name === 'session' && arg) return { name: 'session', id: Number(arg) }
  if (name === 'result' && arg) return { name: 'result', id: Number(arg) }
  if (name === 'progress' || name === 'settings' || name === 'history') return { name }
  return { name: 'home' }
}

function hashOf(r: Route): string {
  switch (r.name) {
    case 'session':
    case 'result':
      return `#/${r.name}/${r.id}`
    case 'home':
      return '#/'
    default:
      return `#/${r.name}`
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  route: parseHash(),
  settings: DEFAULT_SETTINGS,
  groupStats: new Map(),
  questionStats: new Map(),
  unfinished: [],

  init: async () => {
    try {
      const settings = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
      const subjectsIndex = await loadSubjectsIndex()
      const subjectId = subjectsIndex.subjects.some((s) => s.id === settings.subject) ? settings.subject : subjectsIndex.subjects[0].id
      const subject = await loadSubject(subjectId)
      set({ settings: { ...settings, subject: subjectId }, subjectsIndex, subject })
      await get().reloadStats()
      window.addEventListener('hashchange', () => set({ route: parseHash() }))
      const r = parseHash()
      if (r.name === 'session' || r.name === 'result') await get().resumeSession(r.id)
      set({ ready: true })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), ready: true })
    }
  },

  navigate: (r) => {
    const h = hashOf(r)
    if (location.hash !== h) location.hash = h
    set({ route: r })
  },

  switchSubject: async (id) => {
    const subject = await loadSubject(id)
    await get().saveSettings({ subject: id })
    set({ subject })
    await get().reloadStats()
  },

  saveSettings: async (patch) => {
    const settings = { ...get().settings, ...patch, key: 'settings' as const }
    await db.settings.put(settings)
    set({ settings })
  },

  reloadStats: async () => {
    const { settings } = get()
    const sid = settings.subject
    const gs = await db.groupStats.where('subject').equals(sid).toArray()
    const qs = await db.questionStats.where('subject').equals(sid).toArray()
    const todayLog = await db.dailyLogs.get(`${sid}:${todayStr()}`)
    const unfinished = (await db.sessions.where('subject').equals(sid).toArray()).filter((s) => !s.finishedAt)
    set({
      groupStats: new Map(gs.map((g) => [g.groupId, g])),
      questionStats: new Map(qs.map((q) => [q.questionId, q])),
      todayLog,
      unfinished,
    })
  },

  activeQuestions: () => {
    const { subject, settings } = get()
    if (!subject) return []
    const enabled = settings.enabledCategories[subject.def.id]
    return subject.questions.filter((q) => q.status === 'active' && (!enabled || enabled.includes(q.category)))
  },

  startSession: async (mode, opts = {}) => {
    const { subject, settings, groupStats, questionStats } = get()
    if (!subject) throw new Error('データ未読込')
    const rng = mulberry32(Date.now() % 2147483647)
    const today = todayStr()
    let pool = mode === 'exam' ? subject.questions.filter((q) => q.status === 'active') : get().activeQuestions()
    if (mode === 'category' && opts.category != null) pool = pool.filter((q) => q.category === opts.category)
    const base = { questions: pool, categories: subject.def.categories, groupStats, questionStats, today, rng }
    const picked =
      mode === 'exam'
        ? selectExam({ ...base, count: subject.def.exam.questionCount })
        : selectQuestions({ ...base, count: opts.count ?? settings.dailyGoal, reviewSlots: mode === 'category' ? 0 : undefined })
    if (picked.length === 0) throw new Error('出題できる問題がありません')
    const items = picked.map((q) => instantiate(q, rng))
    const rec: SessionRecord = {
      subject: subject.def.id,
      mode,
      createdAt: Date.now(),
      startedAt: Date.now(),
      items,
      answers: {},
      flags: {},
      current: 0,
      timeLimitSec: mode === 'exam' ? settings.examMinutes * 60 : undefined,
      category: opts.category,
    }
    const id = (await db.sessions.add(rec)) as number
    set({ session: { ...rec, id } })
    await get().reloadStats()
    get().navigate({ name: 'session', id })
    return id
  },

  resumeSession: async (id) => {
    const s = await db.sessions.get(id)
    if (s) set({ session: s })
  },

  answer: async (index, displayPos) => {
    const { session, subject } = get()
    if (!session || !subject || session.answers[index] != null) return
    const s: SessionRecord = { ...session, answers: { ...session.answers, [index]: displayPos } }
    set({ session: s })
    await db.sessions.put(s)
    // デイリー/分野別は即時に統計へ反映。模擬試験は終了時にまとめて反映
    if (session.mode !== 'exam') await applyResult(index, s)
  },

  toggleFlag: async (index) => {
    const { session } = get()
    if (!session) return
    const s = { ...session, flags: { ...session.flags, [index]: !session.flags[index] } }
    set({ session: s })
    await db.sessions.put(s)
  },

  goTo: async (index) => {
    const { session } = get()
    if (!session) return
    const s = { ...session, current: Math.max(0, Math.min(index, session.items.length - 1)) }
    set({ session: s })
    await db.sessions.put(s)
  },

  finishSession: async () => {
    const { session } = get()
    if (!session || session.finishedAt) return
    const s = { ...session, finishedAt: Date.now() }
    set({ session: s })
    await db.sessions.put(s)
    if (session.mode === 'exam') {
      for (let i = 0; i < s.items.length; i++) await applyResult(i, s)
    }
    await get().reloadStats()
    get().navigate({ name: 'result', id: s.id! })
  },

  abandonSession: async (id) => {
    await db.sessions.delete(id)
    if (get().session?.id === id) set({ session: undefined })
    await get().reloadStats()
  },
}))

/** 1問の結果を統計に反映する（正誤判定は表示順→元インデックスで行う） */
async function applyResult(index: number, s: SessionRecord): Promise<void> {
  const st = useAppStore.getState()
  const subject = st.subject!
  const item = s.items[index]
  const q = subject.byId.get(item.questionId)
  if (!q) return
  const chosen = s.answers[index]
  const correct = isCorrect(q, item, chosen)
  const today = todayStr()
  const gPrev = await db.groupStats.get(`${q.subject}:${q.groupId}`)
  const qPrev = await db.questionStats.get(`${q.subject}:${q.id}`)
  const g = updateGroupStat(gPrev, { subject: q.subject, groupId: q.groupId }, correct, today)
  const qs = updateQuestionStat(qPrev, { subject: q.subject, questionId: q.id }, correct, today)
  const logKey = `${q.subject}:${today}`
  const log: DailyLog = (await db.dailyLogs.get(logKey)) ?? { key: logKey, subject: q.subject, date: today, answered: 0, correct: 0, byCategory: {} }
  log.answered++
  if (correct) log.correct++
  const c = (log.byCategory[q.category] ??= { answered: 0, correct: 0 })
  c.answered++
  if (correct) c.correct++
  await db.transaction('rw', [db.groupStats, db.questionStats, db.dailyLogs], async () => {
    await db.groupStats.put(g)
    await db.questionStats.put(qs)
    await db.dailyLogs.put(log)
  })
  st.groupStats.set(q.groupId, g)
  st.questionStats.set(q.id, qs)
  useAppStore.setState({ todayLog: log, groupStats: new Map(st.groupStats), questionStats: new Map(st.questionStats) })
}

/** 表示位置 displayPos が正答か */
export function isCorrect(q: Question, item: import('../types').QuestionInstance, displayPos: number | undefined): boolean {
  if (displayPos == null) return false
  if (item.calc) return displayPos === item.calc.answer
  return item.order[displayPos] === q.answer
}

/** 正答の表示位置 */
export function correctPos(q: Question, item: import('../types').QuestionInstance): number {
  if (item.calc) return item.calc.answer
  return item.order.indexOf(q.answer)
}

/** 表示用の選択肢配列 */
export function displayChoices(q: Question, item: import('../types').QuestionInstance): string[] {
  if (item.calc) return item.calc.choices
  return item.order.map((i) => q.choices[i])
}
