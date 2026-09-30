import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Position, QuickNote as Note } from '../../domain/document/types'
import { Button } from '../../components/ui/button'
import { clampBoardPosition } from './boardReducer'
import { useViewportInteraction } from '../../layout/ViewportContext'

export function QuickNote({ note, selected, enabled, surface, onSelect, onMove, onEdit, onDelete }: {
  note: Note; selected: boolean; enabled: boolean; surface: RefObject<HTMLDivElement | null>
  onSelect: () => void; onMove: (position: Position) => void; onEdit: () => void; onDelete: () => void
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [preview, setPreview] = useState<Position | null>(null)
  const drag = useRef<{ pointerId: number; x: number; y: number; origin: Position; ready: boolean; next: Position | null } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancel = useCallback(() => { clearTimeout(timer.current); drag.current = null; setPreview(null) }, [])
  useEffect(() => {
    // Revert the spatial preview when the external gesture takes ownership.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (blocked || !enabled) cancel()
  }, [blocked, enabled, cancel])
  useEffect(() => () => clearTimeout(timer.current), [])
  const position = preview ?? note.position
  return <div className="quick-note" data-note-id={note.id} data-selected={selected}
    style={{ left: position.x, top: position.y, pointerEvents: enabled && !blocked ? 'auto' : 'none' }}>
    <button type="button" className="quick-note-text" title={note.text} disabled={!enabled || blocked} onClick={onSelect}
      aria-label={note.text || 'Nota rápida vacía'}
      onPointerDown={event => {
        if (!enabled || blockedRef.current || event.button !== 0) return
        event.stopPropagation()
        event.currentTarget.setPointerCapture?.(event.pointerId)
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: note.position, ready: false, next: null }
        timer.current = setTimeout(() => { if (drag.current && !blockedRef.current) drag.current.ready = true }, 250)
      }}
      onPointerMove={event => {
        const current = drag.current, rect = surface.current?.getBoundingClientRect()
        if (!current || current.pointerId !== event.pointerId || !current.ready || blockedRef.current || !rect?.width) return
        event.stopPropagation()
        current.next = clampBoardPosition({ x: current.origin.x + (event.clientX - current.x) * 1000 / rect.width,
          y: current.origin.y + (event.clientY - current.y) * 1000 / rect.height })
        setPreview(current.next)
      }}
      onPointerUp={event => {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        event.stopPropagation()
        if (!blockedRef.current) { onSelect(); if (current.next) onMove(current.next) }
        cancel()
      }} onPointerCancel={cancel} onLostPointerCapture={cancel}>{note.text || '\u00a0'}</button>
    <div className="quick-note-actions" style={{ visibility: selected && enabled ? 'visible' : 'hidden' }} onPointerDown={event => event.stopPropagation()}>
      <Button disabled={!enabled || blocked} onClick={onEdit}>Editar nota</Button>
      <Button disabled={!enabled || blocked} onClick={onDelete}>Eliminar nota</Button>
    </div>
  </div>
}
