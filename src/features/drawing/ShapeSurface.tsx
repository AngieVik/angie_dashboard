import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CSSProperties, PointerEvent, SVGAttributes } from 'react'
import { SquareDashedMousePointer, SquareDashedX, SquareDashedPlus, Radius, Diameter, Crosshair, Undo2, X } from 'lucide-react'
import type { DrawingLabel, DrawingObjects, DrawingShape, Position } from '@/domain/document/types'
import { INPUT_BUDGETS } from '@/domain/input/inputBudgets'
import { anchorPoints, corners, distance, groupVisible, handles, midpoint, offset, placePoints, screenPoints, shapeScale, squareEnd, turn, ellipseRing, angleSnap, direction, squared, translated, turned, turnedShape, type Projection } from './shapeGeometry'
import { MoveHandle, RotateHandle, SelectionBox, type FlipAxis, type Turn } from './SelectionBox'
import { InkPreview } from './InkSurface'
import type { InkPath } from './inkGeometry'
import { eraserBox, rectangleHits } from './rectangleErase'
import { keepTouching, touchedOwner, type Box } from './labelPlacement'
import styles from './drawing.module.css'

export interface ShapeSurfaceProps {
  mode: string; color: string; width: number; fixed: boolean; suspended?: boolean
  objects: DrawingObjects; projection: Projection; native?: boolean
  selected: string | null; select: (id: string | null) => void
  selection: string[]; selectMany: (ids: string[]) => void; ink?: InkPath[]
  /** Moves every selected figure and stroke by a screen offset. */
  moveSelection?: (delta: Position) => void
  /** Turns the selection around a screen point, in degrees clockwise. */
  rotateSelection?: (center: Position, deg: number) => void
  /** Mirrors the selection across an axis through a screen point. */
  flipSelection?: (axis: FlipAxis, center: Position) => void
  /** Ids being moved, turned or edited: the module shows their old version faded. */
  onGhost?: (ids: string[]) => void
  change: (patch: DrawingObjects) => boolean
  /** Receives the clicked point in the world and on screen. */
  pick?: (point: Position, screen: Position) => void
  /** A label was just created: the module shows its options. */
  onLabel?: (id: string) => void
  ownerVisible?: (id: string) => boolean
  anchorAt?: (point: Position) => string | undefined
  warn: (message: string) => void
}
type Drag = { id: number; start: Position; started: number; tolerance: number; initial?: DrawingShape; handle?: number; still?: boolean; locked?: Position; horizontal?: boolean }
const holdTime = 500
const hitRadius = 8
const touchHitRadius = 16
const touchDragThreshold = 10
// Where a press on the selection tool is not on empty space.
const occupied = '[data-shape],[data-ink],[data-move],[data-rotate],[data-flip],[data-handle],.board-pin,.quick-note,.plan-pin,[data-drawing-image],[data-image-action],' +
  '[data-drawing-label],.board-image-editor,.leaflet-control,button,input,textarea,select,a,form,[role="slider"]'
const ShapeGraphic = memo(function ShapeGraphic({ shape: s, projection, show, hit, ghost = false }: {
  shape: DrawingShape; projection: Projection; show: boolean; hit: boolean; ghost?: boolean
}) {
  const points = screenPoints(s, projection), c = points[0]!, scale = shapeScale(s, projection)
  const list = points.map(q => q.x + ',' + q.y).join(' ')
  const path = (props: SVGAttributes<SVGElement>) => {
    if (s.radii) return <ellipse {...props} cx={c.x} cy={c.y} rx={s.radii.x * scale} ry={s.radii.y * scale} transform={s.rotation ? `rotate(${s.rotation} ${c.x} ${c.y})` : undefined} />
    return s.kind === 'line' ? <polyline {...props} points={list} /> : <polygon {...props} points={list} />
  }
  return <g data-shape={s.id} className={ghost ? styles.ghost : undefined} style={{ '--shape-hit-width': s.width + 'px' } as CSSProperties}>
    {show && path({ fill: 'none', stroke: s.color, strokeWidth: Math.max(.5, s.width), pointerEvents: 'none' })}
    {hit && path({ className: styles.shapeHit, fill: 'transparent', stroke: 'transparent', strokeWidth: Math.max(hitRadius, s.width),
      pointerEvents: 'stroke' })}
  </g>
})

function box(points: Position[]) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const center = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
  return { center, half: { x: (Math.max(...xs) - Math.min(...xs)) / 2, y: (Math.max(...ys) - Math.min(...ys)) / 2 } }
}

