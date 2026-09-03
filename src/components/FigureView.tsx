import { useEffect, useRef, useState } from 'react'

/** 図の表示。タップで全画面、ピンチ/ドラッグで拡大・移動 */
export function Figure({ src, alt, small }: { src: string; alt?: string; small?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="figure">
      <img src={src} alt={alt ?? '図'} onClick={() => setOpen(true)} style={small ? { maxHeight: '25vh' } : undefined} />
      <div className="hint">タップで拡大</div>
      {open && <Zoom src={src} onClose={() => setOpen(false)} />}
    </div>
  )
}

export function Zoom({ src, onClose }: { src: string; onClose: () => void }) {
  const areaRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const state = useRef({ scale: 1, x: 0, y: 0, base: 1 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const last = useRef<{ dist: number; cx: number; cy: number } | null>(null)
  const [, force] = useState(0)

  const apply = () => {
    const s = state.current
    if (imgRef.current) imgRef.current.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.scale})`
  }

  const fit = () => {
    const area = areaRef.current
    const img = imgRef.current
    if (!area || !img || !img.naturalWidth) return
    const base = Math.min(area.clientWidth / img.naturalWidth, area.clientHeight / img.naturalHeight)
    state.current = { scale: base, base, x: (area.clientWidth - img.naturalWidth * base) / 2, y: (area.clientHeight - img.naturalHeight * base) / 2 }
    apply()
    force((n) => n + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', fit)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', fit)
    }
  }, [onClose])

  const zoomAt = (factor: number, cx: number, cy: number) => {
    const s = state.current
    const ns = Math.max(s.base * 0.5, Math.min(s.base * 8, s.scale * factor))
    const k = ns / s.scale
    s.x = cx - (cx - s.x) * k
    s.y = cy - (cy - s.y) * k
    s.scale = ns
    apply()
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    last.current = null
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointers.current
    if (!p.has(e.pointerId)) return
    const prev = p.get(e.pointerId)!
    p.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const rect = areaRef.current!.getBoundingClientRect()
    if (p.size === 1) {
      state.current.x += e.clientX - prev.x
      state.current.y += e.clientY - prev.y
      apply()
    } else if (p.size >= 2) {
      const [a, b] = [...p.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const cx = (a.x + b.x) / 2 - rect.left
      const cy = (a.y + b.y) / 2 - rect.top
      if (last.current) {
        zoomAt(dist / last.current.dist, cx, cy)
        state.current.x += cx - last.current.cx
        state.current.y += cy - last.current.cy
        apply()
      }
      last.current = { dist, cx, cy }
    }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    last.current = null
  }
  const onDouble = (e: React.MouseEvent) => {
    const rect = areaRef.current!.getBoundingClientRect()
    const s = state.current
    if (s.scale > s.base * 1.5) fit()
    else zoomAt(2.5, e.clientX - rect.left, e.clientY - rect.top)
  }

  return (
    <div className="overlay" role="dialog" aria-label="図の拡大表示">
      <div
        className="zoomarea"
        ref={areaRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDouble}
        onWheel={(e) => {
          const rect = areaRef.current!.getBoundingClientRect()
          zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top)
        }}
      >
        <img ref={imgRef} src={src} alt="拡大図" onLoad={fit} draggable={false} />
      </div>
      <div className="tools">
        <button onClick={() => zoomAt(1 / 1.5, areaRef.current!.clientWidth / 2, areaRef.current!.clientHeight / 2)}>－</button>
        <button onClick={fit}>全体</button>
        <button onClick={() => zoomAt(1.5, areaRef.current!.clientWidth / 2, areaRef.current!.clientHeight / 2)}>＋</button>
        <button onClick={onClose}>閉じる</button>
      </div>
    </div>
  )
}
