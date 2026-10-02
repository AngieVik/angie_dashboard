import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { PointerEvent, RefObject } from 'react'
import type { Position } from '../../domain/document/types'
import type { Size } from '../../layout/layoutTypes'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { panBoard, zoomBoardAt } from './boardViewport'
import type { BoardBounds, BoardViewportState } from './boardViewport'

export function useBoardViewportGestures(view: BoardViewportState, size: Size, bounds: BoardBounds, onChange: (view: BoardViewportState) => void, surfaceRef: RefObject<HTMLDivElement | null>) {
  const { boardNavigationRef, blockedRef } = useViewportInteraction()
  const current = useRef(view), settings = useRef({ size, bounds, onChange })
  const previous = useRef<{ midpoint: Position; distance: number } | null>(null)
  const middle = useRef<{ id: number; point: Position } | null>(null)
  useLayoutEffect(() => { current.current = view; settings.current = { size, bounds, onChange } }, [view, size, bounds, onChange])
  const pixel = useCallback((point: Position): Position => {
    const rect = surfaceRef.current!.getBoundingClientRect(), size = settings.current.size
    return { x: (point.x - rect.left) * size.width / rect.width, y: (point.y - rect.top) * size.height / rect.height }
  }, [surfaceRef])
  const apply = useCallback((next: BoardViewportState) => { current.current = next; settings.current.onChange(next) }, [])
  useLayoutEffect(() => {
    const element = surfaceRef.current
    if (!boardNavigationRef || !element) return
    boardNavigationRef.current = { element, gesture: points => {
      middle.current = null
      if (!points) { previous.current = null; return }
      const a = pixel(points[0]), b = pixel(points[1])
      const next = { midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) }
      const old = previous.current, config = settings.current
      if (old && old.distance > 0) {
        const zoomed = zoomBoardAt(current.current, current.current.scale * next.distance / old.distance, old.midpoint, config.size, config.bounds)
        apply(panBoard(zoomed, next.midpoint.x - old.midpoint.x, next.midpoint.y - old.midpoint.y, config.size, config.bounds))
      }
      previous.current = next
    } }
    return () => { boardNavigationRef.current = null }
  }, [boardNavigationRef, surfaceRef, pixel, apply])
  useEffect(() => {
    const element = surfaceRef.current
    if (!element) return
    function wheel(event: WheelEvent) {
      event.preventDefault(); event.stopPropagation()
      if (blockedRef.current) return
      const config = settings.current, unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? config.size.height : 1
      const rect = element!.getBoundingClientRect(), dx = event.deltaX * unit * config.size.width / rect.width, dy = event.deltaY * unit * config.size.height / rect.height
      apply(event.ctrlKey ? zoomBoardAt(current.current, current.current.scale * Math.exp(-event.deltaY * unit * .002), pixel({ x: event.clientX, y: event.clientY }), config.size, config.bounds)
        : panBoard(current.current, event.shiftKey ? -dy : -dx, event.shiftKey ? 0 : -dy, config.size, config.bounds))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [blockedRef, surfaceRef, pixel, apply])
  return {
    onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 1 || blockedRef.current) return
      event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId)
      middle.current = { id: event.pointerId, point: pixel({ x: event.clientX, y: event.clientY }) }
    },
    onPointerMoveCapture: (event: PointerEvent<HTMLDivElement>) => {
      const old = middle.current
      if (!old || old.id !== event.pointerId || blockedRef.current) return
      event.preventDefault(); event.stopPropagation()
      const next = pixel({ x: event.clientX, y: event.clientY }), config = settings.current
      apply(panBoard(current.current, next.x - old.point.x, next.y - old.point.y, config.size, config.bounds))
      middle.current = { id: old.id, point: next }
    },
    onPointerUpCapture: (event: PointerEvent<HTMLDivElement>) => {
      if (middle.current?.id !== event.pointerId) return
      event.preventDefault(); event.stopPropagation(); middle.current = null
    },
    onPointerCancelCapture: () => { middle.current = null },
  }
}
