import { useEffect, useRef, useState } from 'react'
import type { DrawingObjects, Position } from '@/domain/document/types'
import type { InkPath, InkChanges, InkPiece } from './inkGeometry'
import { eraseInk, sweptShapes } from './eraseInk'
import { distance, offset, direction, screenPoints, translated, turned, type Projection } from './shapeGeometry'
import { MoveHandle, RotateHandle, SelectionBox, type FlipAxis, type Turn } from './SelectionBox'
import styles from './drawing.module.css'

export function InkSurface({ mode, eraserWidth, projection, paths, objects, selected, select, selection, selectMany, preview, commit, clear, rotate, flip, onGhost }: {
  mode: 'select' | 'eraser'; eraserWidth: number; projection: Projection; paths: InkPath[]; objects: DrawingObjects; selected: string | null
  select: (id: string | null) => void; selection: string[]; selectMany: (ids: string[]) => void; preview: (changes: InkChanges) => void
  commit: (changes: InkChanges, translation?: Position) => void; clear: () => void
  /** Turns the selected stroke around a screen point, in degrees clockwise. */
  rotate?: (center: Position, deg: number) => void
  /** Mirrors the selected stroke across an axis through a screen point. */
  flip?: (axis: FlipAxis, center: Position) => void
  /** Ids being moved or turned: the module shows their old version faded. */
  onGhost?: (ids: string[]) => void
}) {
  const node = useRef<HTMLDivElement>(null)
  // The width selector sets the eraser diameter in screen pixels.
  const eraserRadius = Math.max(1, eraserWidth / 2)
  const gesture = useRef<{ id: number; start: Position; path: InkPath } | null>(null)
  // The eraser sweeps a circle: strokes lose what it passes over, figures go when it touches their line.
  const sweep = useRef<{ id: number; last: Position; pieces: Map<string, InkPiece[]>; changed: Set<string>; shapes: Set<string> } | null>(null)
  const [pointer, setPointer] = useState<Position | null>(null)
  // A stroke being moved or turned is drawn here in its new place; the module fades the old one.
  const [shift, setShift] = useState<Position | null>(null), [turning, setTurning] = useState<Turn | null>(null)
  const moving = (shift || turning) && paths.find(path => path.id === selected), ghostKey = moving ? moving.id : ''
  useEffect(() => { onGhost?.(ghostKey ? [ghostKey] : []) }, [ghostKey, onGhost])
  function point(e: React.PointerEvent) {
    const el = node.current!, rect = el.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * el.clientWidth / rect.width, y: (e.clientY - rect.top) * el.clientHeight / rect.height }
  }
  function cancel() { gesture.current = null; sweep.current = null; setShift(null); clear() }
  function erase(to: Position) {
    const s = sweep.current!, from = s.last
    s.last = to
    let touched = false
    for (const path of paths) {
      const pieces = s.pieces.get(path.id)
      if (!pieces?.length) continue
      let hit = false
      const next = pieces.flatMap(piece => {
        const parts = eraseInk(piece.points, from, to, eraserRadius + path.width / 2)
        if (!parts) return [piece]
        hit = true
        return parts.map((points, i) => ({ id: i === 0 ? piece.id : crypto.randomUUID(), points }))
      })
      if (hit) { s.pieces.set(path.id, next); s.changed.add(path.id); touched = true }
    }
    for (const id of sweptShapes(objects, from, to, eraserRadius, projection)) if (!s.shapes.has(id)) { s.shapes.add(id); touched = true }
    if (touched) preview(changes())
  }
  function changes(): InkChanges {
    const s = sweep.current!
    return new Map([...[...s.changed].map(id => [id, s.pieces.get(id)!] as const), ...[...s.shapes].map(id => [id, [] as InkPiece[]] as const)])
  }
  function translate(path: InkPath, delta: Position): InkChanges {
    return new Map([[path.id, [{ id: path.id, points: screenPoints(path, projection).map(p => offset(p, delta.x, delta.y)) }]]])
  }
  return <div data-ink-surface ref={node} className={styles.ink} style={{ pointerEvents: mode === 'eraser' ? 'auto' : 'none', cursor: mode === 'eraser' ? 'none' : undefined }} tabIndex={-1}
    onKeyDown={e => { if (e.key === 'Escape' && (gesture.current || sweep.current)) cancel() }}
    onPointerLeave={() => setPointer(null)}
    onPointerDown={e => {
      if (!e.isPrimary) { cancel(); return }
      if (e.button !== 0) return
      if (mode === 'eraser') {
        e.preventDefault(); e.stopPropagation(); e.currentTarget.focus({ preventScroll: true })
        const start = point(e)
        sweep.current = { id: e.pointerId, last: start, changed: new Set(), shapes: new Set(),
          pieces: new Map(paths.map(path => [path.id, [{ id: path.id, points: screenPoints(path, projection) }]])) }
        e.currentTarget.setPointerCapture(e.pointerId); setPointer(start); erase(start); return
      }
      const id = (e.target as Element).closest('[data-ink]')?.getAttribute('data-ink')
      const path = paths.find(p => p.id === id)
      if (!path) return
      e.preventDefault(); e.stopPropagation(); e.currentTarget.focus({ preventScroll: true })
      // Ctrl + click adds the stroke to the selection or takes it out.
      if (e.ctrlKey || e.metaKey) {
        selectMany(selection.includes(path.id) ? selection.filter(id => id !== path.id) : [...selection, path.id]); return
      }
      // Pressing the stroke only selects it; it moves from the move handle.
      if (!(e.target as Element).closest('[data-move]')) { select(path.id); return }
      const start = point(e)
      gesture.current = { id: e.pointerId, start, path }; e.currentTarget.setPointerCapture(e.pointerId)
      select(path.id)
    }} onPointerMove={e => {
      if (mode === 'eraser') {
        const p = point(e)
        setPointer(p)
        if (sweep.current?.id === e.pointerId) { e.stopPropagation(); erase(p) }
        return
      }
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      e.stopPropagation()
      const p = point(e)
      if (distance(g.start, p) >= 3) setShift({ x: p.x - g.start.x, y: p.y - g.start.y })
    }} onPointerUp={e => {
      const s = sweep.current
      if (s?.id === e.pointerId) {
        e.stopPropagation()
        const done = changes()
        if (done.size) { commit(done); if (selected && done.get(selected)?.length === 0) select(null) }
        cancel(); return
      }
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      e.stopPropagation()
      const p = point(e)
      if (distance(g.start, p) >= 3) {
        const delta = { x: p.x - g.start.x, y: p.y - g.start.y }
        commit(translate(g.path, delta), delta)
      }
      cancel()
    }} onLostPointerCapture={() => { if (gesture.current || sweep.current) cancel() }} onPointerCancel={cancel}>
    {mode === 'eraser' ? pointer && <svg width="100%" height="100%" className={styles.inkPaths} aria-hidden="true">
      <circle cx={pointer.x} cy={pointer.y} r={eraserRadius} fill="var(--color-accent-red)" fillOpacity={0.18} stroke="var(--color-accent-red)" />
    </svg> :
      <svg width="100%" height="100%" className={styles.inkPaths}>{paths.map(path => {
        const pts = screenPoints(path, projection), first = pts[0]
        if (!first) return null
        const dot = pts.every(p => p.x === first.x && p.y === first.y)
        if (dot) return <g key={path.id} data-ink={path.id}><circle cx={first.x} cy={first.y} r={Math.max(4, path.width / 2)} fill="transparent" pointerEvents="all" />
          {selected === path.id && <><SelectionBox points={pts} padding={path.width / 2 + 4} /><MoveHandle points={pts} /></>}</g>
        const points = pts.map(p => p.x + ',' + p.y).join(' ')
        return <g key={path.id} data-ink={path.id}><polyline points={points} fill="none" stroke="transparent" strokeWidth={Math.max(path.width, 8)} pointerEvents="stroke" />
          {selected === path.id && <>{!turning && <><SelectionBox points={pts} padding={path.width / 2 + 4} onFlip={shift ? undefined : flip} /><MoveHandle points={pts} /></>}
            {rotate && !shift && <RotateHandle points={pts} padding={path.width / 2 + 4} base={direction(pts, true)} onTurn={setTurning} onRotate={rotate} />}</>}</g>
      })}
      {moving && shift && <InkPreview path={translated(moving, shift, projection)} projection={projection} />}
      {moving && turning && <InkPreview path={turned(moving, turning.center, turning.angle, projection)} projection={projection} />}</svg>}
  </div>
}

// A stroke drawn in its new place while it moves or turns, with its own colour and width in screen pixels.
export function InkPreview({ path, projection }: { path: InkPath; projection: Projection }) {
  const pts = screenPoints(path, projection), first = pts[0]
  if (!first) return null
  if (pts.every(p => p.x === first.x && p.y === first.y)) return <circle cx={first.x} cy={first.y} r={path.width / 2} fill={path.color} pointerEvents="none" />
  return <polyline points={pts.map(p => p.x + ',' + p.y).join(' ')} fill="none" stroke={path.color} strokeWidth={path.width}
    strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
}
