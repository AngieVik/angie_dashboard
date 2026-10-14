import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent, RefObject } from 'react'
import { Anchor as PopoverAnchor } from '@radix-ui/react-popover'
import type { DocumentElement, PinNameColor, Position } from '../../domain/document/types'
import { Popover, PopoverContent } from '../../components/ui/popover'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { clampAssetScale, clampPinPosition } from './elementCommands'
import { getPinBox, ICON_CATALOG } from './iconCatalog'
import { getPinNameLayout, PIN_NAME_COLORS, pinNameLines, pinNameStyle, pinTransform } from './pinPresentation'
import { boardDelta } from '../board/boardViewport'
import type { BoardViewportState } from '../board/boardViewport'
import type { Size } from '../../layout/layoutTypes'

export interface BoardPinProps {
  element: DocumentElement; selected: boolean; enabled: boolean; surface: RefObject<HTMLDivElement | null>
  onSelect: () => void; onEdit?: () => void; onMove: (position: Position) => void; onScale: (scale: number) => void
  onNameMove?: (offset: Position) => void; onNameColor?: (color: PinNameColor) => void
  view?: BoardViewportState; viewportSize?: Size
}
type PinPreview = { position: Position; scale: number; nameOffset?: Position }
export function BoardPin({ element, selected, enabled, surface, onSelect, onEdit, onMove, onScale, onNameMove, onNameColor, view = { scale: 1, offsetX: 0, offsetY: 0 }, viewportSize }: BoardPinProps) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [preview, setPreview] = useState<PinPreview | null>(null)
  const [colorsOpen, setColorsOpen] = useState(false)
  const lastTap = useRef<{ kind: 'move' | 'name'; time: number; x: number; y: number } | null>(null)
  const gesture = useRef<{ kind: 'move' | 'resize' | 'name'; pointerId: number; x: number; y: number; origin: Position; nameOffset: Position; scale: number; ready: boolean; moved: boolean; next: PinPreview | null } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const suppressClick = useRef(false)
  const cancel = useCallback(() => { clearTimeout(timer.current); gesture.current = null; setPreview(null) }, [])
  useEffect(() => {
    if (blocked || !enabled) {
      // The viewport owns two-finger gestures; discard uncommitted manipulation and taps.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cancel()
      setColorsOpen(false)
      lastTap.current = null
    }
  }, [blocked, enabled, cancel])
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!element.position || !element.pinVisible) return null
  const visual = { ...element.visual, scale: preview?.scale ?? element.visual.scale }
  const position = preview?.position ?? clampPinPosition(element.position, visual)
  const box = getPinBox(visual)
  const nameElement = { ...element, visual, nameOffset: preview?.nameOffset ?? element.nameOffset }
  const nameOffset = getPinNameLayout(nameElement).offset
  function start(event: PointerEvent<HTMLButtonElement>, kind: 'move' | 'resize' | 'name') {
    if (!enabled || blockedRef.current || event.button !== 0 || !element.position) return
    event.stopPropagation(); event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    suppressClick.current = false
    gesture.current = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: position,
      nameOffset, scale: element.visual.scale, ready: kind === 'resize', moved: false, next: null }
    clearTimeout(timer.current)
    if (kind !== 'resize') timer.current = setTimeout(() => { if (gesture.current && !blockedRef.current) gesture.current.ready = true }, 250)
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current, rect = surface.current?.getBoundingClientRect()
    if (!current || current.pointerId !== event.pointerId || blockedRef.current || !rect?.width) return
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 4) {
      current.moved = true
      lastTap.current = null
    }
    if (!current.ready || !current.moved) return
    event.stopPropagation()
    const { x: dx, y: dy } = boardDelta({ x: event.clientX - current.x, y: event.clientY - current.y }, rect, view, viewportSize ?? { width: surface.current!.clientWidth || rect.width, height: surface.current!.clientHeight || rect.height })
    if (current.kind === 'name') {
      const requested = { x: current.nameOffset.x + dx, y: current.nameOffset.y + dy }
      const label = getPinNameLayout(nameElement, event.currentTarget.offsetWidth || undefined)
      current.next = { position: current.origin, scale: current.scale,
        nameOffset: { x: Math.max(label.width / 2 - current.origin.x, requested.x), y: Math.max(label.height / 2 - current.origin.y, requested.y) } }
    } else if (current.kind === 'move') {
      // Keep a detached label reachable at the board's firm upper-left origin.
      const label = element.nameOffset && !element.nameHidden ? getPinNameLayout(element) : null
      const next = clampPinPosition({ x: current.origin.x + dx, y: current.origin.y + dy }, element.visual)
      if (label) { next.x = Math.max(next.x, label.width / 2 - label.offset.x); next.y = Math.max(next.y, label.height / 2 - label.offset.y) }
      current.next = { position: next, scale: current.scale }
    } else {
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
      suppressClick.current = current.moved
      if (current.next) {
        if (current.kind === 'name') onNameMove?.(current.next.nameOffset!)
        else if (current.kind === 'move') onMove(current.next.position)
        else onScale(current.next.scale)
      }
      if (current.kind !== 'resize' && !current.moved && event.pointerType === 'touch') {
        const previous = lastTap.current, time = Date.now()
        if (previous && previous.kind === current.kind && time - previous.time <= 350 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 24) {
          event.preventDefault()
          onEdit?.(); lastTap.current = null
        } else lastTap.current = { kind: current.kind, time, x: event.clientX, y: event.clientY }
      }
    }
    cancel()
  }
  function select() {
    if (enabled && !blockedRef.current && !suppressClick.current) onSelect()
    suppressClick.current = false
  }
  function edit(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    if (enabled && !blockedRef.current && !suppressClick.current) { lastTap.current = null; onEdit?.() }
  }
  const interactive = enabled && !blocked
  return <div className="board-pin" data-element-id={element.id} data-selected={selected} style={{ position: 'absolute', left: position.x, top: position.y, width: box.width, height: box.height, transform: 'translate(-50%, -50%)', pointerEvents: interactive ? 'auto' : 'none' }}>
    <button type="button" className="board-pin-visual" aria-label={`Seleccionar ${element.name}`} aria-pressed={selected} disabled={!interactive}
      style={{ width: box.width, height: box.height }} onPointerDown={event => start(event, 'move')} onPointerMove={move} onPointerUp={finish}
      onPointerCancel={() => { lastTap.current = null; cancel() }} onLostPointerCapture={cancel} onClick={select} onDoubleClick={edit}>
      {visual.type === 'asset' ? <img src={ICON_CATALOG[visual.assetId].path} alt={ICON_CATALOG[visual.assetId].name} draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', transform: pinTransform(visual) }} /> :
        <span className="board-pin-emoji" aria-hidden="true" style={{ display: 'block', fontSize: 48 * visual.scale, lineHeight: `${64 * visual.scale}px`, transform: pinTransform(visual) }}>{visual.value}</span>}
    </button>
    {!element.nameHidden && <Popover open={colorsOpen && interactive} onOpenChange={setColorsOpen}>
      <PopoverAnchor asChild><button type="button" className="board-pin-name" aria-label={`Mover nombre de ${element.name}`} title="Mover nombre"
        aria-haspopup="dialog" aria-expanded={colorsOpen && interactive} disabled={!interactive} style={pinNameStyle(nameElement)}
        onPointerDown={event => start(event, 'name')} onPointerMove={move} onPointerUp={finish}
        onPointerCancel={() => { lastTap.current = null; cancel() }} onLostPointerCapture={cancel} onClick={select}
        onDoubleClick={edit}
        onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && interactive && !blockedRef.current) { event.preventDefault(); event.stopPropagation(); setColorsOpen(true) } }}>
        {pinNameLines(element.name).join('\n')}
      </button></PopoverAnchor>
      <PopoverContent className="pin-name-palette" aria-label="Colores del nombre" onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onCloseAutoFocus={event => event.preventDefault()}>
        {(Object.entries(PIN_NAME_COLORS) as [PinNameColor, typeof PIN_NAME_COLORS[PinNameColor]][]).map(([color, theme]) =>
          <button key={color} type="button" aria-label={theme.label} aria-pressed={(element.nameColor ?? 'dark') === color}
            style={{ backgroundColor: theme.backgroundColor, color: theme.color }} onClick={event => {
              event.stopPropagation()
              if (!enabled || blockedRef.current) return
              onNameColor?.(color); setColorsOpen(false)
            }}>{theme.label}</button>)}
      </PopoverContent>
    </Popover>}
    {selected && enabled && <button type="button" className="board-pin-resize" aria-label={`Redimensionar ${element.name}`} disabled={blocked}
      onPointerDown={event => start(event, 'resize')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel} />}
  </div>
}
