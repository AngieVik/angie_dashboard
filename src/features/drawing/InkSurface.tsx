import { useRef, useState } from 'react'
import type { DrawingObjects, Position } from '@/domain/document/types'
import type { InkPath, InkChanges } from './inkGeometry'
import { eraserBox, rectangleErase } from './rectangleErase'
import { distance, offset, type Projection } from './shapeGeometry'
import styles from './drawing.module.css'

export function InkSurface({ mode, projection, paths, objects, selected, select, preview, commit, clear }: {
  mode: 'select' | 'eraser'; projection: Projection; paths: InkPath[]; objects: DrawingObjects; selected: string | null
  select: (id: string) => void; preview: (changes: InkChanges) => void
  commit: (changes: InkChanges, translation?: Position) => void; clear: () => void
}) {
  const node = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ id: number; start: Position; path?: InkPath } | null>(null)
  const [box, setBox] = useState<ReturnType<typeof eraserBox> | null>(null)
  function point(e: React.PointerEvent) {
    const el = node.current!, rect = el.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * el.clientWidth / rect.width, y: (e.clientY - rect.top) * el.clientHeight / rect.height }
  }
  function cancel() { gesture.current = null; setBox(null); clear() }
  function translate(path: InkPath, delta: Position): InkChanges {
    return new Map([[path.id, [{ id: path.id, points: path.points.map(p => projection.world(offset(projection.screen(p), delta.x, delta.y))) }]]])
  }
  return <div data-ink-surface ref={node} className={styles.ink} style={{ pointerEvents: mode === 'eraser' ? 'auto' : 'none', cursor: mode === 'eraser' ? 'crosshair' : undefined }} tabIndex={-1}
    onKeyDown={e => { if (e.key === 'Escape' && gesture.current) cancel() }}
    onPointerDown={e => {
      if (!e.isPrimary) { cancel(); return }
      if (e.button !== 0) return
      const id = (e.target as Element).closest('[data-ink]')?.getAttribute('data-ink')
      const path = mode === 'select' ? paths.find(p => p.id === id) : undefined
      if (mode === 'select' && !path) return
      e.preventDefault(); e.stopPropagation(); e.currentTarget.focus({ preventScroll: true })
      const start = point(e)
      gesture.current = { id: e.pointerId, start, path }; e.currentTarget.setPointerCapture(e.pointerId)
      if (path) select(path.id)
      else setBox(eraserBox(start, start))
    }} onPointerMove={e => {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      e.stopPropagation()
      const p = point(e)
      if (!g.path) setBox(eraserBox(g.start, p))
      else if (distance(g.start, p) >= 3) preview(translate(g.path, { x: p.x - g.start.x, y: p.y - g.start.y }))
    }} onPointerUp={e => {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      e.stopPropagation()
      const p = point(e)
      if (!g.path) {
        const changes = rectangleErase(eraserBox(g.start, p), paths, objects, projection)
        if (changes.size) { commit(changes); if (selected && changes.get(selected)?.length === 0) select(null) }
      } else if (distance(g.start, p) >= 3) {
        const delta = { x: p.x - g.start.x, y: p.y - g.start.y }
        commit(translate(g.path, delta), delta)
      }
      cancel()
    }} onLostPointerCapture={() => { if (gesture.current) cancel() }} onPointerCancel={cancel}>
    {mode === 'eraser' ? box && <svg width="100%" height="100%" className={styles.inkPaths} aria-hidden="true">
      <rect x={box.left} y={box.top} width={Math.max(1, box.right - box.left)} height={Math.max(1, box.bottom - box.top)}
        fill="var(--color-accent-red)" fillOpacity={0.18} stroke="var(--color-accent-red)" strokeDasharray="5 3" />
    </svg> :
      <svg width="100%" height="100%" className={styles.inkPaths}>{paths.map(path => {
        const pts = path.points.map(projection.screen), first = pts[0]
        if (!first) return null
        const color = selected === path.id ? 'var(--color-selection-border)' : 'transparent'
        const dot = pts.every(p => p.x === first.x && p.y === first.y)
        if (dot) return <circle key={path.id} data-ink={path.id} cx={first.x} cy={first.y} r={Math.max(4, path.width / 2)} fill="transparent" stroke={color} pointerEvents="all" />
        const points = pts.map(p => p.x + ',' + p.y).join(' ')
        return <g key={path.id} data-ink={path.id}><polyline points={points} fill="none" stroke="transparent" strokeWidth={Math.max(path.width, 8)} pointerEvents="stroke" />
          {selected === path.id && <polyline points={points} className={styles.selectedShape} pointerEvents="none" />}</g>
      })}</svg>}
  </div>
}
