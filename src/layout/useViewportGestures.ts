import { useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent, RefObject, TouchEvent as ReactTouchEvent } from 'react'
import type { Size, ViewportState } from './layoutTypes'
import { pan, zoomAt } from './viewportMath'

interface Point { x: number; y: number }
export function useViewportGestures(state: ViewportState, size: Size, onChange: (state: ViewportState) => void, element: RefObject<HTMLDivElement | null>) {
  const pointers = useRef(new Map<number, Point>())
  const blockedRef = useRef(false)
  const suppressClick = useRef(false)
  const nativeTouches = useRef<Touch[]>([])
  const [blocked, setBlocked] = useState(false)
  const current = useRef(state)
  const previous = useRef<{ midpoint: Point; distance: number } | null>(null)
  // Event handlers read the latest committed state; intermediate pointer moves
  // use current.current so two events in one frame do not lose a delta.
  const config = useRef({ state, size, onChange })
  function pair() {
    const [a, b] = [...pointers.current.values()]
    return a && b ? { midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) } : null
  }
  function point(event: PointerEvent): Point {
    const rect = element.current?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }
  function start(event: PointerEvent) {
    if (!pointers.current.size) {
      current.current = state
      config.current = { state, size, onChange }
      suppressClick.current = false
    }
    pointers.current.set(event.pointerId, point(event))
    if (pointers.current.size >= 2) {
      const entering = !blockedRef.current
      blockedRef.current = true
      suppressClick.current = true
      setBlocked(true)
      previous.current = pair()
      event.preventDefault(); event.stopPropagation()
      if (entering) {
        // react-draggable/react-resizable listen for mouse/touch completion
        // on document. Complete their transient interaction while the gate
        // rejects persistence, preserving mounted module content.
        const owner = element.current?.ownerDocument
        if (nativeTouches.current.length) owner?.dispatchEvent(new TouchEvent('touchend', {
          bubbles: true, touches: [], changedTouches: nativeTouches.current,
        }))
        owner?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      }
      for (const id of pointers.current.keys()) element.current?.setPointerCapture?.(id)
    }
  }
  function move(event: PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, point(event))
    if (!blockedRef.current) return
    event.preventDefault(); event.stopPropagation()
    const next = pair(), old = previous.current
    if (next && old && old.distance > 0) {
      const settings = config.current
      const zoomed = zoomAt(current.current, current.current.scale * next.distance / old.distance, old.midpoint, settings.size)
      current.current = pan(zoomed, next.midpoint.x - old.midpoint.x, next.midpoint.y - old.midpoint.y, settings.size)
      settings.onChange(current.current)
    }
    previous.current = next
  }
  function end(event: PointerEvent) {
    pointers.current.delete(event.pointerId)
    if (blockedRef.current) { event.preventDefault(); event.stopPropagation() }
    previous.current = pair()
    if (!pointers.current.size) { blockedRef.current = false; setBlocked(false) }
  }
  return {
    blocked, blockedRef,
    handlers: {
      onPointerDownCapture: start, onPointerMoveCapture: move,
      onPointerUpCapture: end, onPointerCancelCapture: end,
      onLostPointerCapture: (event: PointerEvent) => {
        // Transferring a child's capture to the viewport does not lift a finger.
        if (event.target === event.currentTarget) end(event)
      },
      onTouchStartCapture: (event: ReactTouchEvent) => {
        if (blockedRef.current || event.touches.length >= 2) event.stopPropagation()
        else nativeTouches.current = Array.from(event.nativeEvent.touches)
      },
      onTouchMoveCapture: (event: ReactTouchEvent) => { if (blockedRef.current) event.stopPropagation() },
      onTouchEndCapture: (event: ReactTouchEvent) => {
        if (suppressClick.current) event.stopPropagation()
        if (!event.touches.length) nativeTouches.current = []
      },
      onClickCapture: (event: ReactMouseEvent) => {
        // After lifting both fingers, keyboard/Radix activation (detail=0)
        // remains available; residual pointer clicks are still suppressed.
        if (blockedRef.current || (suppressClick.current && event.detail !== 0)) { event.preventDefault(); event.stopPropagation() }
      },
    },
  }
}
