import type { GroupDef, GroupsFile, Question, SubjectDef } from '../types'

export interface SubjectsIndex {
  subjects: { id: string; name: string; shortName: string }[]
}

export interface LoadedSubject {
  def: SubjectDef
  questions: Question[]
  groups: Map<string, GroupDef>
  byId: Map<string, Question>
}

const BASE = import.meta.env.BASE_URL

export function dataUrl(path: string): string {
  return `${BASE}data/${path}`.replace(/\/+/g, '/')
}

/** 図画像の URL。subject 相対パス (figures/....png) を解決 */
export function figureUrl(subject: string, path: string): string {
  if (/^(https?:)?\//.test(path)) return path
  return dataUrl(`${subject}/${path}`)
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(dataUrl(path))
  if (!res.ok) throw new Error(`${path} の読み込みに失敗しました (${res.status})`)
  return (await res.json()) as T
}

export async function loadSubjectsIndex(): Promise<SubjectsIndex> {
  return getJson<SubjectsIndex>('subjects.json')
}

export async function loadSubject(id: string): Promise<LoadedSubject> {
  const def = await getJson<SubjectDef>(`${id}/subject.json`)
  const files = await Promise.all(def.questionFiles.map((f) => getJson<Question[]>(`${id}/questions/${f}`)))
  const questions = files.flat()
  const byId = new Map<string, Question>()
  for (const q of questions) byId.set(q.id, q)
  let groups = new Map<string, GroupDef>()
  try {
    const g = await getJson<GroupsFile>(`${id}/groups.json`)
    groups = new Map(g.groups.map((x) => [x.id, x]))
  } catch {
    // groups.json が無くても動く（groupId をそのまま名前として扱う）
  }
  return { def, questions, groups, byId }
}