function LabelText({ label: l, at, selected, ghost = false, ...props }: { label: DrawingLabel; at: Position; selected: boolean; ghost?: boolean } & SVGAttributes<SVGTextElement> & { 'data-drawing-label'?: string }) {
  const filter = 'label-background-' + l.id + (ghost ? '-ghost' : '')
  return <>{l.background && <filter id={filter} x="-0.1" y="-0.15" width="1.2" height="1.3">
    <feFlood floodColor={l.background} /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>}
    <text {...props} x={at.x} y={at.y} className={styles.label} data-selected={selected} data-background={l.background ? '' : undefined}
      filter={l.background ? `url(#${filter})` : undefined} style={{ fill: l.color, fontSize: l.size && l.size + 'px' }}>{l.text}</text></>
}

export function ShapeSurface({ mode: tool, suspended = false, color, width, fixed, objects, projection, native, selected, select, selection, selectMany, ink = [], moveSelection, rotateSelection, flipSelection, onGhost, change, pick, onLabel, anchorAt, ownerVisible, warn }: ShapeSurfaceProps) {
  const root = useRef<SVGSVGElement>(null)
  const [vertices, setVertices] = useState<Position[]>([])
  const [touchInput, setTouchInput] = useState(false)
  const [hover, setHover] = useState<Position | null>(null)
  // Magnet: the vertex a dragged point is pulled to, shown with a ring.
  const [snap, setSnap] = useState<Position | null>(null)
  const [preview, setPreview] = useState<DrawingShape | null>(null)
  const lastPoint = useRef<Position | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(holdTimer.current), [])
  const drag = useRef<Drag | null>(null)
  const lastTap = useRef<{ time: number; id: string; p: Position; handle?: number } | null>(null)
  // An open figure being continued from one of its ends works like a polyline in progress.
  const [continuing, setContinuing] = useState<DrawingShape | null>(null)
  const mode = continuing ? 'polyline' : tool
  const { screen, world } = projection
  const shapes = objects.shapes ?? [], labels = objects.labels ?? []
  const creating = mode === 'polyline' || mode === 'circle' || mode === 'label' || Boolean(pick)
  const editing = mode === 'select'
  const pointTool = mode === 'polyline' || mode === 'circle'
  const hasPointDraft = pointTool && vertices.length > 0
  const selectedShape = shapes.find(s => s.id === selected && groupVisible(objects, s.id))
  // A polyline or circle just drawn stays editable until the first click outside it.
  const held = pointTool && !vertices.length && Boolean(selectedShape)
  const shapeEditing = editing || held
  const [marquee, setMarquee] = useState<ReturnType<typeof eraserBox> | null>(null)
  const groupDrag = useRef<{ id: number; start: Position } | null>(null)
  const [groupShift, setGroupShift] = useState<Position | null>(null)
  const [turning, setTurning] = useState<Turn | null>(null)
  const latest = useRef({ objects, ink, projection, selection, select, selectMany, change, anchorAt })
  useLayoutEffect(() => { latest.current = { objects, ink, projection, selection, select, selectMany, change, anchorAt } })
  const [labelDrag, setLabelDrag] = useState<{ label: DrawingLabel; at: Position; ring: Position | null } | null>(null)
  // With the selection tool, dragging on empty space draws a box that selects what its edge
  // or inside touches by the line; Ctrl adds to the selection. A click on empty space deselects.
  useEffect(() => {
    const area = root.current?.parentElement
    if (!editing || suspended || !area) return
    let box: { id: number; start: Position; additive: boolean; moved: boolean } | null = null
    function point(e: globalThis.PointerEvent) { return coords(e) }
    function down(e: globalThis.PointerEvent) {
      const target = e.target as Element
      if (!e.isPrimary || e.button !== 0 || target.closest(occupied) || root.current!.contains(target)) return
      e.preventDefault(); e.stopPropagation(); root.current!.focus({ preventScroll: true })
      box = { id: e.pointerId, start: point(e), additive: e.ctrlKey || e.metaKey, moved: false }
      window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', stop, true)
    }
    function move(e: globalThis.PointerEvent) {
      if (!box || e.pointerId !== box.id) return
      const p = point(e)
      if (!box.moved && distance(box.start, p) <= 4) return
      box.moved = true; setMarquee(eraserBox(box.start, p))
    }
    function up(e: globalThis.PointerEvent) {
      if (!box || e.pointerId !== box.id) return
      const current = box, { objects, ink, projection, selection, select, selectMany } = latest.current
      stop()
      if (current.moved) {
        const ids = rectangleHits(eraserBox(current.start, point(e)), ink, objects, projection)
        selectMany(current.additive ? [...selection, ...ids] : ids)
        // The map would take the closing click as a click on empty space.
        window.addEventListener('click', swallow, true)
        setTimeout(() => window.removeEventListener('click', swallow, true))
      } else if (!current.additive) select(null)
    }
    function swallow(e: MouseEvent) { e.stopPropagation() }
    function stop() {
      box = null; setMarquee(null)
      window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', stop, true)
    }
    area.addEventListener('pointerdown', down, true)
    return () => { area.removeEventListener('pointerdown', down, true); stop() }
  }, [editing, suspended])
  // With the selection tool a label is dragged. A loose label sticks to the figure or stroke its box touches
  // when dropped (or to a pin under it). A stuck label moves around its owner but keeps touching it;
  // only «Soltar de la figura» frees it.
  useEffect(() => {
    const area = root.current?.parentElement
    if (!editing || suspended || !area) return
    let drag: { id: number; label: DrawingLabel; start: Position; node: HTMLElement | SVGElement; moved: boolean; box: Box } | null = null
    // Where the label goes for this pointer position, and what it sticks to.
    function place(current: NonNullable<typeof drag>, p: Position) {
      const { objects, ink, projection, anchorAt } = latest.current
      let at = offset(projection.screen(current.label.point), p.x - current.start.x, p.y - current.start.y)
      const box = (a: Position) => ({ left: a.x + current.box.left, right: a.x + current.box.right, top: a.y + current.box.top, bottom: a.y + current.box.bottom })
      const owner = current.label.owner
      if (owner) {
        const kept = keepTouching(owner, box(at), objects, ink, projection)
        if (kept) at = offset(at, kept.shift.x, kept.shift.y)
        return { at, owner, ring: kept?.point ?? null }
      }
      const touched = touchedOwner(box(at), objects, ink, projection), b = box(at)
      return { at, owner: touched?.id ?? anchorAt?.(projection.world({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 })), ring: touched?.point ?? null }
    }
    function down(e: globalThis.PointerEvent) {
      // On the Plano the figures' layer lies above the labels, so look under the pointer.
      const node = document.elementsFromPoint(e.clientX, e.clientY).map(el => el.closest<HTMLElement | SVGElement>('[data-drawing-label]')).find(Boolean)
      const label = node && latest.current.objects.labels?.find(l => l.id === node.dataset.drawingLabel)
      if (!e.isPrimary || e.button !== 0 || !node || !label) return
      e.preventDefault(); e.stopPropagation(); root.current!.focus({ preventScroll: true })
      latest.current.select(label.id)
      // The label's box, relative to its point.
      const rect = node.getBoundingClientRect(), a = latest.current.projection.screen(label.point)
      const corner = coords({ clientX: rect.left, clientY: rect.top }), end = coords({ clientX: rect.right, clientY: rect.bottom })
      drag = { id: e.pointerId, label, start: coords(e), node, moved: false,
        box: { left: corner.x - a.x, top: corner.y - a.y, right: end.x - a.x, bottom: end.y - a.y } }
      window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', stop, true)
    }
    function move(e: globalThis.PointerEvent) {
      if (!drag || e.pointerId !== drag.id) return
      const p = coords(e)
      if (!drag.moved && distance(drag.start, p) <= 4) return
      drag.moved = true; drag.node.style.opacity = '0.35'
      const { at, ring } = place(drag, p)
      setLabelDrag({ label: drag.label, at, ring })
    }
    function up(e: globalThis.PointerEvent) {
      if (!drag || e.pointerId !== drag.id) return
      const current = drag, p = coords(e)
      stop()
      if (!current.moved) return
      const { objects, projection, change } = latest.current, { at, owner } = place(current, p)
      const point = projection.world(at)
      change({ labels: objects.labels?.map(l => l.id === current.label.id ? { ...l, point, owner } : l) })
      // The map would take the closing click as a click on empty space.
      window.addEventListener('click', swallow, true)
      setTimeout(() => window.removeEventListener('click', swallow, true))
    }
    function swallow(e: MouseEvent) { e.stopPropagation() }
    function stop() {
      if (drag) drag.node.style.opacity = ''
      drag = null; setLabelDrag(null)
      window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', stop, true)
    }
    area.addEventListener('pointerdown', down, true)
    return () => { area.removeEventListener('pointerdown', down, true); stop() }
  }, [editing, suspended])
  function coords(e: { clientX: number; clientY: number }): Position {
    const node = root.current!, rect = node.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * node.clientWidth / rect.width, y: (e.clientY - rect.top) * node.clientHeight / rect.height }
  }
  function cancel() { drag.current = null; setVertices([]); setHover(null); setPreview(null); setContinuing(null); setSnap(null) }
  // Points in screen pixels; in «px» lines and polygons keep an anchor and pixel offsets.
  function shape(kind: DrawingShape['kind'], points: Position[]): DrawingShape {
    const base = { id: crypto.randomUUID(), color, width, kind }
    return fixed && kind !== 'ellipse' ? { ...base, unit: 'screen', ...anchorPoints(points, projection) }
      : { ...base, unit: fixed ? 'screen' : 'world', points: points.map(world) }
  }
  function ellipse(c: Position, rx: number, ry: number) {
    const s = shape('ellipse', [c]), scale = shapeScale(s, projection)
    return { ...s, radii: { x: Math.max(.5, rx) / scale, y: Math.max(.5, ry) / scale } }
  }
  function create(s: DrawingShape) {
    if (change({ shapes: [...shapes, s] })) { select(s.id); cancel() }
  }
  function finish(kind: DrawingShape['kind']) {
    const points = vertices.map(screen), base = continuing
    if (!base) { create(squared(shape(kind, points), projection)); return }
    const next = squared(placePoints({ ...base, kind }, points, projection), projection)
    if (change({ shapes: shapes.map(s => s.id === base.id ? next : s) })) { select(base.id); cancel() }
  }
  // A turned ellipse reaches beyond its handles.
  function extent(shape: DrawingShape) { return shape.radii && shape.rotation ? ellipseRing(shape, projection, 24) : undefined }
  // A rectangle is edited from the middle of its sides, on the axes.
  function editHandles(shape: DrawingShape) {
    if (shape.kind !== 'rectangle') return handles(shape, projection)
    const { center: c, half } = box(screenPoints(shape, projection))
    return [offset(c, -half.x, 0), offset(c, half.x, 0), offset(c, 0, -half.y), offset(c, 0, half.y)]
  }
  // Double click on a vertex: an end of an open figure continues it; a vertex of a closed figure opens it there.
  function vertexAction(base: DrawingShape, index: number) {
    if (base.radii || base.kind === 'rectangle') return
    const points = screenPoints(base, projection), n = points.length
    if (base.kind === 'line') {
      if (index !== 0 && index !== n - 1) return
      setContinuing(base); setVertices((index === 0 ? [...points].reverse() : points).map(world)); return
    }
    const ring = [...points.slice(index), ...points.slice(0, index)], at = ring[0]!
    const gap = (to: Position) => { const d = distance(at, to); return d ? Math.min(8, d / 2) / d : 0 }
    const toward = (to: Position) => { const k = gap(to); return offset(at, (to.x - at.x) * k, (to.y - at.y) * k) }
    const next = placePoints({ ...base, kind: 'line' as const }, [toward(ring[1]!), ...ring.slice(1), toward(ring[n - 1]!)], projection)
    change({ shapes: shapes.map(s => s.id === base.id ? next : s) })
  }
  // Points a dragged vertex can join: its neighbours, and the other end of an open figure, which closes it.
  function joinTargets(base: DrawingShape, h: number) {
    const points = screenPoints(base, projection), n = points.length
    if (base.kind !== 'line' && base.kind !== 'polygon') return { close: undefined, neighbours: [] }
    const near = base.kind === 'polygon' ? [(h + n - 1) % n, (h + 1) % n] : [h - 1, h + 1].filter(i => i >= 0 && i < n)
    return { close: base.kind === 'line' && n >= 4 && (h === 0 || h === n - 1) ? points[h === 0 ? n - 1 : 0] : undefined,
      neighbours: n > (base.kind === 'line' ? 2 : 3) ? near.map(i => points[i]!) : [] }
  }
  function magnet(current: Drag, p: Position, radius: number) {
    if (!current.initial || current.handle === undefined || current.initial.radii) return null
    const { close, neighbours } = joinTargets(current.initial, current.handle)
    return [close, ...neighbours].find(q => q && distance(q, p) <= radius) ?? null
  }
  // While drawing, the pointer is pulled to the first vertex (to close) and to the last one (to finish).
  function drawMagnet(p: Position) {
    if (mode !== 'polyline' || vertices.length < 2) return null
    const first = screen(vertices[0]!), last = screen(vertices.at(-1)!)
    if (vertices.length >= 3 && distance(first, p) <= hitRadius) return first
    return distance(last, p) <= hitRadius ? last : null
  }
  // Shift while drawing: the new side goes in steps of 30° from the screen axes and, when it runs along an axis,
  // lines up with the first vertex nearby, so a closed figure can come out square.
  function sideSnap(p: Position) {
    const last = screen(vertices.at(-1)!), first = screen(vertices[0]!), q = angleSnap(last, p)
    if (vertices.length < 2) return q
    if (Math.abs(q.y - last.y) < .5 && Math.abs(q.x - first.x) <= hitRadius) return { x: first.x, y: q.y }
    if (Math.abs(q.x - last.x) < .5 && Math.abs(q.y - first.y) <= hitRadius) return { x: q.x, y: first.y }
    return q
  }
  function edit(current: Drag, p: Position, shift: boolean): DrawingShape | null {
    const base = current.initial
    if (!base) {
      if (vertices.length) return null
      if (mode === 'polyline') return shape('rectangle', corners(current.start, shift ? squareEnd(current.start, p) : p))
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
    const points = screenPoints(base, projection)
    if (index === undefined) return placePoints(base, points.map(q => offset(q, p.x - current.start.x, p.y - current.start.y)), projection)
    if (base.radii) {
      // Shift keeps a perfect circle: both radii take the dragged one.
      // A turned ellipse measures the pointer along its own axes.
      const c = points[0]!, scale = shapeScale(base, projection), q = turn(p, c, -(base.rotation ?? 0))
      const size = Math.max(1, Math.abs(index < 2 ? q.x - c.x : q.y - c.y)) / scale
      return { ...base, radii: shift ? { x: size, y: size } : index < 2 ? { ...base.radii, x: size } : { ...base.radii, y: size } }
    }
    // A rectangle grows from its centre on the axis of the handle, like the circle.
    if (base.kind === 'rectangle') {
      const { center: c, half } = box(points)
      const size = Math.max(1, Math.abs(index < 2 ? p.x - c.x : p.y - c.y))
      const next = shift ? { x: size, y: size } : index < 2 ? { ...half, x: size } : { ...half, y: size }
      return placePoints(base, points.map(q => offset(c, Math.sign(q.x - c.x) * next.x, Math.sign(q.y - c.y) * next.y)), projection)
    }
    // Shift keeps the side to the previous vertex in steps of 30° from the screen axes.
    const from = points[index === 0 ? (base.kind === 'polygon' ? points.length - 1 : 1) : index - 1]
    const at = shift && from ? angleSnap(from, p) : p
    return placePoints(base, points.map((q, i) => i === index ? at : q), projection)
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
    e.preventDefault(); e.stopPropagation(); root.current?.focus({ preventScroll: true })
    if (held && !initial) { select(null); return }
    // Ctrl + click on a line adds the figure to the selection or takes it out.
    if (editing && initial && (e.ctrlKey || e.metaKey) && !target.closest('[data-handle],[data-move]')) {
      selectMany(selection.includes(initial.id) ? selection.filter(id => id !== initial.id) : [...selection, initial.id]); return
    }
    if (pointTool && !held) setHover(p)
    const index = target.closest('[data-handle]')?.getAttribute('data-handle')
    if (shapeEditing && initial) select(initial.id)
    let handle = index == null ? undefined : Number(index)
    if (touch && shapeEditing && initial?.id === selected && initial) {
      let nearest = touchHitRadius
      editHandles(initial).forEach((vertex, i) => {
        const d = distance(p, vertex)
        if (d <= nearest) { nearest = d; handle = i }
      })
    }
    const current: Drag = { id: e.pointerId, start: p, started: performance.now(), tolerance: touch ? touchDragThreshold : 4,
      initial: shapeEditing ? initial : undefined, handle,
      // Pressing the line only selects; the figure moves from the move handle and changes from its handles.
      still: shapeEditing && handle === undefined && !target.closest('[data-move]') }
    drag.current = current
    clearTimeout(holdTimer.current)
    if (pointTool && !vertices.length && !current.initial) {
      holdTimer.current = setTimeout(() => {
        if (drag.current === current && lastPoint.current) setPreview(edit(current, lastPoint.current, false))
      }, holdTime)
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function insertVertex(base: DrawingShape, p: Position, radius: number) {
    if (base.kind === 'ellipse' || base.points.length >= INPUT_BUDGETS.strokePoints) return
    let best = Infinity, index = -1
    const points = screenPoints(base, projection)
    for (let i = 0; i < points.length - (base.kind === 'line' ? 1 : 0); i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!, dx = b.x - a.x, dy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
      const d = distance(p, offset(a, dx * t, dy * t))
      if (d < best) { best = d; index = i }
    }
    if (best > radius) return
    points.splice(index + 1, 0, p)
    const next = placePoints({ ...base, kind: base.kind === 'rectangle' ? 'polygon' : base.kind }, points, projection)
    change({ shapes: shapes.map(s => s === base ? next : s) })
  }
  function up(e: PointerEvent<SVGSVGElement>) {
    const current = drag.current
    if (!current || current.id !== e.pointerId || suspended) { drag.current = null; setPreview(null); setHover(null); return }
    e.stopPropagation(); drag.current = null; setPreview(null); setSnap(null)
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
        if (last && last.id === base.id && performance.now() - last.time < 400 && distance(last.p, p) < radius && last.handle === current.handle) {
          if (current.still) insertVertex(base, p, radius)
          else if (current.handle !== undefined) vertexAction(base, current.handle)
          lastTap.current = null
        } else lastTap.current = { time: performance.now(), id: base.id, p, handle: current.handle }
        return
      }
      if (current.still) return
      let next = edit(current, magnet(current, p, radius) ?? p, e.shiftKey)!
      const points = screenPoints(next, projection), h = current.handle
      if (h !== undefined) {
        // Dropping a vertex on a neighbour joins them; dropping one end of an open figure on the other end closes it.
        const { close, neighbours } = joinTargets(base, h)
        if (close && distance(close, p) <= radius) { points.splice(h, 1); next = placePoints({ ...next, kind: 'polygon' as const }, points, projection) }
        else if (neighbours.some(q => distance(q, p) <= radius)) { points.splice(h, 1); next = placePoints(next, points, projection) }
      }
      next = squared(next, projection)
      const dx = p.x - current.start.x, dy = p.y - current.start.y
      change({ shapes: shapes.map(s => s.id === base.id ? next : s),
        labels: current.handle === undefined ? labels.map(l => l.owner === base.id ? { ...l, point: world(offset(screen(l.point), dx, dy)) } : l) : labels })
      return
    }
    if (pick) { if (!moved) pick(world(p), p); return }
    if (pointTool && !vertices.length && performance.now() - current.started >= holdTime) {
      if (moved) { const s = edit(current, p, e.shiftKey); if (s) create(s) }
      setHover(null); return
    }
    if (moved && !pointTool) return
    const at = world(p)
    if (mode === 'label') {
      const target = document.elementFromPoint(e.clientX, e.clientY)
      const owner = target?.closest('[data-shape]')?.getAttribute('data-shape') ?? anchorAt?.(at)
      const id = crypto.randomUUID()
      if (change({ labels: [...labels, { id, text: 'Etiqueta', point: at, owner }] })) { select(id); onLabel?.(id) }
      return
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
        finish('polygon'); return
      }
      if (vertices.length >= 2 && lastDistance <= radius) { finish('line'); return }
    }
    // Shift keeps the new side in steps of 30° from the screen axes.
    const q = e.shiftKey && mode === 'polyline' && vertices.length ? sideSnap(p) : p
    if (vertices.some(v => distance(q, screen(v)) <= radius)) return
    if (vertices.length >= INPUT_BUDGETS.strokePoints) { warn('Se ha alcanzado el máximo de vértices.'); return }
    setVertices([...vertices, world(q)]); setHover(e.pointerType === 'touch' ? null : q)
  }
  function graphic(s: DrawingShape, draft = false) {
    return <ShapeGraphic key={(draft ? 'draft-' : '') + s.id} shape={s} projection={projection} show={!native || draft}
      hit={(shapeEditing || mode === 'label') && !draft} ghost={!draft && ghost.has(s.id)} />
  }
  const active = preview ?? selectedShape
  // Several selected figures and strokes share one mark, as if they were one.
  const group = editing && selection.length > 1 ? [
    ...shapes.filter(s => selection.includes(s.id) && groupVisible(objects, s.id))
      .map(s => ({ id: s.id, points: handles(s, projection), width: s.width, closed: s.kind !== 'line', ellipse: Boolean(s.radii), extent: extent(s) })),
    ...ink.filter(path => selection.includes(path.id))
      .map(path => ({ id: path.id, points: screenPoints(path, projection), width: path.width, closed: false, ellipse: false, extent: undefined })),
  ] : []
  // While the group moves, its mark and the outline of each object follow the pointer.
  const shift = (p: Position) => groupShift ? offset(p, groupShift.x, groupShift.y) : p
  const groupPoints = group.flatMap(item => (item.extent ?? item.points).map(shift))
  // The objects being moved, turned or edited: their old version stays faded under the new one.
  const turnIds = turning ? (group.length ? group.map(item => item.id) : active ? [active.id] : []) : []
  const ghostIds = preview && shapes.some(s => s.id === preview.id) ? [preview.id] : groupShift ? group.map(item => item.id) : turnIds
  const ghost = new Set(ghostIds), ghostKey = ghostIds.join()
  useEffect(() => { onGhost?.(ghostKey ? ghostKey.split(',') : []) }, [ghostKey, onGhost])
  function previews(shape: (s: DrawingShape) => DrawingShape, path: (p: InkPath) => InkPath) {
    return <>{shapes.filter(s => ghost.has(s.id)).map(s => graphic(shape(s), true))}
      {ink.filter(p => ghost.has(p.id)).map(p => <InkPreview key={'draft-' + p.id} path={path(p)} projection={projection} />)}</>
  }
  function endGroupDrag(e: PointerEvent<SVGGElement>, commit: boolean) {
    const g = groupDrag.current
    if (!g || g.id !== e.pointerId) return
    e.stopPropagation(); groupDrag.current = null; setGroupShift(null)
    const p = coords(e)
    if (commit && distance(g.start, p) >= 3) moveSelection?.({ x: p.x - g.start.x, y: p.y - g.start.y })
  }
  const markers = shapeEditing && active ? editHandles(active) : vertices.map(screen)
  // The selection box takes in the whole outline of a turned ellipse, not only its handles.
  const boxPoints = shapeEditing && active ? [...markers, ...extent(active) ?? []] : markers
  const provisional = vertices.length && hover && mode === 'circle' ? ellipse(screen(vertices[0]!), distance(screen(vertices[0]!), hover), distance(screen(vertices[0]!), hover)) : null
  const overFirst = vertices.length > 0 && hover && distance(screen(vertices[0]!), hover) <= hitRadius
  const overLast = vertices.length > 1 && hover && distance(screen(vertices.at(-1)!), hover) <= hitRadius
  const ring = snap ?? labelDrag?.ring ?? (hover && drawMagnet(hover))
  const Cursor = held ? null : mode === 'polyline' ? (!vertices.length ? null : overFirst && vertices.length === 1 ? SquareDashedX : overLast || overFirst && vertices.length > 2 ? SquareDashedPlus : SquareDashedMousePointer)
    : mode === 'circle' && preview ? Diameter : mode === 'circle' && vertices.length ? Radius : mode === 'place' || mode === 'note' ? Crosshair : null
  function shiftPreview(shift: boolean) {
    const g = drag.current, p = lastPoint.current
    if (g && p && distance(g.start, p) > g.tolerance && (g.initial ? !g.still : performance.now() - g.started >= holdTime)) setPreview(edit(g, p, shift))
  }
  return <>
    <svg ref={root} tabIndex={-1} aria-label="Figuras y etiquetas" className={styles.surface} data-drawing-surface
      style={{ visibility: suspended ? 'hidden' : undefined, pointerEvents: creating ? 'auto' : 'none', cursor: Cursor && hover ? 'none' : creating && !held ? 'crosshair' : undefined }} onPointerDown={down} onPointerUp={up}
      onPointerMove={e => { const p = coords(e), current = drag.current
        if (current?.id === e.pointerId) {
          if (hasPointDraft) setHover(p)
          else if ((current.initial ? !current.still : performance.now() - current.started >= holdTime) && distance(current.start, p) > current.tolerance) {
            const pulled = magnet(current, p, e.pointerType === 'touch' ? touchHitRadius : hitRadius)
            setSnap(pulled); setPreview(edit(current, pulled ?? p, e.shiftKey))
          }
        }
        lastPoint.current = p
        if (creating && e.pointerType !== 'touch') {
          if (touchInput) setTouchInput(false)
          setHover(drawMagnet(p) ?? (e.shiftKey && mode === 'polyline' && vertices.length ? sideSnap(p) : p))
        }
      }} onPointerLeave={() => setHover(null)} onLostPointerCapture={e => {
        if (drag.current?.id === e.pointerId) { drag.current = null; setPreview(null); setHover(null) }
      }} onPointerCancel={() => { drag.current = null; setPreview(null); setHover(null) }} onContextMenu={e => { if (creating) { e.preventDefault(); if (!touchInput) cancel() } }}
      onKeyDown={e => {
        if (e.key === 'Shift') shiftPreview(true)
        if (e.key === 'Escape' && (vertices.length || drag.current)) { e.stopPropagation(); cancel() }
        if (e.key === 'Enter' && vertices.length >= 2) { e.preventDefault(); finish('line') }
      }} onKeyUp={e => { if (e.key === 'Shift') shiftPreview(false) }}>
      {shapes.filter(s => groupVisible(objects, s.id)).map(s => graphic(s))}
      {preview && graphic(preview, true)}
      {provisional && graphic(provisional, true)}
      {mode === 'polyline' && vertices.length > 0 && <polyline points={[...vertices.map(screen), ...(hover ? [hover] : [])].map(p => p.x + ',' + p.y).join(' ')}
        fill="none" stroke={color} strokeWidth={width} />}
      {shapeEditing && active && !turning && <SelectionBox points={boxPoints} padding={active.width / 2 + 4} onFlip={preview ? undefined : flipSelection} />}
      {groupShift && previews(s => translated(s, groupShift, projection), path => translated(path, groupShift, projection))}
      {turning && previews(s => turnedShape(s, turning.center, turning.angle, projection), path => turned(path, turning.center, turning.angle, projection))}
      {group.length > 0 && !turning && <SelectionBox points={groupPoints} padding={Math.max(...group.map(item => item.width)) / 2 + 4} onFlip={groupShift ? undefined : flipSelection} />}
      {group.length > 0 && !groupShift && rotateSelection && <RotateHandle points={groupPoints} padding={Math.max(...group.map(item => item.width)) / 2 + 4}
        base={direction(group[0]!.points, !group[0]!.closed && !shapes.some(s => s.id === group[0]!.id))} onTurn={setTurning} onRotate={rotateSelection} />}
      {group.length > 0 && moveSelection && !turning && <MoveHandle points={groupPoints}
        onPointerDown={e => {
          if (e.button !== 0 || !e.isPrimary) return
          e.preventDefault(); e.stopPropagation()
          groupDrag.current = { id: e.pointerId, start: coords(e) }; e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={e => {
          const g = groupDrag.current
          if (!g || g.id !== e.pointerId) return
          e.stopPropagation(); const p = coords(e); setGroupShift({ x: p.x - g.start.x, y: p.y - g.start.y })
        }}
        onPointerUp={e => endGroupDrag(e, true)} onPointerCancel={e => endGroupDrag(e, false)} onLostPointerCapture={e => endGroupDrag(e, false)} />}
      {marquee && <g className={styles.selectionBox} pointerEvents="none">
        {[styles.guideOutline, styles.guide].map(c => <rect key={c} className={c} x={marquee.left} y={marquee.top} width={marquee.right - marquee.left} height={marquee.bottom - marquee.top} />)}
      </g>}
      {shapeEditing && active && !preview && !turning && <MoveHandle points={boxPoints} data-shape={active.id} />}
      {shapeEditing && active && !preview && rotateSelection && <RotateHandle points={boxPoints} padding={active.width / 2 + 4}
        base={direction(handles(active, projection))} onTurn={setTurning} onRotate={rotateSelection} />}
      {markers.map((p, i) => <g key={i} data-shape={active?.id} data-handle={i} pointerEvents={shapeEditing ? 'all' : 'none'}>
        {!shapeEditing ? <circle cx={p.x} cy={p.y} r={5} fill={color} stroke="white" strokeWidth={2} className={styles.anchorDot} />
          : <circle cx={p.x} cy={p.y} r={5} className={styles.vertexHandle} />}
        <rect className={styles.vertexTarget} x={p.x - hitRadius} y={p.y - hitRadius} width={hitRadius * 2} height={hitRadius * 2} fill="transparent" />
      </g>)}
      {!native && labels.filter(l => !l.owner || (groupVisible(objects, l.owner) && ownerVisible?.(l.owner) !== false)).map(l =>
        <LabelText key={l.id} label={l} at={screen(l.point)} selected={selected === l.id} data-drawing-label={l.id} pointerEvents={editing ? 'bounding-box' : 'none'} />)}
      {labelDrag && <LabelText label={labelDrag.label} at={labelDrag.at} selected={false} ghost pointerEvents="none" />}
      {hasPointDraft && hover && <circle cx={hover.x} cy={hover.y} r={4} fill={color} stroke="white" strokeWidth={2} className={styles.anchorDot} pointerEvents="none" />}
      {ring && <g className={styles.snapRing} pointerEvents="none">{[styles.snapOutline, styles.snapLine].map(c => <circle key={c} className={c} cx={ring.x} cy={ring.y} r={9} />)}</g>}
      {Cursor && hover && !touchInput && <Cursor className={styles.cursorIcon} x={hover.x - 3} y={hover.y - 3} width={20} height={20} pointerEvents="none" />}
    </svg>
    {!suspended && mode === 'polyline' && touchInput && vertices.length > 0 && <div className={styles.draftActions} role="group" aria-label="Polilínea en curso"
      onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
      <Button aria-label="Quitar último vértice" title="Quitar último vértice" onClick={() => { setVertices(vertices.slice(0, -1)); setHover(null) }}><Undo2 /></Button>
      <Button disabled={vertices.length < 2} onClick={() => finish('line')}>Terminar línea</Button>
      <Button disabled={vertices.length < 3} onClick={() => finish('polygon')}>Cerrar polígono</Button>
      <Button aria-label="Cancelar polilínea" title="Cancelar polilínea" onClick={cancel}><X /></Button>
    </div>}
  </>
}

