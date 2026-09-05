import type { GlossaryEntry, GlossaryFile } from '../types'

/**
 * 用語辞典。本文中に出てきた用語をタップできるようにするための索引を作る。
 *
 * 日本語には単語の区切りがないので、位置ごとに「一番長く一致する語」を採る。
 * 「絶縁抵抗計」と「絶縁抵抗」が両方あるとき、前者を優先して途中で切らないため。
 */
export class Glossary {
  /** 見出し語・別名 → 項目 */
  private index = new Map<string, GlossaryEntry>()
  /** 見出し語 → 項目（related の解決用） */
  readonly byTerm = new Map<string, GlossaryEntry>()
  private maxLen = 0
  readonly size: number

  constructor(entries: GlossaryEntry[]) {
    for (const e of entries) {
      this.byTerm.set(e.term, e)
      for (const key of [e.term, ...(e.aliases ?? [])]) {
        if (!key) continue
        // 先に登録された方を優先（見出し語が別名に上書きされないよう term から先に入れる）
        if (!this.index.has(key)) this.index.set(key, e)
        if (key.length > this.maxLen) this.maxLen = key.length
      }
    }
    this.size = entries.length
  }

  get(term: string): GlossaryEntry | undefined {
    return this.index.get(term)
  }

  /**
   * 文字列を「素の文字列」と「用語」に分解する。
   * skip に既出の用語を渡すと、その語は素の文字列として返す（同じ語を何度も光らせないため）。
   * skip は破壊的に更新される。
   */
  split(text: string, skip?: Set<string>): Array<string | { text: string; entry: GlossaryEntry }> {
    if (this.index.size === 0) return [text]
    const out: Array<string | { text: string; entry: GlossaryEntry }> = []
    let buf = ''
    let i = 0
    while (i < text.length) {
      let hit: { text: string; entry: GlossaryEntry } | undefined
      const max = Math.min(this.maxLen, text.length - i)
      for (let len = max; len >= 2; len--) {
        const slice = text.slice(i, i + len)
        const entry = this.index.get(slice)
        if (!entry) continue
        // 英字の略号は、前後に同じ大小の英字が続くときは語の一部とみなして拾わない。
        // 「CIRCUIT」の中の RC、「White」の中の Wh、「JET」の中の ET などの誤検出を防ぐ。
        // 数字は区切りとして扱うので「CV14-3C」の CV や「HIVE16」の HIVE は拾える。
        if (gluedLetters(text[i - 1], slice[0]) || gluedLetters(slice[len - 1], text[i + len])) continue
        hit = { text: slice, entry }
        break
      }
      if (hit && !(skip && skip.has(hit.entry.term))) {
        if (buf) {
          out.push(buf)
          buf = ''
        }
        out.push(hit)
        skip?.add(hit.entry.term)
        i += hit.text.length
      } else if (hit) {
        // 既出の語。素の文字列として、語をまとめて送る
        buf += hit.text
        i += hit.text.length
      } else {
        buf += text[i]
        i += 1
      }
    }
    if (buf) out.push(buf)
    return out
  }

  /** 文章群に出てくる用語を、出現順に重複なく集める */
  collect(texts: (string | undefined)[], limit = 12): GlossaryEntry[] {
    const seen = new Set<string>()
    const out: GlossaryEntry[] = []
    for (const t of texts) {
      if (!t) continue
      for (const part of this.split(t)) {
        if (typeof part === 'string') continue
        if (seen.has(part.entry.term)) continue
        seen.add(part.entry.term)
        out.push(part.entry)
        if (out.length >= limit) return out
      }
    }
    return out
  }
}

/** 英字どうしが同じ大小で隣り合っているか（略号が長い英単語の一部になっていないかの判定） */
function gluedLetters(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  const upper = (c: string) => c >= 'A' && c <= 'Z'
  const lower = (c: string) => c >= 'a' && c <= 'z'
  return (upper(a) && upper(b)) || (lower(a) && lower(b))
}

export const EMPTY_GLOSSARY = new Glossary([])

export function parseGlossary(file: GlossaryFile | undefined): Glossary {
  if (!file?.terms?.length) return EMPTY_GLOSSARY
  return new Glossary(file.terms)
}
