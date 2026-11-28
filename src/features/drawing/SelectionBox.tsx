import { Move, RotateCw } from 'lucide-react'
import { useRef, useState, type PointerEvent, type SVGAttributes } from 'react'
import type { Position } from '@/domain/document/types'
import { turn } from './shapeGeometry'
import styles from './drawing.module.css'

const moveSize = 20, moveHit = 12, flipMin = 8
function box(points: Position[]) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const p of points) { left = Math.min(left, p.x); right = Math.max(right, p.x); top = Math.min(top, p.y); bottom = Math.max(bottom, p.y) }
  return { left, right, top, bottom }
}
export type FlipAxis = 'x' | 'y'
// Selection mark: the box around the object with its central x and y axes.
// With onFlip, a click on the x axis flips the selection upside down and one on the y axis flips it sideways.
export function SelectionBox({ points, padding, onFlip }: { points: Position[]; padding: number; onFlip?: (axis: FlipAxis, center: Position) => void }) {
  if (!points.length) return null
  let { left, right, top, bottom } = box(points)
  left -= padding; right += padding; top -= padding; bottom += padding
  const cx = (left + right) / 2, cy = (top + bottom) / 2
  const frame = <rect x={left} y={top} width={right - left} height={bottom - top} />
  const axes = <><line x1={left} y1={cy} x2={right} y2={cy} /><line x1={cx} y1={top} x2={cx} y2={bottom} /></>
  return <g className={styles.selectionBox} pointerEvents="none">
    <g className={styles.guideOutline}>{frame}</g>
    <g className={styles.guide}>{frame}</g>
    <g className={styles.guideAxes}><g className={styles.guideOutline}>{axes}</g><g className={styles.guide}>{axes}</g></g>
    {/* Each half of an axis is clicked around its middle; on a short axis the area starts past the move handle. */}
    {onFlip && ([['x', -1, 0, 'Voltear vertical'], ['x', 1, 0, 'Voltear vertical'], ['y', 0, -1, 'Voltear horizontal'], ['y', 0, 1, 'Voltear horizontal']] as const).map(([axis, dx, dy, name]) => {
      const half = dx ? (right - left) / 2 : (bottom - top) / 2
      const from = Math.max(half * .25, moveHit + 2), to = Math.max(half * .75, from + flipMin)
      return <line key={axis + dx + dy} data-flip={axis} aria-label={name} className={styles.flipAxis} x1={cx + dx * from} y1={cy + dy * from} x2={cx + dx * to} y2={cy + dy * to} stroke="transparent" pointerEvents="stroke"
        onPointerDown={e => { if (e.button === 0) { e.preventDefault(); e.stopPropagation() } }}
        onClick={e => { e.stopPropagation(); onFlip(axis, { x: cx, y: cy }) }} />
    })}
  </g>
}

// Move handle where the axes cross; the caller marks it as part of the object.
export function MoveHandle({ points, ...props }: { points: Position[] } & Omit<SVGAttributes<SVGGElement>, 'points'>) {
  if (!points.length) return null
  const { left, right, top, bottom } = box(points), cx = (left + right) / 2, cy = (top + bottom) / 2
  return <g {...props} data-move className={styles.moveHandle} pointerEvents="all" aria-label="Mover">
    <circle cx={cx} cy={cy} r={moveHit} fill="transparent" />
    <Move x={cx - moveSize / 2} y={cy - moveSize / 2} width={moveSize} height={moveSize} pointerEvents="none" />
  </g>
}

export interface Turn { center: Position; angle: number }
const rotateSize = 16, rotateHit = 10, rotateGap = 6, rotateStep = 15
const degrees = (p: Position, c: Position) => Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI
// Free rotation handle below and right of the selection box. While it turns, the box follows the pointer
// and onTurn lets the caller draw the turned objects. Shift snaps the object's own direction (base, in degrees)
// to steps of 15° from the screen axes, so it can always get back square. The caller stores the turn on release.
export function RotateHandle({ points, padding, base = 0, onTurn, onRotate }: {
  points: Position[]; padding: number; base?: number; onTurn: (turn: Turn | null) => void; onRotate: (center: Position, deg: number) => void
}) {
  const [angle, setAngle] = useState<number | null>(null)
  const drag = useRef<{ id: number; start: number } | null>(null)
  if (!points.length) return null
  const { left, right, top, bottom } = box(points)
  const c = { x: (left + right) / 2, y: (top + bottom) / 2 }, a = angle ?? 0
  const frame = [{ x: left - padding, y: top - padding }, { x: right + padding, y: top - padding }, { x: right + padding, y: bottom + padding }, { x: left - padding, y: bottom + padding }]
  const handle = turn({ x: right + padding + rotateGap, y: bottom + padding + rotateGap }, c, a)
  function at(e: PointerEvent<SVGGElement>) {
    const svg = e.currentTarget.ownerSVGElement!, rect = svg.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * svg.clientWidth / rect.width, y: (e.clientY - rect.top) * svg.clientHeight / rect.height }
  }
  function end(e: PointerEvent<SVGGElement>, commit: boolean) {
    if (drag.current?.id !== e.pointerId) return
    e.stopPropagation(); drag.current = null; setAngle(null); onTurn(null)
    if (commit && angle && Math.abs(angle) >= .1) onRotate(c, angle)
  }
  const list = frame.map(q => turn(q, c, a)).map(q => q.x + ',' + q.y).join(' ')
  return <>
    {angle !== null && <g className={styles.selectionBox} pointerEvents="none">
      <polygon className={styles.guideOutline} fill="none" points={list} />
      <polygon className={styles.guide} fill="none" points={list} />
    </g>}
    <g data-rotate className={styles.moveHandle + ' ' + styles.rotateHandle} pointerEvents="all" aria-label="Girar"
      onPointerDown={e => {
        if (e.button !== 0 || !e.isPrimary) return
        e.preventDefault(); e.stopPropagation()
        drag.current = { id: e.pointerId, start: degrees(at(e), c) }; setAngle(0); onTurn({ center: c, angle: 0 }); e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => {
        const g = drag.current
        if (g?.id !== e.pointerId) return
        e.stopPropagation()
        const raw = ((degrees(at(e), c) - g.start + 540) % 360) - 180
        const next = e.shiftKey ? Math.round((base + raw) / rotateStep) * rotateStep - base : raw
        setAngle(next); onTurn({ center: c, angle: next })
      }}
      onPointerUp={e => end(e, true)} onPointerCancel={e => end(e, false)} onLostPointerCapture={e => end(e, false)}>
      <circle cx={handle.x} cy={handle.y} r={rotateHit} fill="transparent" />
      <RotateCw x={handle.x - rotateSize / 2} y={handle.y - rotateSize / 2} width={rotateSize} height={rotateSize} pointerEvents="none" />
    </g>
  </>
}
