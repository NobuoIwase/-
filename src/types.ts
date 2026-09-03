/** 試験種別。将来 "boiler2" | "reito3" を追加する */
export type SubjectId = string

export type CategoryId = number

export interface CategoryDef {
  id: CategoryId
  name: string
  short: string
  /** 実試験(50問)での出題数の目安。デイリー30問の最低数はこれに比例させる */
  examCount: number
}

export interface SubjectDef {
  id: SubjectId
  name: string
  shortName: string
  /** 模擬試験の設定 */
  exam: { questionCount: number; minutes: number; passScore: number }
  categories: CategoryDef[]
  /** questions/ 配下の読み込む JSON ファイル名 */
  questionFiles: string[]
  /** 出典表記のテンプレート。{year} {term} {session} を置換 */
  citation: string
}

export interface CalcTemplate {
  /** パラメータ名 → 候補値プール */
  params: Record<string, number[]>
  /** 正答を返す JS 式。params の名前と Math が使える。例: "V * V / R" */
  formula: string
  /** 採用条件（省略可）。answer と params が使える。例: "answer >= 10 && answer <= 2000" */
  accept?: string
  /** 誤答生成式。answer と params が使える。例: ["answer * 2", "answer / 2", "answer + 10"] */
  distractors: string[]
  unit?: string
  /** 丸め桁数（小数点以下）。整数なら 0 */
  round?: number
  /** 解説テンプレート。{R} {V} {answer} 等を置換。Markdown 可 */
  explanation: string
  /** 元の過去問の数値（プールに必ず含める）。表示用 */
  original?: Record<string, number>
}

export interface Explanation {
  whyCorrect: string
  whyOthersWrong?: string[]
  supplement: string
  references?: string[]
}

export interface Question {
  id: string
  subject: SubjectId
  category: CategoryId
  groupId: string
  type: 'static' | 'calc'
  stem: string
  /** 問題文の図（回路図・写真など）。public/data/<subject>/ からの相対パス */
  figure?: string
  /** 配線図問題で参照する図面ページ画像。同じ figure を持つ問は連続出題される */
  sharedFigure?: string
  /** 選択肢が写真・図の場合、「答え」欄全体の画像（イ〜ニのラベル入り）。この場合 choices はラベルのみ */
  choicesFigure?: string
  /** 選択肢ごとの画像（任意） */
  choiceFigures?: [string, string, string, string]
  choices: [string, string, string, string]
  answer: 0 | 1 | 2 | 3
  /** 選択肢をシャッフルするか。choicesFigure がある場合や「最も近い値」型は false 推奨。省略時 true */
  shuffleChoices?: boolean
  explanation: Explanation
  calcTemplate?: CalcTemplate
  status: 'active' | 'retired'
  retiredReason?: string
  /** 現行法令との相違など、出題時に表示する注記 */
  note?: string
  source: { year: number; term: string; session?: string; number: number }
  tags?: string[]
}

export interface GroupDef {
  id: string
  name: string
  category: CategoryId
  /** 一言で言うとどんな知識か */
  summary?: string
  /** 分野をまたいで同じ知識を問うグループ（表示・復習導線用。出題制御には未使用） */
  relatedGroups?: string[]
}

export interface GroupsFile {
  subject: SubjectId
  groups: GroupDef[]
}

/** 出題時に具体化した1問（計算問題は数値を確定、選択肢順も確定） */
export interface QuestionInstance {
  questionId: string
  /** 表示順 → 元の選択肢インデックス */
  order: [number, number, number, number]
  /** 計算問題で確定した値・選択肢 */
  calc?: {
    params: Record<string, number>
    choices: [string, string, string, string]
    answer: 0 | 1 | 2 | 3
    explanation: string
  }
}

export type SessionMode = 'daily' | 'exam' | 'category'

export interface SessionRecord {
  id?: number
  subject: SubjectId
  mode: SessionMode
  createdAt: number
  startedAt: number
  finishedAt?: number
  items: QuestionInstance[]
  /** index → 選んだ表示位置(0-3)。未回答は undefined */
  answers: Record<number, number>
  flags: Record<number, boolean>
  current: number
  /** 模擬試験の制限時間(秒) */
  timeLimitSec?: number
  category?: CategoryId
}

export interface GroupStat {
  key: string // `${subject}:${groupId}`
  subject: SubjectId
  groupId: string
  lastSeen: string // YYYY-MM-DD
  correctStreak: number
  totalSeen: number
  totalCorrect: number
  intervalDays: number
  dueDate: string // YYYY-MM-DD
}

export interface QuestionStat {
  key: string // `${subject}:${questionId}`
  subject: SubjectId
  questionId: string
  lastSeen: string
  timesSeen: number
  timesCorrect: number
  lastCorrect: boolean
}

export interface DailyLog {
  key: string // `${subject}:${date}`
  subject: SubjectId
  date: string
  answered: number
  correct: number
  byCategory: Record<string, { answered: number; correct: number }>
}

export interface Settings {
  key: 'settings'
  subject: SubjectId
  dailyGoal: number
  enabledCategories: Record<SubjectId, CategoryId[]>
  examMinutes: number
  theme: 'auto' | 'light' | 'dark'
}

export const DEFAULT_SETTINGS: Settings = {
  key: 'settings',
  subject: 'denko2',
  dailyGoal: 30,
  enabledCategories: {},
  examMinutes: 120,
  theme: 'auto',
}

export const CHOICE_LABELS = ['イ', 'ロ', 'ハ', 'ニ'] as const
