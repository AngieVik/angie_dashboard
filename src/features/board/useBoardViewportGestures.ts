import { useCallback, useLayoutEffect, useRef } from 'react'
import type { PointerEvent, RefObject } from 'react'
import type { Position } from '../../domain/document/types'
import type { Size } from '../../layout/layoutTypes'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useModuleZoom } from '../../layout/ModuleZoomContext'
import { panBoard, zoomBoardAt } from './boardViewport'
import type { BoardBounds, BoardViewportState } from './boardViewport'

export function useBoardViewportGestures(view: BoardViewportState, size: Size, bounds: BoardBounds, onChange: (view: BoardViewportState) => void, surfaceRef: RefObject<HTMLDivElement | null>, allowDrag = false) {
  const { blockedRef } = useViewportInteraction()
  const { beginGestureRef } = useModuleZoom()
  const current = useRef(view), settings = useRef({ size, bounds, onChange })
  const middle = useRef<{ id: number; point: Position; moved: boolean; button: number } | null>(null)
  const suppressClick = useRef(false)
  useLayoutEffect(() => { current.current = view; settings.current = { size, bounds, onChange } }, [view, size, bounds, onChange])
  const pixel = useCallback((point: Position): Position => {
    const rect = surfaceRef.current!.getBoundingClientRect(), size = settings.current.size
    return { x: (point.x - rect.left) * size.width / rect.width, y: (point.y - rect.top) * size.height / rect.height }
  }, [surfaceRef])
  const apply = useCallback((next: BoardViewportState) => { current.current = next; settings.current.onChange(next) }, [])
  useLayoutEffect(() => {
    if (!beginGestureRef) return
    const begin = () => {
      const node = surfaceRef.current, rect = node?.getBoundingClientRect()
      if (!rect?.width || !rect.height) return null
      middle.current = null
      const initial = current.current, config = settings.current
      // Each update uses the same view and screen-to-canvas ratio, even when
      // the two pointer events arrive separately or the zoom hits a limit.
      return (scale: number, translation: Position) => {
        if (surfaceRef.current !== node) return
        const zoomed = zoomBoardAt(initial, scale, { x: 0, y: 0 }, config.size, config.bounds)
        apply(panBoard(zoomed, translation.x * config.size.width / rect.width,
          translation.y * config.size.height / rect.height, config.size, config.bounds))
      }
    }
    beginGestureRef.current = begin
    return () => { if (beginGestureRef.current === begin) beginGestureRef.current = null }
  }, [beginGestureRef, surfaceRef, apply])
  return {
    onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => {
      suppressClick.current = false
      if (blockedRef.current || (event.button !== 1 && (!allowDrag || event.button !== 0))) return
      if (event.button === 0 && event.target instanceof Element && event.target.closest('.board-pin,.quick-note,[data-image-action],button,input,textarea,select,[role="slider"]')) return
      if (event.button === 1) { event.preventDefault(); event.stopPropagation() }
      event.currentTarget.setPointerCapture?.(event.pointerId)
      middle.current = { id: event.pointerId, point: pixel({ x: event.clientX, y: event.clientY }), moved: false, button: event.button }
    },
    onPointerMoveCapture: (event: PointerEvent<HTMLDivElement>) => {
      const old = middle.current
      if (!old || old.id !== event.pointerId) return
      if (blockedRef.current) { middle.current = null; return }
      const next = pixel({ x: event.clientX, y: event.clientY }), config = settings.current
      const rect = event.currentTarget.getBoundingClientRect()
      const physical = Math.hypot((next.x - old.point.x) * rect.width / config.size.width, (next.y - old.point.y) * rect.height / config.size.height)
      if (!old.moved && old.button === 0 && physical <= 4) return
      event.preventDefault(); event.stopPropagation()
      apply(panBoard(current.current, next.x - old.point.x, next.y - old.point.y, config.size, config.bounds))
      middle.current = { ...old, point: next, moved: true }
    },
    onPointerUpCapture: (event: PointerEvent<HTMLDivElement>) => {
      const old = middle.current
      if (old?.id !== event.pointerId) return
      middle.current = null
      if (old.moved || old.button === 1) { suppressClick.current = old.moved; event.preventDefault(); event.stopPropagation() }
    },
    onPointerCancelCapture: () => { middle.current = null },
    onClickCapture: (event: import('react').MouseEvent<HTMLDivElement>) => {
      if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation() }
    },
  }
}
