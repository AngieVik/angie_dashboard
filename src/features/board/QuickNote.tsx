import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import type { Position, QuickNote as Note } from '../../domain/document/types'
import type { Size } from '../../layout/layoutTypes'
import { Button } from '../../components/ui/button'
import { clampBoardPosition } from './boardReducer'
import { boardDelta } from './boardViewport'
import type { BoardViewportState } from './boardViewport'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { Pencil, Trash2 } from 'lucide-react'

export function QuickNote({ note, selected, enabled, surface, onSelect, onMove, onResize, onEdit, onDelete, view = { scale: 1, offsetX: 0, offsetY: 0 }, viewportSize }: {
  note: Note; selected: boolean; enabled: boolean; surface: RefObject<HTMLDivElement | null>
  onSelect: () => void; onMove: (position: Position) => void; onResize: (size: Size) => void; onEdit: () => void; onDelete: () => void
  view?: BoardViewportState; viewportSize?: Size
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [preview, setPreview] = useState<{ position: Position; size: Size } | null>(null)
  const drag = useRef<{ kind: 'move' | 'resize'; pointerId: number; x: number; y: number; ready: boolean; next: typeof preview } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const suppressClick = useRef(false)
  const cancel = useCallback(() => { clearTimeout(timer.current); drag.current = null; setPreview(null) }, [])
  useEffect(() => {
    // A navigation gesture discards the preview before any content can commit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (blocked || !enabled) cancel()
  }, [blocked, enabled, cancel])
  useEffect(() => () => clearTimeout(timer.current), [])
  function start(event: PointerEvent<HTMLButtonElement>, kind: 'move' | 'resize') {
    if (!enabled || blockedRef.current || event.button !== 0) return
    event.stopPropagation(); event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId)
    suppressClick.current = false
    drag.current = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, ready: kind === 'resize', next: null }
    clearTimeout(timer.current)
    if (kind === 'move') timer.current = setTimeout(() => { if (drag.current && !blockedRef.current) drag.current.ready = true }, 250)
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current, rect = surface.current?.getBoundingClientRect()
    if (!current || current.pointerId !== event.pointerId || !current.ready || blockedRef.current || !rect?.width) return
    event.stopPropagation()
    const delta = boardDelta({ x: event.clientX - current.x, y: event.clientY - current.y }, rect, view,
      viewportSize ?? { width: surface.current!.clientWidth || rect.width, height: surface.current!.clientHeight || rect.height })
    current.next = current.kind === 'move' ? { position: clampBoardPosition({ x: note.position.x + delta.x, y: note.position.y + delta.y }), size: { width: note.width, height: note.height } }
      : { position: note.position, size: { width: Math.max(120, note.width + 2 * delta.x), height: Math.max(64, note.height + 2 * delta.y) } }
    setPreview(current.next)
  }
  function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    event.stopPropagation()
    if (!blockedRef.current && enabled) {
      onSelect()
      if (current.next) { suppressClick.current = true; if (current.kind === 'move') onMove(current.next.position); else onResize(current.next.size) }
    }
    cancel()
  }
  const position = preview?.position ?? note.position, size = preview?.size ?? note
  return <div className="quick-note" data-note-id={note.id} data-selected={selected}
    style={{ left: position.x, top: position.y, width: size.width, height: size.height, pointerEvents: enabled && !blocked ? 'auto' : 'none' }}>
    <button type="button" className="quick-note-text" title={note.text} disabled={!enabled || blocked}
      onClick={() => { if (!blockedRef.current && !suppressClick.current) onSelect(); suppressClick.current = false }} aria-label={note.text || 'Nota rápida vacía'}
      onPointerDown={event => start(event, 'move')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}>{note.text || '\u00a0'}</button>
    <div className="quick-note-actions" style={{ visibility: selected && enabled ? 'visible' : 'hidden' }} onPointerDown={event => event.stopPropagation()}>
      <Button disabled={!enabled || blocked} aria-label="Editar nota" title="Editar nota" onClick={onEdit}><Pencil size={14} aria-hidden="true" /></Button>
      <Button disabled={!enabled || blocked} aria-label="Eliminar nota" title="Eliminar nota" onClick={onDelete}><Trash2 size={14} aria-hidden="true" /></Button>
    </div>
    {selected && enabled && <button type="button" className="quick-note-resize" aria-label="Redimensionar nota rápida" disabled={blocked}
      onPointerDown={event => start(event, 'resize')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel} />}
  </div>
}
