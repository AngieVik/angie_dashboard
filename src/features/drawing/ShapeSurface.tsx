import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { SquareDashed, SquareDashedMousePointer, SquareDashedX, SquareDashedPlus, Radius, Diameter, Crosshair } from 'lucide-react'
import type { DrawingLabel, DrawingObjects, DrawingShape, Position } from '@/domain/document/types'
import { INPUT_BUDGETS } from '@/domain/input/inputBudgets'
import { corners, distance, groupVisible, handles, midpoint, offset, shapeScale, squareEnd, type Projection } from './shapeGeometry'
import styles from './drawing.module.css'

export interface ShapeSurfaceProps {
  mode: string; color: string; width: number; fixed: boolean
  objects: DrawingObjects; projection: Projection; native?: boolean
  selected: string | null; select: (id: string | null) => void
  change: (patch: DrawingObjects) => boolean
  pick?: (point: Position) => void
  ownerVisible?: (id: string) => boolean
  anchorAt?: (point: Position) => string | undefined
  warn: (message: string) => void
}
type Drag = { id: number; start: Position; initial?: DrawingShape; handle?: number; locked?: Position; horizontal?: boolean }
const hitRadius = 8
export function ShapeSurface({ mode, color, width, fixed, objects, projection, native, selected, select, change, pick, anchorAt, ownerVisible, warn }: ShapeSurfaceProps) {
  const root = useRef<SVGSVGElement>(null)
  const [vertices, setVertices] = useState<Position[]>([])
  const [hover, setHover] = useState<Position | null>(null)
  const [preview, setPreview] = useState<DrawingShape | null>(null)
  const lastPoint = useRef<Position | null>(null)
  const drag = useRef<Drag | null>(null)
  const lastTap = useRef<{ time: number; id: string; p: Position } | null>(null)
  const [label, setLabel] = useState<DrawingLabel | null>(null)
  const { screen, world } = projection
  const shapes = objects.shapes ?? [], labels = objects.labels ?? []
  const creating = mode === 'polyline' || mode === 'circle' || mode === 'label' || Boolean(pick)
  const editing = mode === 'select' || mode === 'erase-object'
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
    if (!e.isPrimary) { cancel(); return }
    if (e.button !== 0) return
    lastPoint.current = coords(e)
    const target = e.target as Element, id = target.closest('[data-shape]')?.getAttribute('data-shape')
    const initial = shapes.find(s => s.id === id), p = coords(e)
    if (!creating && !initial) return
    e.preventDefault(); e.stopPropagation(); root.current?.focus({ preventScroll: true })
    if (mode === 'erase-object' && initial) {
      change({ shapes: shapes.filter(s => s !== initial), labels: labels.filter(l => l.owner !== id),
        groups: objects.groups?.map(group => ({ ...group, members: group.members.filter(member => member !== id) })) })
      select(null); return
    }
    const index = target.closest('[data-handle]')?.getAttribute('data-handle')
    if (mode === 'select' && initial) select(initial.id)
    drag.current = { id: e.pointerId, start: p, initial: mode === 'select' ? initial : undefined, handle: index == null ? undefined : Number(index) }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function insertVertex(base: DrawingShape, p: Position) {
    if (base.kind === 'ellipse' || base.points.length >= INPUT_BUDGETS.strokePoints) return
    let best = Infinity, index = -1
    const points = base.points.map(screen)
    for (let i = 0; i < points.length - (base.kind === 'line' ? 1 : 0); i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!, dx = b.x - a.x, dy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
      const d = distance(p, offset(a, dx * t, dy * t))
      if (d < best) { best = d; index = i }
    }
    if (best > hitRadius) return
    const next = [...base.points]; next.splice(index + 1, 0, world(p))
    change({ shapes: shapes.map(s => s === base ? { ...base, kind: base.kind === 'rectangle' ? 'polygon' : base.kind, points: next } : s) })
  }
  function up(e: PointerEvent<SVGSVGElement>) {
    const current = drag.current
    if (!current || current.id !== e.pointerId) return
    e.stopPropagation(); drag.current = null; setPreview(null)
    const p = coords(e), moved = distance(current.start, p) > 4
    if (current.initial) {
      const base = current.initial
      if (!moved) {
        const last = lastTap.current
        if (last && last.id === base.id && performance.now() - last.time < 400 && distance(last.p, p) < hitRadius && current.handle === undefined) {
          insertVertex(base, p); lastTap.current = null
        } else lastTap.current = { time: performance.now(), id: base.id, p }
        return
      }
      const next = edit(current, p, e.shiftKey)!
      if (current.handle !== undefined && (base.kind === 'line' || base.kind === 'polygon') && next.points.length > (base.kind === 'line' ? 2 : 3)
        && next.points.some((q, i) => i !== current.handle && distance(screen(q), p) <= hitRadius)) next.points.splice(current.handle, 1)
      const dx = p.x - current.start.x, dy = p.y - current.start.y
      change({ shapes: shapes.map(s => s.id === base.id ? next : s),
        labels: current.handle === undefined ? labels.map(l => l.owner === base.id ? { ...l, point: world(offset(screen(l.point), dx, dy)) } : l) : labels })
      return
    }
    if (pick) { if (!moved) pick(world(p)); return }
    if (moved && !vertices.length) {
      const s = edit(current, p, e.shiftKey)
      if (s) create(s)
      return
    }
    if (moved) return
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
    if (vertices.length && distance(p, screen(vertices[0]!)) <= hitRadius) {
      if (vertices.length === 1) cancel()
      else if (vertices.length >= 3) create(shape('polygon', vertices))
      return
    }
    if (vertices.length >= 2 && distance(p, screen(vertices.at(-1)!)) <= hitRadius) { create(shape('line', vertices)); return }
    if (vertices.some(q => distance(p, screen(q)) <= hitRadius)) return
    if (vertices.length >= INPUT_BUDGETS.strokePoints) { warn('Se ha alcanzado el máximo de vértices.'); return }
    setVertices([...vertices, at]); setHover(p)
  }
  function graphic(s: DrawingShape, draft = false) {
    const points = s.points.map(screen), c = points[0]!, scale = shapeScale(s, projection)
    const show = !native || draft
    const props = { 'data-shape': s.id, stroke: show ? s.color : 'transparent', strokeWidth: Math.max(show ? .5 : hitRadius, s.width * scale),
      fill: 'transparent', pointerEvents: (editing || mode === 'label') && !draft ? (s.kind === 'line' || mode === 'erase-object' ? 'stroke' : 'all') : 'none' }
    if (s.radii) return <ellipse key={s.id} {...props} cx={c.x} cy={c.y} rx={s.radii.x * scale} ry={s.radii.y * scale} />
    const list = points.map(q => q.x + ',' + q.y).join(' ')
    return s.kind === 'line' ? <polyline key={s.id} {...props} points={list} /> : <polygon key={s.id} {...props} points={list} />
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
    if (g && p && distance(g.start, p) > 4) setPreview(edit(g, p, shift))
  }
  return <>
    <svg ref={root} tabIndex={-1} aria-label="Figuras y etiquetas" className={styles.surface} data-drawing-surface
      style={{ pointerEvents: creating ? 'auto' : 'none', cursor: Cursor && hover ? 'none' : creating ? 'crosshair' : undefined }} onPointerDown={down} onPointerUp={up}
      onPointerMove={e => { const p = coords(e), current = drag.current
        if (current?.id === e.pointerId && distance(current.start, p) > 4) setPreview(edit(current, p, e.shiftKey))
        lastPoint.current = p
        if (creating && e.pointerType !== 'touch') setHover(p)
      }} onPointerLeave={() => setHover(null)} onLostPointerCapture={() => { if (drag.current) { drag.current = null; setPreview(null) } }} onPointerCancel={cancel} onContextMenu={e => { if (creating) { e.preventDefault(); cancel() } }}
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
      {markers.map((p, i) => <g key={i} data-shape={active?.id} data-handle={i} pointerEvents={mode === 'select' ? 'all' : 'none'}>
        <rect x={p.x - hitRadius} y={p.y - hitRadius} width={hitRadius * 2} height={hitRadius * 2} fill="transparent" />
        <SquareDashed x={p.x - 6} y={p.y - 6} width={12} height={12} />
      </g>)}
      {!native && labels.filter(l => !l.owner || (groupVisible(objects, l.owner) && ownerVisible?.(l.owner) !== false)).map(l => {
        const p = screen(l.point)
        return <text key={l.id} x={p.x} y={p.y} className={styles.label} pointerEvents="none">{l.text}</text>
      })}
      {Cursor && hover && <Cursor x={hover.x - 3} y={hover.y - 3} width={20} height={20} pointerEvents="none" />}
    </svg>
    {label && <form className={styles.labelForm} onPointerDown={event => event.stopPropagation()} style={{ left: screen(label.point).x, top: screen(label.point).y }} onSubmit={event => {
      event.preventDefault()
      if (label.text.trim() && change({ labels: [...labels, { ...label, text: label.text.trim() }] })) setLabel(null)
    }}><input autoFocus aria-label="Texto de la etiqueta" value={label.text} maxLength={INPUT_BUDGETS.textCharacters}
      onChange={e => setLabel({ ...label, text: e.target.value })} onKeyDown={e => { if (e.key === 'Escape') setLabel(null) }} /></form>}
  </>
}

