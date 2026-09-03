/** mulberry32: 再現可能な乱数（テスト用にシード固定できる） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = () => number

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 重み付きランダム抽出（重みに比例した確率で1件取り出す） */
export function weightedPick<T>(items: T[], weight: (t: T) => number, rng: Rng): T | undefined {
  let total = 0
  for (const it of items) total += Math.max(0, weight(it))
  if (total <= 0) return items[0]
  let r = rng() * total
  for (const it of items) {
    r -= Math.max(0, weight(it))
    if (r <= 0) return it
  }
  return items[items.length - 1]
}

export function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return todayStr(dt)
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const da = Date.UTC(ay, am - 1, ad)
  const db = Date.UTC(by, bm - 1, bd)
  return Math.round((db - da) / 86400000)
}
