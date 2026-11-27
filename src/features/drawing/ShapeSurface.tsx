import { memo, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CSSProperties, PointerEvent, SVGAttributes } from 'react'
import { SquareDashed, SquareDashedMousePointer, SquareDashedX, SquareDashedPlus, Radius, Diameter, Crosshair, Undo2, X } from 'lucide-react'
import type { DrawingLabel, DrawingObjects, DrawingShape, Position } from '@/domain/document/types'
import { INPUT_BUDGETS } from '@/domain/input/inputBudgets'
import { corners, distance, groupVisible, handles, midpoint, offset, shapeScale, squareEnd, type Projection } from './shapeGeometry'
import styles from './drawing.module.css'

export interface ShapeSurfaceProps {
  mode: string; color: string; width: number; fixed: boolean; suspended?: boolean
  objects: DrawingObjects; projection: Projection; native?: boolean
  selected: string | null; select: (id: string | null) => void
  change: (patch: DrawingObjects) => boolean
  pick?: (point: Position) => void
  ownerVisible?: (id: string) => boolean
  anchorAt?: (point: Position) => string | undefined
  warn: (message: string) => void
}
type Drag = { id: number; start: Position; started: number; tolerance: number; initial?: DrawingShape; handle?: number; locked?: Position; horizontal?: boolean }
const holdTime = 500
const hitRadius = 8
const touchHitRadius = 16
const touchDragThreshold = 10
const ShapeGraphic = memo(function ShapeGraphic({ shape: s, projection, show, hit }: {
  shape: DrawingShape; projection: Projection; show: boolean; hit: boolean
}) {
  const points = s.points.map(projection.screen), c = points[0]!, scale = shapeScale(s, projection)
  const list = points.map(q => q.x + ',' + q.y).join(' ')
  const path = (props: SVGAttributes<SVGElement>) => {
    if (s.radii) return <ellipse {...props} cx={c.x} cy={c.y} rx={s.radii.x * scale} ry={s.radii.y * scale} />
    return s.kind === 'line' ? <polyline {...props} points={list} /> : <polygon {...props} points={list} />
  }
  return <g data-shape={s.id} style={{ '--shape-hit-width': s.width * scale + 'px' } as CSSProperties}>
    {show && path({ fill: 'none', stroke: s.color, strokeWidth: Math.max(.5, s.width * scale), pointerEvents: 'none' })}
    {hit && path({ className: styles.shapeHit, fill: 'transparent', stroke: 'transparent', strokeWidth: Math.max(hitRadius, s.width * scale),
      pointerEvents: s.kind === 'line' ? 'stroke' : 'all' })}
  </g>
})

