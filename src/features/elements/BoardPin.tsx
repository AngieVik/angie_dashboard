import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import type { DocumentElement, Position } from '../../domain/document/types'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { clampAssetScale, clampPinPosition } from './elementCommands'
import { getPinBox, ICON_CATALOG } from './iconCatalog'
import { boardDelta } from '../board/boardViewport'
import type { BoardViewportState } from '../board/boardViewport'
import type { Size } from '../../layout/layoutTypes'
export interface BoardPinProps {
  element: DocumentElement; selected: boolean; enabled: boolean; surface: RefObject<HTMLDivElement | null>
  onSelect: () => void; onMove: (position: Position) => void; onScale: (scale: number) => void
  view?: BoardViewportState; viewportSize?: Size
}
export function BoardPin({ element, selected, enabled, surface, onSelect, onMove, onScale, view = { scale: 1, offsetX: 0, offsetY: 0 }, viewportSize }: BoardPinProps) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [preview, setPreview] = useState<{ position: Position; scale: number } | null>(null)
  const gesture = useRef<{ kind: 'move' | 'resize'; pointerId: number; x: number; y: number; origin: Position; scale: number; ready: boolean; next: { position: Position; scale: number } | null } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const suppressClick = useRef(false)
  const cancel = useCallback(() => { clearTimeout(timer.current); gesture.current = null; setPreview(null) }, [])
  useEffect(() => {
    // The viewport owns two-finger gestures; discard the uncommitted preview.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (blocked || !enabled) cancel()
  }, [blocked, enabled, cancel])
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!element.position || !element.pinVisible) return null
  const visual = { ...element.visual, scale: preview?.scale ?? element.visual.scale }
  const position = preview?.position ?? clampPinPosition(element.position, visual)
  const box = getPinBox(visual)
  function start(event: PointerEvent<HTMLButtonElement>, kind: 'move' | 'resize') {
    if (!enabled || blockedRef.current || event.button !== 0 || !element.position) return
    event.stopPropagation(); event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    suppressClick.current = false
    gesture.current = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: position,
      scale: element.visual.scale, ready: kind === 'resize', next: null }
    clearTimeout(timer.current)
    if (kind === 'move') timer.current = setTimeout(() => { if (gesture.current && !blockedRef.current) gesture.current.ready = true }, 250)
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current, rect = surface.current?.getBoundingClientRect()
    if (!current || current.pointerId !== event.pointerId || !current.ready || blockedRef.current || !rect?.width) return
    event.stopPropagation()
    const { x: dx, y: dy } = boardDelta({ x: event.clientX - current.x, y: event.clientY - current.y }, rect, view, viewportSize ?? { width: surface.current!.clientWidth || rect.width, height: surface.current!.clientHeight || rect.height })
    if (current.kind === 'move') current.next = { position: clampPinPosition({ x: current.origin.x + dx, y: current.origin.y + dy }, element.visual), scale: current.scale }
    else {
      const base = getPinBox({ ...element.visual, scale: 1 })
      const scale = clampAssetScale(current.scale + 2 * (dx * base.width + dy * base.height) / (base.width ** 2 + base.height ** 2))
      current.next = { position: clampPinPosition(current.origin, { ...element.visual, scale }), scale }
    }
    setPreview(current.next)
  }
  function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    event.stopPropagation()
    if (!blockedRef.current && enabled) {
      onSelect()
      if (current.next) {
        suppressClick.current = true
        if (current.kind === 'move') onMove(current.next.position)
        else onScale(current.next.scale)
      }
    }
    cancel()
  }
  const interactive = enabled && !blocked
  return <div className="board-pin" data-element-id={element.id} data-selected={selected} style={{ position: 'absolute', left: position.x, top: position.y, width: box.width, height: box.height, transform: 'translate(-50%, -50%)', pointerEvents: interactive ? 'auto' : 'none' }}>
    <button type="button" className="board-pin-visual" aria-label={`Seleccionar ${element.name}`} aria-pressed={selected} disabled={!interactive}
      style={{ width: box.width, height: box.height }} onPointerDown={event => start(event, 'move')} onPointerMove={move} onPointerUp={finish}
      onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={() => { if (interactive && !blockedRef.current && !suppressClick.current) onSelect(); suppressClick.current = false }}>
      {visual.type === 'asset' ? <img src={ICON_CATALOG[visual.assetId].path} alt={ICON_CATALOG[visual.assetId].name} draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }} /> : <span className="board-pin-emoji" aria-hidden="true" style={{ fontSize: 48 * visual.scale, lineHeight: `${64 * visual.scale}px` }}>{visual.value}</span>}
      <span className="board-pin-name" style={{ fontSize: element.nameFontSize ?? 16, lineHeight: `${(element.nameFontSize ?? 16) * 1.25}px`, maxWidth: 200 * visual.scale, padding: `${visual.scale}px ${4 * visual.scale}px` }}>{element.name}</span>
    </button>
    {selected && enabled && <button type="button" className="board-pin-resize" aria-label={`Redimensionar ${element.name}`} disabled={blocked}
      onPointerDown={event => start(event, 'resize')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel} />}
  </div>
}
