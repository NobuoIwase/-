import { describe, expect, it } from 'vitest'
import { Glossary } from '../src/data/glossary'
import type { GlossaryEntry } from '../src/types'

const entries: GlossaryEntry[] = [
  { term: '絶縁抵抗', reading: 'ぜつえんていこう', short: '電気の漏れにくさ', plain: '…' },
  { term: '絶縁抵抗計', reading: 'ぜつえんていこうけい', short: '漏れにくさを測る計器', plain: '…', aliases: ['メガー'] },
  { term: '接地', short: 'アース', plain: '…', related: ['絶縁抵抗'] },
  { term: 'ルームエアコン', short: '部屋用エアコン', plain: '…', aliases: ['RC'] },
  { term: '電力量計', short: '電力量をはかる計器', plain: '…', aliases: ['Wh'] },
  { term: '架橋ポリエチレン絶縁ビニルシースケーブル', short: '熱に強いケーブル', plain: '…', aliases: ['CV'] },
]
const g = new Glossary(entries)

describe('Glossary', () => {
  it('一番長く一致する語を採る（絶縁抵抗計が絶縁抵抗に割られない）', () => {
    const parts = g.split('絶縁抵抗計で絶縁抵抗を測る')
    const terms = parts.filter((p) => typeof p !== 'string').map((p) => (p as { text: string }).text)
    expect(terms).toEqual(['絶縁抵抗計', '絶縁抵抗'])
  })

  it('別名も拾う', () => {
    const parts = g.split('メガーを使う')
    const hit = parts.find((p) => typeof p !== 'string') as { entry: GlossaryEntry }
    expect(hit.entry.term).toBe('絶縁抵抗計')
  })

  it('skip に入れた語は2回目から素の文字になる', () => {
    const skip = new Set<string>()
    const first = g.split('接地を施す', skip).filter((p) => typeof p !== 'string')
    const second = g.split('接地をもう一度', skip).filter((p) => typeof p !== 'string')
    expect(first).toHaveLength(1)
    expect(second).toHaveLength(0)
  })

  it('元の文字列を欠けも重複もなく復元できる', () => {
    for (const text of ['絶縁抵抗計で絶縁抵抗を測る', '接地工事と絶縁抵抗', 'ここに用語はない', '', 'メガー']) {
      const joined = g
        .split(text)
        .map((p) => (typeof p === 'string' ? p : p.text))
        .join('')
      expect(joined).toBe(text)
    }
  })

  it('collect は出現順に重複なく集める', () => {
    const got = g.collect(['絶縁抵抗を測る', '接地と絶縁抵抗'])
    expect(got.map((e) => e.term)).toEqual(['絶縁抵抗', '接地'])
  })

  it('英字の略号は長い英単語の一部としては拾わない', () => {
    const terms = (text: string) =>
      g.split(text).filter((p) => typeof p !== 'string').map((p) => (p as { text: string }).text)
    expect(terms('CIRCUIT BREAKER')).toEqual([]) // CIRCUIT の中の RC
    expect(terms('W（White）の刻印')).toEqual([]) // White の中の Wh
    expect(terms('DCV・ACV の表示')).toEqual([]) // DCV/ACV の中の CV
    expect(terms('RC は図記号')).toEqual(['RC']) // 単独なら拾う
    expect(terms('CV14－3C を使う')).toEqual(['CV']) // 数字は区切りとして扱う
  })

  it('用語辞典が空でも落ちない', () => {
    const empty = new Glossary([])
    expect(empty.split('なにか')).toEqual(['なにか'])
    expect(empty.collect(['なにか'])).toEqual([])
  })
})
