import { useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent, RefObject, TouchEvent as ReactTouchEvent } from 'react'
import type { Size, ViewportState } from './layoutTypes'
import { pan, zoomAt } from './viewportMath'
import type { BoardNavigation } from './ViewportContext'

interface Point { x: number; y: number }
export function useViewportGestures(state: ViewportState, size: Size, bounds: Size, onChange: (state: ViewportState) => void, element: RefObject<HTMLDivElement | null>, headerHeight = 0) {
  const pointers = useRef(new Map<number, Point>())
  const origin = useRef({ left: 0, top: 0 })
  const origins = useRef(new Map<number, boolean>())
  const boardNavigationRef = useRef<BoardNavigation | null>(null)
  const gestureOwner = useRef<'main' | 'board' | 'cancel' | null>(null)
  const blockedRef = useRef(false)
  const suppressClick = useRef(false)
  const nativeTouches = useRef<Touch[]>([])
  const [blocked, setBlocked] = useState(false)
  const current = useRef(state)
  const previous = useRef<{ midpoint: Point; distance: number } | null>(null)
  // Both fingers use one reference, so transient clamping between their events
  // cannot change the final scale of a translation.
  const config = useRef({ state, size, bounds, onChange, headerHeight })
  function pair() {
    const [a, b] = [...pointers.current.values()]
    return a && b ? { midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) } : null
  }
  function point(event: PointerEvent): Point {
    return { x: event.clientX - origin.current.left, y: event.clientY - origin.current.top }
  }
  function start(event: PointerEvent) {
    if (!pointers.current.size) {
      const rect = element.current?.getBoundingClientRect()
      origin.current = { left: rect?.left ?? 0, top: rect?.top ?? 0 }
      current.current = state
      config.current = { state, size, bounds, onChange, headerHeight }
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
      } else {
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
    const [a, b] = [...pointers.current.values()], rect = origin.current
    return a && b ? [{ x: a.x + rect.left, y: a.y + rect.top }, { x: b.x + rect.left, y: b.y + rect.top }] : null
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
      const zoomed = zoomAt(settings.state, settings.state.scale * next.distance / old.distance, old.midpoint, settings.size, settings.bounds)
      const headerDelta = settings.headerHeight * (zoomed.scale - settings.state.scale)
      const visible = { ...settings.size, height: Math.max(1, settings.size.height - headerDelta) }
      current.current = pan(zoomed, next.midpoint.x - old.midpoint.x, next.midpoint.y - old.midpoint.y - headerDelta, visible, settings.bounds)
      settings.onChange(current.current)
    }
  }
  function end(event: PointerEvent) {
    pointers.current.delete(event.pointerId)
    origins.current.delete(event.pointerId)
    if (blockedRef.current) { event.preventDefault(); event.stopPropagation() }
    previous.current = pair()
    if (pointers.current.size < 2) { boardNavigationRef.current?.gesture(null); if (blockedRef.current) gestureOwner.current = 'cancel' }
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