export function ShapeSurface({ mode, suspended = false, color, width, fixed, objects, projection, native, selected, select, change, pick, anchorAt, ownerVisible, warn }: ShapeSurfaceProps) {
  const root = useRef<SVGSVGElement>(null)
  const [vertices, setVertices] = useState<Position[]>([])
  const [touchInput, setTouchInput] = useState(false)
  const [hover, setHover] = useState<Position | null>(null)
  const [preview, setPreview] = useState<DrawingShape | null>(null)
  const lastPoint = useRef<Position | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(holdTimer.current), [])
  const drag = useRef<Drag | null>(null)
  const lastTap = useRef<{ time: number; id: string; p: Position } | null>(null)
  const [label, setLabel] = useState<DrawingLabel | null>(null)
  const { screen, world } = projection
  const shapes = objects.shapes ?? [], labels = objects.labels ?? []
  const creating = mode === 'polyline' || mode === 'circle' || mode === 'label' || Boolean(pick)
  const editing = mode === 'select'
  const pointTool = mode === 'polyline' || mode === 'circle'
  const hasPointDraft = pointTool && vertices.length > 0
  function coords(e: { clientX: number; clientY: number }): Position {
    const node = root.current!, rect = node.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * node.clientWidth / rect.width, y: (e.clientY - rect.top) * node.clientHeight / rect.height }
  }
  function cancel() { drag.current = null; setVertices([]); setHover(null); setPreview(null); setLabel(null) }
  function shape(kind: DrawingShape['kind'], points: Position[]): DrawingShape {
    return { id: crypto.randomUUID(), color, width, points, kind, unit: fixed ? 'screen' : 'world' }
  }
  function ellipse(c: Position, rx: number, ry: number) {
    const s = shape('ellipse', [world(c)]), scale = shapeScale(s, projection)
    return { ...s, radii: { x: Math.max(.5, rx) / scale, y: Math.max(.5, ry) / scale } }
  }
  function create(s: DrawingShape) {
    if (change({ shapes: [...shapes, s] })) { select(s.id); cancel() }
  }
  function edit(current: Drag, p: Position, shift: boolean): DrawingShape | null {
    const base = current.initial
    if (!base) {
      if (vertices.length) return null
      if (mode === 'polyline') return shape('rectangle', corners(current.start, shift ? squareEnd(current.start, p) : p).map(world))
      if (mode !== 'circle') return null
      const center = midpoint(current.start, p), radius = distance(current.start, p) / 2
      if (!shift) { delete current.locked; return ellipse(center, radius, radius) }
      if (!current.locked) {
        current.locked = p
        current.horizontal = Math.abs(p.x - current.start.x) >= Math.abs(p.y - current.start.y)
      }
      const lock = current.locked, fixedRadius = distance(current.start, lock) / 2
      const delta = current.horizontal ? p.y - lock.y : p.x - lock.x
      const other = Math.max(.5, fixedRadius + delta)
      return ellipse(midpoint(current.start, lock), current.horizontal ? fixedRadius : other, current.horizontal ? other : fixedRadius)
    }
    const index = current.handle
    const points = base.points.map(screen)
    if (index === undefined) return { ...base, points: points.map(q => world(offset(q, p.x - current.start.x, p.y - current.start.y))) }
    if (base.radii) {
      const c = points[0]!, scale = shapeScale(base, projection)
      return { ...base, radii: index < 2 ? { ...base.radii, x: Math.max(1, Math.abs(p.x - c.x)) / scale }
        : { ...base.radii, y: Math.max(1, Math.abs(p.y - c.y)) / scale } }
    }
    if (base.kind === 'rectangle') {
      const opposite = points[(index + 2) % 4]!, end = shift ? squareEnd(opposite, p) : p
      const box = corners(opposite, end)
      return { ...base, points: points.map((_, i) => world(box[(i - index + 6) % 4]!)) }
    }
    return { ...base, points: base.points.map((q, i) => i === index ? world(p) : q) }
  }
  function down(e: PointerEvent<SVGSVGElement>) {
    if (suspended || !e.isPrimary) { drag.current = null; setPreview(null); setHover(null); return }
    const touch = e.pointerType === 'touch'
    setTouchInput(touch)
    if (e.button !== 0) return
    lastPoint.current = coords(e)
    const target = e.target as Element, id = target.closest('[data-shape]')?.getAttribute('data-shape')
    const initial = shapes.find(s => s.id === id), p = coords(e)
    if (!creating && !initial) return
    if (pointTool) setHover(p)
    e.preventDefault(); e.stopPropagation(); root.current?.focus({ preventScroll: true })
    const index = target.closest('[data-handle]')?.getAttribute('data-handle')
    if (mode === 'select' && initial) select(initial.id)
    let handle = index == null ? undefined : Number(index)
    if (touch && mode === 'select' && initial?.id === selected && initial) {
      let nearest = touchHitRadius
      handles(initial, projection).forEach((vertex, i) => {
        const d = distance(p, vertex)
        if (d <= nearest) { nearest = d; handle = i }
      })
    }
    const current: Drag = { id: e.pointerId, start: p, started: performance.now(), tolerance: touch ? touchDragThreshold : 4,
      initial: mode === 'select' ? initial : undefined, handle }
    drag.current = current
    clearTimeout(holdTimer.current)
    if (pointTool && !vertices.length) {
      holdTimer.current = setTimeout(() => {
        if (drag.current === current && lastPoint.current) setPreview(edit(current, lastPoint.current, false))
      }, holdTime)
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function insertVertex(base: DrawingShape, p: Position, radius: number) {
    if (base.kind === 'ellipse' || base.points.length >= INPUT_BUDGETS.strokePoints) return
    let best = Infinity, index = -1
    const points = base.points.map(screen)
    for (let i = 0; i < points.length - (base.kind === 'line' ? 1 : 0); i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!, dx = b.x - a.x, dy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
      const d = distance(p, offset(a, dx * t, dy * t))
      if (d < best) { best = d; index = i }
    }
    if (best > radius) return
    const next = [...base.points]; next.splice(index + 1, 0, world(p))
    change({ shapes: shapes.map(s => s === base ? { ...base, kind: base.kind === 'rectangle' ? 'polygon' : base.kind, points: next } : s) })
  }
  function up(e: PointerEvent<SVGSVGElement>) {
    const current = drag.current
    if (!current || current.id !== e.pointerId || suspended) { drag.current = null; setPreview(null); setHover(null); return }
    e.stopPropagation(); drag.current = null; setPreview(null)
    const p = coords(e), moved = distance(current.start, p) > current.tolerance
    if (hasPointDraft) {
      setHover(null)
      const node = e.currentTarget
      if (p.x < 0 || p.y < 0 || p.x > node.clientWidth || p.y > node.clientHeight) return
    }
    const radius = e.pointerType === 'touch' ? touchHitRadius : hitRadius
    if (current.initial) {
      const base = current.initial
      if (!moved) {
        const last = lastTap.current
        if (last && last.id === base.id && performance.now() - last.time < 400 && distance(last.p, p) < radius && current.handle === undefined) {
          insertVertex(base, p, radius); lastTap.current = null
        } else lastTap.current = { time: performance.now(), id: base.id, p }
        return
      }
      const next = edit(current, p, e.shiftKey)!
      if (current.handle !== undefined && (base.kind === 'line' || base.kind === 'polygon') && next.points.length > (base.kind === 'line' ? 2 : 3)
        && next.points.some((q, i) => i !== current.handle && distance(screen(q), p) <= radius)) next.points.splice(current.handle, 1)
      const dx = p.x - current.start.x, dy = p.y - current.start.y
      change({ shapes: shapes.map(s => s.id === base.id ? next : s),
        labels: current.handle === undefined ? labels.map(l => l.owner === base.id ? { ...l, point: world(offset(screen(l.point), dx, dy)) } : l) : labels })
      return
    }
    if (pick) { if (!moved) pick(world(p)); return }
    if (pointTool && !vertices.length && performance.now() - current.started >= holdTime) {
      if (moved) { const s = edit(current, p, e.shiftKey); if (s) create(s) }
      setHover(null); return
    }
    if (moved && !pointTool) return
    const at = world(p)
    if (mode === 'label') {
      const target = document.elementFromPoint(e.clientX, e.clientY)
      const owner = target?.closest('[data-shape]')?.getAttribute('data-shape') ?? anchorAt?.(at)
      setLabel({ id: crypto.randomUUID(), text: '', point: at, owner }); return
    }
    if (mode === 'circle' && vertices.length) {
      const c = screen(vertices[0]!), radius = distance(c, p)
      if (radius > 0) create(ellipse(c, radius, radius))
      return
    }
    if (vertices.length) {
      const firstDistance = distance(p, screen(vertices[0]!))
      const lastDistance = distance(p, screen(vertices.at(-1)!))
      if (vertices.length === 1 && firstDistance <= radius) { cancel(); return }
      if (vertices.length >= 3 && firstDistance <= radius && firstDistance <= lastDistance) {
        create(shape('polygon', vertices)); return
      }
      if (vertices.length >= 2 && lastDistance <= radius) { create(shape('line', vertices)); return }
    }
    if (vertices.some(q => distance(p, screen(q)) <= radius)) return
    if (vertices.length >= INPUT_BUDGETS.strokePoints) { warn('Se ha alcanzado el máximo de vértices.'); return }
    setVertices([...vertices, at]); setHover(e.pointerType === 'touch' ? null : p)
  }
  function graphic(s: DrawingShape, draft = false) {
    return <ShapeGraphic key={s.id} shape={s} projection={projection} show={!native || draft}
      hit={(editing || mode === 'label') && !draft} />
  }
  const active = preview ?? shapes.find(s => s.id === selected && groupVisible(objects, s.id))
  const markers = mode === 'select' && active ? handles(active, projection) : vertices.map(screen)
  const provisional = vertices.length && hover && mode === 'circle' ? ellipse(screen(vertices[0]!), distance(screen(vertices[0]!), hover), distance(screen(vertices[0]!), hover)) : null
  const overFirst = vertices.length > 0 && hover && distance(screen(vertices[0]!), hover) <= hitRadius
  const overLast = vertices.length > 1 && hover && distance(screen(vertices.at(-1)!), hover) <= hitRadius
  const Cursor = mode === 'polyline' ? (overFirst && vertices.length === 1 ? SquareDashedX : overLast || overFirst && vertices.length > 2 ? SquareDashedPlus : SquareDashedMousePointer)
    : mode === 'circle' && preview ? Diameter : mode === 'circle' && vertices.length ? Radius : mode === 'place' ? Crosshair : null
  function shiftPreview(shift: boolean) {
    const g = drag.current, p = lastPoint.current
    if (g && p && distance(g.start, p) > g.tolerance && (g.initial || performance.now() - g.started >= holdTime)) setPreview(edit(g, p, shift))
  }
  return <>
    <svg ref={root} tabIndex={-1} aria-label="Figuras y etiquetas" className={styles.surface} data-drawing-surface
      style={{ visibility: suspended ? 'hidden' : undefined, pointerEvents: creating ? 'auto' : 'none', cursor: Cursor && hover ? 'none' : creating ? 'crosshair' : undefined }} onPointerDown={down} onPointerUp={up}
      onPointerMove={e => { const p = coords(e), current = drag.current
        if (current?.id === e.pointerId) {
          if (hasPointDraft) setHover(p)
          else if ((current.initial || performance.now() - current.started >= holdTime) && distance(current.start, p) > current.tolerance) setPreview(edit(current, p, e.shiftKey))
        }
        lastPoint.current = p
        if (creating && e.pointerType !== 'touch') {
          if (touchInput) setTouchInput(false)
          setHover(p)
        }
      }} onPointerLeave={() => setHover(null)} onLostPointerCapture={e => {
        if (drag.current?.id === e.pointerId) { drag.current = null; setPreview(null); setHover(null) }
      }} onPointerCancel={() => { drag.current = null; setPreview(null); setHover(null) }} onContextMenu={e => { if (creating) { e.preventDefault(); if (!touchInput) cancel() } }}
      onKeyDown={e => {
        if (e.key === 'Shift') shiftPreview(true)
        if (e.key === 'Escape') { e.stopPropagation(); cancel() }
        if (e.key === 'Enter' && vertices.length >= 2) { e.preventDefault(); create(shape('line', vertices)) }
      }} onKeyUp={e => { if (e.key === 'Shift') shiftPreview(false) }}>
      {shapes.filter(s => groupVisible(objects, s.id) && s.id !== preview?.id).map(s => graphic(s))}
      {preview && graphic(preview, true)}
      {provisional && graphic(provisional, true)}
      {mode === 'polyline' && vertices.length > 0 && <polyline points={[...vertices.map(screen), ...(hover ? [hover] : [])].map(p => p.x + ',' + p.y).join(' ')}
        fill="none" stroke={color} strokeWidth={width * (fixed ? 1 : projection.pixelsPerUnit(vertices[0]!))} />}
      {mode === 'select' && active && <g className={styles.selectedShape} pointerEvents="none">
        {active.radii ? <ellipse cx={screen(active.points[0]!).x} cy={screen(active.points[0]!).y}
          rx={active.radii.x * shapeScale(active, projection)} ry={active.radii.y * shapeScale(active, projection)} /> :
          active.kind === 'line' ? <polyline points={active.points.map(screen).map(p => p.x + ',' + p.y).join(' ')} /> :
            <polygon points={active.points.map(screen).map(p => p.x + ',' + p.y).join(' ')} />}
      </g>}
      {markers.map((p, i) => <g key={i} data-shape={active?.id} data-handle={i} pointerEvents={mode === 'select' ? 'all' : 'none'}>
        {pointTool && <circle cx={p.x} cy={p.y} r={5} fill={color} stroke="white" strokeWidth={2} className={styles.anchorDot} />}
        <rect className={styles.vertexTarget} x={p.x - hitRadius} y={p.y - hitRadius} width={hitRadius * 2} height={hitRadius * 2} fill="transparent" />
        <SquareDashed x={p.x - 6} y={p.y - 6} width={12} height={12} />
      </g>)}
      {!native && labels.filter(l => !l.owner || (groupVisible(objects, l.owner) && ownerVisible?.(l.owner) !== false)).map(l => {
        const p = screen(l.point)
        return <text key={l.id} x={p.x} y={p.y} className={styles.label} data-selected={selected === l.id}
          pointerEvents={editing ? 'bounding-box' : 'none'} onPointerDown={e => {
            if (editing && e.button === 0) { e.stopPropagation(); select(l.id) }
          }}>{l.text}</text>
      })}
      {hasPointDraft && hover && <circle cx={hover.x} cy={hover.y} r={4} fill={color} stroke="white" strokeWidth={2} className={styles.anchorDot} pointerEvents="none" />}
      {Cursor && hover && !touchInput && <Cursor x={hover.x - 3} y={hover.y - 3} width={20} height={20} pointerEvents="none" />}
    </svg>
    {!suspended && mode === 'polyline' && touchInput && vertices.length > 0 && <div className={styles.draftActions} role="group" aria-label="Polilínea en curso"
      onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
      <Button aria-label="Quitar último vértice" title="Quitar último vértice" onClick={() => { setVertices(vertices.slice(0, -1)); setHover(null) }}><Undo2 /></Button>
      <Button disabled={vertices.length < 2} onClick={() => create(shape('line', vertices))}>Terminar línea</Button>
      <Button disabled={vertices.length < 3} onClick={() => create(shape('polygon', vertices))}>Cerrar polígono</Button>
      <Button aria-label="Cancelar polilínea" title="Cancelar polilínea" onClick={cancel}><X /></Button>
    </div>}
    {!suspended && label && <form className={styles.labelForm} onPointerDown={event => event.stopPropagation()} style={{ left: screen(label.point).x, top: screen(label.point).y }} onSubmit={event => {
      event.preventDefault()
      if (label.text.trim() && change({ labels: [...labels, { ...label, text: label.text.trim() }] })) setLabel(null)
    }}><Input autoFocus aria-label="Texto de la etiqueta" value={label.text} maxLength={INPUT_BUDGETS.textCharacters}
      onChange={e => setLabel({ ...label, text: e.target.value })} onKeyDown={e => { if (e.key === 'Escape') setLabel(null) }} /></form>}
  </>
}

