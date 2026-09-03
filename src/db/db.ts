import Dexie, { type EntityTable } from 'dexie'
import type { DailyLog, GroupStat, QuestionStat, SessionRecord, Settings } from '../types'

export class AppDB extends Dexie {
  sessions!: EntityTable<SessionRecord, 'id'>
  groupStats!: EntityTable<GroupStat, 'key'>
  questionStats!: EntityTable<QuestionStat, 'key'>
  dailyLogs!: EntityTable<DailyLog, 'key'>
  settings!: EntityTable<Settings, 'key'>

  constructor() {
    super('kakomon')
    this.version(1).stores({
      sessions: '++id, subject, mode, finishedAt, [subject+mode]',
      groupStats: 'key, subject, dueDate',
      questionStats: 'key, subject',
      dailyLogs: 'key, subject, date',
      settings: 'key',
    })
  }
}

export const db = new AppDB()

export interface ExportData {
  version: 1
  exportedAt: string
  sessions: SessionRecord[]
  groupStats: GroupStat[]
  questionStats: QuestionStat[]
  dailyLogs: DailyLog[]
  settings: Settings[]
}

export async function exportAll(): Promise<ExportData> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: await db.sessions.toArray(),
    groupStats: await db.groupStats.toArray(),
    questionStats: await db.questionStats.toArray(),
    dailyLogs: await db.dailyLogs.toArray(),
    settings: await db.settings.toArray(),
  }
}

export async function importAll(data: ExportData, mode: 'replace' | 'merge' = 'replace'): Promise<void> {
  if (data.version !== 1) throw new Error('未対応のバージョンです')
  await db.transaction('rw', [db.sessions, db.groupStats, db.questionStats, db.dailyLogs, db.settings], async () => {
    if (mode === 'replace') {
      await Promise.all([db.sessions.clear(), db.groupStats.clear(), db.questionStats.clear(), db.dailyLogs.clear(), db.settings.clear()])
    }
    await db.sessions.bulkPut(data.sessions.map((s) => (mode === 'replace' ? s : { ...s, id: undefined })))
    await db.groupStats.bulkPut(data.groupStats)
    await db.questionStats.bulkPut(data.questionStats)
    await db.dailyLogs.bulkPut(data.dailyLogs)
    await db.settings.bulkPut(data.settings)
  })
}

export async function resetAll(): Promise<void> {
  await db.transaction('rw', [db.sessions, db.groupStats, db.questionStats, db.dailyLogs], async () => {
    await Promise.all([db.sessions.clear(), db.groupStats.clear(), db.questionStats.clear(), db.dailyLogs.clear()])
  })
}
