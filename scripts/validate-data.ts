/**
 * 問題データの検証（ビルド前に実行）。
 *  - スキーマ: 必須項目、選択肢4つ、answer 0-3、category が subject.json に存在
 *  - id 重複なし、groupId が groups.json に存在（警告）
 *  - 参照画像ファイルの存在
 *  - 計算テンプレート: 全組合せで正答が選択肢に一意に存在、採用可能な組合せが1つ以上
 *  - 出典 (source) が揃っている
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { allValidCalcs } from '../src/engine/calc'
import type { GroupsFile, Question, SubjectDef } from '../src/types'

const root = join(import.meta.dirname ?? '.', '..')
const dataDir = join(root, 'public', 'data')
const subjects = JSON.parse(readFileSync(join(dataDir, 'subjects.json'), 'utf8')) as { subjects: { id: string }[] }
let errors = 0
let warnings = 0
const err = (m: string) => { errors++; console.error('ERROR ' + m) }
const warn = (m: string) => { warnings++; console.warn('WARN  ' + m) }

for (const s of subjects.subjects) {
  const dir = join(dataDir, s.id)
  const def = JSON.parse(readFileSync(join(dir, 'subject.json'), 'utf8')) as SubjectDef
  const catIds = new Set(def.categories.map((c) => c.id))
  let groups = new Set<string>()
  if (existsSync(join(dir, 'groups.json'))) {
    const g = JSON.parse(readFileSync(join(dir, 'groups.json'), 'utf8')) as GroupsFile
    groups = new Set(g.groups.map((x) => x.id))
    for (const x of g.groups) if (!catIds.has(x.category)) err(`${s.id}/groups.json: ${x.id} の category ${x.category} が不正`)
  }
  const ids = new Set<string>()
  const questionDir = join(dir, 'questions')
  const listed = new Set(def.questionFiles)
  for (const f of readdirSync(questionDir)) if (f.endsWith('.json') && !listed.has(f)) warn(`${s.id}/questions/${f} は subject.json の questionFiles に載っていない（読み込まれない）`)
  let total = 0, active = 0, calc = 0
  const groupCats = new Map<string, number>()
  for (const f of def.questionFiles) {
    const p = join(questionDir, f)
    if (!existsSync(p)) { err(`${s.id}: questions/${f} が存在しない`); continue }
    let qs: Question[]
    try { qs = JSON.parse(readFileSync(p, 'utf8')) } catch (e) { err(`${f}: JSON parse error: ${e}`); continue }
    if (!Array.isArray(qs)) { err(`${f}: 配列ではない`); continue }
    for (const q of qs) {
      total++
      const tag = `${f}:${q.id}`
      if (!q.id) { err(`${f}: id なし`); continue }
      if (ids.has(q.id)) err(`${tag}: id 重複`)
      ids.add(q.id)
      if (q.subject !== s.id) err(`${tag}: subject が ${s.id} でない`)
      if (!catIds.has(q.category)) err(`${tag}: category ${q.category} が不正`)
      if (!q.groupId) err(`${tag}: groupId なし`)
      else {
        if (groups.size && !groups.has(q.groupId)) warn(`${tag}: groupId ${q.groupId} が groups.json にない`)
        const gc = groupCats.get(q.groupId)
        if (gc != null && gc !== q.category) err(`${tag}: groupId ${q.groupId} が複数の分野にまたがっている (${gc}, ${q.category})`)
        groupCats.set(q.groupId, q.category)
      }
      if (!q.stem?.trim()) err(`${tag}: stem が空`)
      if (!Array.isArray(q.choices) || q.choices.length !== 4) err(`${tag}: choices は4つ必要`)
      else if (q.choices.some((c) => typeof c !== 'string' || (!c.trim() && !q.choicesFigure && !q.choiceFigures))) err(`${tag}: 空の選択肢`)
      if (![0, 1, 2, 3].includes(q.answer)) err(`${tag}: answer は 0-3`)
      if (!q.explanation?.whyCorrect?.trim()) err(`${tag}: explanation.whyCorrect が空`)
      if (!q.explanation?.supplement?.trim()) err(`${tag}: explanation.supplement が空`)
      if (q.explanation?.whyOthersWrong && q.explanation.whyOthersWrong.length !== 4) err(`${tag}: whyOthersWrong は4要素（正答の位置は空文字）`)
      if (!['active', 'retired'].includes(q.status)) err(`${tag}: status が不正`)
      if (q.status === 'retired' && !q.retiredReason) warn(`${tag}: retired だが retiredReason がない`)
      if (!q.source || typeof q.source.year !== 'number' || !q.source.term || typeof q.source.number !== 'number') err(`${tag}: source {year, term, number} が必要`)
      for (const p2 of [q.figure, q.sharedFigure, q.choicesFigure, ...(q.choiceFigures ?? [])]) {
        if (p2 && !existsSync(join(dir, p2))) err(`${tag}: 画像 ${p2} が存在しない`)
      }
      if (q.type === 'calc') {
        calc++
        if (!q.calcTemplate) { err(`${tag}: type=calc だが calcTemplate がない`); continue }
        const t = q.calcTemplate
        if (!t.params || !t.formula || !Array.isArray(t.distractors) || !t.explanation) err(`${tag}: calcTemplate の必須項目不足 (params, formula, distractors, explanation)`)
        else {
          const all = allValidCalcs(t)
          if (all.length === 0) err(`${tag}: 採用可能なパラメータ組合せが0件`)
          for (const r of all) {
            if (r.choices.filter((c) => c === r.answer).length !== 1) err(`${tag}: 正答が一意でない ${JSON.stringify(r.params)}`)
            if (new Set(r.choices).size !== 4) err(`${tag}: 選択肢が重複 ${JSON.stringify(r.params)}`)
          }
          if (t.original) {
            const ok = Object.entries(t.original).every(([k, v]) => t.params[k]?.includes(v))
            if (!ok) err(`${tag}: original の値が params のプールに含まれていない`)
          }
          for (const k of Object.keys(t.params)) if (!q.stem.includes(`{${k}}`) && !t.explanation.includes(`{${k}}`)) warn(`${tag}: パラメータ {${k}} が stem/explanation で使われていない`)
        }
      } else if (q.type !== 'static') err(`${tag}: type が不正`)
      if (q.status === 'active') active++
    }
  }
  console.log(`${s.id}: ${total} 問 (active ${active}, calc ${calc}), groups ${groupCats.size}`)
}
console.log(`errors: ${errors}, warnings: ${warnings}`)
if (errors > 0) process.exit(1)
