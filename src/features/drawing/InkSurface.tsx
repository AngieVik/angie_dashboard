import { useRef } from 'react'
import type { Position } from '@/domain/document/types'
import { DrawingCursor } from '@/components/DrawingCursor'
import type { InkPath, InkChanges } from './inkGeometry'
import { eraseInk } from './eraseInk'
import { distance, offset, type Projection } from './shapeGeometry'
import styles from './drawing.module.css'

interface Fragment { id: string; points: Position[] }
interface Gesture { id: number; start: Position; last: Position; move?: InkPath; parts: Map<string, Fragment[]>; changed: Set<string> }
export function InkSurface({ mode, projection, paths, diameter, selected, select, preview, commit, clear }: {
  mode: 'select' | 'eraser' | 'erase-object'; projection: Projection; paths: InkPath[]; diameter: number; selected: string | null
  select: (id: string) => void; preview: (changes: InkChanges) => void
  commit: (changes: InkChanges, translation?: Position) => void; clear: () => void
}) {
  const node = useRef<HTMLDivElement>(null), gesture = useRef<Gesture | null>(null)
  function point(e: React.PointerEvent) {
    const el = node.current!, rect = el.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * el.clientWidth / rect.width, y: (e.clientY - rect.top) * el.clientHeight / rect.height }
  }
  function erase(g: Gesture, p: Position) {
    for (const [id, parts] of g.parts) {
      let modified = false
      const next = parts.flatMap(piece => {
        const cut = eraseInk(piece.points, g.last, p, diameter / 2)
        if (!cut) return [piece]
        modified = true
        return cut.map((points, i) => ({ id: i ? crypto.randomUUID() : piece.id, points }))
      })
      if (modified) { g.changed.add(id); g.parts.set(id, next) }
    }
    g.last = p
  }
  function changes(g: Gesture): InkChanges {
    return new Map([...g.changed].map(id => [id, (g.parts.get(id) ?? []).map(part => ({ id: part.id, points: part.points.map(projection.world) }))]))
  }
  function update(g: Gesture, p: Position) {
    if (g.move) {
      if (distance(g.start, p) < 3 && !g.changed.size) return
      g.changed.add(g.move.id)
      g.parts.set(g.move.id, [{ id: g.move.id, points: g.move.points.map(q => offset(projection.screen(q), p.x - g.start.x, p.y - g.start.y)) }])
    } else if (mode === 'eraser') erase(g, p)
  }
  function cancel() { gesture.current = null; clear() }
  return <div data-ink-surface ref={node} className={styles.ink} style={{ pointerEvents: mode === 'eraser' ? 'auto' : 'none' }} tabIndex={-1}
    onKeyDown={e => { if (e.key === 'Escape' && gesture.current) cancel() }}
    onPointerDown={e => {
      if (!e.isPrimary || e.button !== 0) return
      const id = (e.target as Element).closest('[data-ink]')?.getAttribute('data-ink'), path = paths.find(s => s.id === id)
      if (!path && mode !== 'eraser') return
      e.preventDefault(); e.stopPropagation(); e.currentTarget.focus({ preventScroll: true })
      const p = point(e)
      const g: Gesture = { id: e.pointerId, start: p, last: p, move: mode === 'select' ? path : undefined, parts: new Map(), changed: new Set() }
      gesture.current = g
      e.currentTarget.setPointerCapture(e.pointerId)
      if (mode === 'select' && path) select(path.id)
      if (mode === 'erase-object' && path) { g.parts.set(path.id, []); g.changed.add(path.id) }
      if (mode === 'eraser') {
        for (const s of paths) g.parts.set(s.id, [{ id: s.id, points: s.points.map(projection.screen) }])
        erase(g, p)
      }
      if (g.changed.size) preview(changes(g))
    }} onPointerMove={e => {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      e.stopPropagation(); update(g, point(e))
      if (g.changed.size) preview(changes(g))
    }} onPointerUp={e => {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      e.stopPropagation()
      const p = point(e)
      update(g, p); gesture.current = null
      if (g.changed.size) commit(changes(g), g.move ? { x: p.x - g.start.x, y: p.y - g.start.y } : undefined)
      clear()
    }} onLostPointerCapture={() => { if (gesture.current) cancel() }} onPointerCancel={cancel}>
    {mode === 'eraser' ? <DrawingCursor diameter={diameter} /> :
      <svg width="100%" height="100%" className={styles.inkPaths}>{paths.map(path => {
        const pts = path.points.map(projection.screen), first = pts[0]
        if (!first) return null
        const color = mode === 'select' && selected === path.id ? 'var(--color-selection-border)' : 'transparent'
        const dot = pts.every(p => p.x === first.x && p.y === first.y)
        if (dot) return <circle key={path.id} data-ink={path.id} cx={first.x} cy={first.y} r={Math.max(4, path.width / 2)} fill="transparent" stroke={color} pointerEvents="all" />
        const points = pts.map(p => p.x + ',' + p.y).join(' ')
        return <g key={path.id} data-ink={path.id}><polyline points={points} fill="none" stroke="transparent" strokeWidth={Math.max(path.width, 8)} pointerEvents="stroke" />
          {selected === path.id && <polyline points={points} fill="none" stroke={color} strokeDasharray="3 3" pointerEvents="none" />}</g>
      })}</svg>}
  </div>
}
