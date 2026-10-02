import { useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent, RefObject, TouchEvent as ReactTouchEvent } from 'react'
import type { Size, ViewportState } from './layoutTypes'
import { pan, zoomAt } from './viewportMath'
import type { BoardNavigation } from './ViewportContext'

interface Point { x: number; y: number }
export function useViewportGestures(state: ViewportState, size: Size, bounds: Size, onChange: (state: ViewportState) => void, element: RefObject<HTMLDivElement | null>) {
  const pointers = useRef(new Map<number, Point>())
  const origins = useRef(new Map<number, boolean>())
  const boardNavigationRef = useRef<BoardNavigation | null>(null)
  const gestureOwner = useRef<'main' | 'board' | 'cancel' | null>(null)
  const blockedRef = useRef(false)
  const suppressClick = useRef(false)
  const nativeTouches = useRef<Touch[]>([])
  const [blocked, setBlocked] = useState(false)
  const current = useRef(state)
  const previous = useRef<{ midpoint: Point; distance: number } | null>(null)
  // Event handlers read the latest committed state; intermediate pointer moves
  // use current.current so two events in one frame do not lose a delta.
  const config = useRef({ state, size, bounds, onChange })
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
      config.current = { state, size, bounds, onChange }
      suppressClick.current = false
      gestureOwner.current = null
    }
    pointers.current.set(event.pointerId, point(event))
    origins.current.set(event.pointerId, Boolean(boardNavigationRef.current?.element.contains(event.target as Node)))
    if (pointers.current.size >= 2) {
      const entering = !blockedRef.current
      blockedRef.current = true
      suppressClick.current = true
      setBlocked(true)
      if (entering) {
        const surfaces = [...origins.current.values()]
        gestureOwner.current = surfaces.every(Boolean) ? 'board' : surfaces.some(Boolean) ? 'cancel' : 'main'
        if (gestureOwner.current === 'board') boardNavigationRef.current?.gesture(boardPair())
      } else if ([...origins.current.values()].some(inside => inside !== (gestureOwner.current === 'board'))) {
        gestureOwner.current = 'cancel'
        boardNavigationRef.current?.gesture(null)
      }
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
  function boardPair(): [Point, Point] | null {
    const [a, b] = [...pointers.current.values()], rect = element.current?.getBoundingClientRect()
    return a && b ? [{ x: a.x + (rect?.left ?? 0), y: a.y + (rect?.top ?? 0) }, { x: b.x + (rect?.left ?? 0), y: b.y + (rect?.top ?? 0) }] : null
  }
  function move(event: PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, point(event))
    if (!blockedRef.current) return
    event.preventDefault(); event.stopPropagation()
    const boardRect = boardNavigationRef.current?.element.getBoundingClientRect()
    if (boardRect && gestureOwner.current !== 'cancel') {
      const board = boardNavigationRef.current!.element, hit = board.ownerDocument.elementFromPoint?.(event.clientX, event.clientY)
      // During navigation content ignores pointer events. Hit testing its frame
      // still distinguishes a visible board from a window layered above it.
      const visible = !hit || board.contains(hit) || Boolean(board.closest('[data-module]')?.contains(hit))
      const inside = visible && event.clientX >= boardRect.left && event.clientX <= boardRect.right && event.clientY >= boardRect.top && event.clientY <= boardRect.bottom
      if (inside !== origins.current.get(event.pointerId)) {
        gestureOwner.current = 'cancel'; boardNavigationRef.current?.gesture(null)
      }
    }
    if (gestureOwner.current === 'board') { boardNavigationRef.current?.gesture(boardPair()); return }
    if (gestureOwner.current === 'cancel') return
    const next = pair(), old = previous.current
    if (next && old && old.distance > 0) {
      const settings = config.current
      const zoomed = zoomAt(current.current, current.current.scale * next.distance / old.distance, old.midpoint, settings.size, settings.bounds)
      current.current = pan(zoomed, next.midpoint.x - old.midpoint.x, next.midpoint.y - old.midpoint.y, settings.size, settings.bounds)
      settings.onChange(current.current)
    }
    previous.current = next
  }
  function end(event: PointerEvent) {
    pointers.current.delete(event.pointerId)
    origins.current.delete(event.pointerId)
    if (blockedRef.current) { event.preventDefault(); event.stopPropagation() }
    previous.current = pair()
    if (pointers.current.size < 2) boardNavigationRef.current?.gesture(null)
    if (!pointers.current.size) { blockedRef.current = false; setBlocked(false); gestureOwner.current = null }
  }
  return {
    blocked, blockedRef, boardNavigationRef,
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
