import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, RefObject } from 'react'
import type { Position, QuickNote as Note } from '../../domain/document/types'
import type { Size } from '../../layout/layoutTypes'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import styles from './QuickNote.module.css'
import { clampBoardPosition } from './boardReducer'
import { boardDelta } from './boardViewport'
import type { BoardViewportState } from './boardViewport'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { resizeQuickNote } from './noteGeometry'
import { X } from 'lucide-react'
import type { NoteEdit } from './boardTypes'

export function QuickNote({ note, selected, enabled, surface, onSelect, onMove, onResize, onEdit, onDelete, initialDraft, onDraftChange, focusBody = false, view = { scale: 1, offsetX: 0, offsetY: 0 }, viewportSize }: {
  note: Note; selected: boolean; enabled: boolean; surface: RefObject<HTMLDivElement | null>; focusBody?: boolean
  onSelect: () => void; onMove: (position: Position) => void; onResize: (size: Size) => void; onEdit: (patch: NoteEdit) => boolean; onDelete: () => boolean
  initialDraft?: string; onDraftChange: (text: string | null) => void
  view?: BoardViewportState; viewportSize?: Size
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const root = useRef<HTMLDivElement>(null), textarea = useRef<HTMLTextAreaElement>(null)
  const composing = useRef(false), deleted = useRef(false)
  const originalText = note.title ? [note.title, note.text].filter(Boolean).join('\n') : note.text
  const [draft, setDraft] = useState<string | null>(initialDraft ?? null)
  const active = useRef<{ original: string; value: string } | null>(initialDraft === undefined ? null : { original: originalText, value: initialDraft })
  const text = draft ?? originalText
  const [preview, setPreview] = useState<Note | null>(null)
  const drag = useRef<{ kind: 'move' | 'resize'; pointerId: number; x: number; y: number; base: Note; ready: boolean; moved: boolean; next: Note | null } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancel = useCallback(() => { clearTimeout(timer.current); drag.current = null; setPreview(null) }, [])
  useEffect(() => {
    // Navigation cancels only the gesture, preserving the active field draft and focus.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (blocked || !enabled) cancel()
  }, [blocked, enabled, cancel])
  useEffect(() => () => clearTimeout(timer.current), [])
  useLayoutEffect(() => { if (focusBody) textarea.current?.focus() }, [focusBody, textarea])
  function commit(render = true) {
    const editing = active.current
    if (!editing || deleted.current) return
    if (editing.value !== editing.original && !onEdit({ text: editing.value, ...(note.title ? { title: '' } : {}) })) return
    active.current = null
    onDraftChange(null)
    if (render) setDraft(null)
  }
  const commitOnClose = useRef<() => void>(() => {})
  useLayoutEffect(() => { commitOnClose.current = () => commit(false) })
  useLayoutEffect(() => () => commitOnClose.current(), [])
  function begin() {
    if (!active.current) {
      active.current = { original: originalText, value: originalText }
      setDraft(originalText)
    }
    onSelect()
  }
  function change(value: string) {
    active.current ??= { original: originalText, value: originalText }
    active.current.value = value; setDraft(value); onDraftChange(value)
  }
  function key(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); active.current = null; setDraft(null); onDraftChange(null); root.current?.focus()
    }
  }
  function start(event: PointerEvent<HTMLElement>, kind: 'move' | 'resize') {
    if (!enabled || blockedRef.current || event.button !== 0) return
    event.stopPropagation(); event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, base: note, ready: kind === 'resize' || event.pointerType === 'mouse', moved: false, next: null }
    clearTimeout(timer.current)
    if (kind === 'move' && event.pointerType !== 'mouse') timer.current = setTimeout(() => { if (drag.current && !blockedRef.current) drag.current.ready = true }, 250)
  }
  function move(event: PointerEvent<HTMLElement>) {
    const current = drag.current, rect = surface.current?.getBoundingClientRect()
    if (!current || current.pointerId !== event.pointerId || !current.ready || blockedRef.current || !rect?.width) return
    if (!current.moved && current.kind === 'move' && event.pointerType === 'mouse' && Math.hypot(event.clientX - current.x, event.clientY - current.y) <= 4) return
    current.moved = true
    event.stopPropagation()
    const delta = boardDelta({ x: event.clientX - current.x, y: event.clientY - current.y }, rect, view,
      viewportSize ?? { width: surface.current!.clientWidth || rect.width, height: surface.current!.clientHeight || rect.height })
    if (current.kind === 'move') current.next = { ...current.base, position: clampBoardPosition({ x: current.base.position.x + delta.x, y: current.base.position.y + delta.y }) }
    else {
      current.next = resizeQuickNote(current.base, { width: current.base.width + delta.x, height: current.base.height + delta.y })
    }
    setPreview(current.next)
  }
  function finish(event: PointerEvent<HTMLElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    event.stopPropagation()
    if (!blockedRef.current && enabled) {
      onSelect()
      if (current.next) { if (current.kind === 'move') onMove(current.next.position); else onResize({ width: current.next.width, height: current.next.height }) }
    }
    cancel()
  }
  const box = preview ?? note
  // readOnly keeps drafts/focus intact when two fingers temporarily own navigation.
  const readOnly = !enabled || blocked
  return <div ref={root} tabIndex={-1} className={`quick-note ${styles.base}`} data-note-id={note.id} data-selected={selected}
    style={{ left: box.position.x, top: box.position.y, width: box.width, height: box.height,
      pointerEvents: enabled && !blocked ? 'auto' : 'none', zIndex: selected ? 1 : undefined } as CSSProperties}>
    <div className="quick-note-header" aria-label="Mover nota rápida" onPointerDown={event => start(event, 'move')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel} />
    <Button appearance="integrated" className="quick-note-delete" disabled={!enabled || blocked} aria-label="Eliminar nota" onPointerDown={event => { event.stopPropagation(); event.preventDefault() }}
      onClick={() => { if (onDelete()) { deleted.current = true; active.current = null; onDraftChange(null) } }}><X aria-hidden="true" /></Button>
    <div className="quick-note-body" onPointerDown={event => event.stopPropagation()} onWheelCapture={event => {
      if (!event.ctrlKey && textarea.current && textarea.current.scrollHeight > textarea.current.clientHeight) event.stopPropagation()
    }}><Textarea ref={textarea} rows={1} className="quick-note-text" aria-label="Texto de nota rápida" value={text} readOnly={readOnly}
      onPointerDown={event => event.stopPropagation()} onFocus={begin} onChange={event => change(event.target.value)} onBlur={() => commit()}
      onKeyDown={key} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} /></div>
    {selected && enabled && <button type="button" className="quick-note-resize" aria-label="Redimensionar nota rápida" disabled={blocked}
      onPointerDown={event => start(event, 'resize')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel} />}
  </div>
}
