import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, RefObject } from 'react'
import type { Position, QuickNote as Note } from '../../domain/document/types'
import type { Size } from '../../layout/layoutTypes'
import { Button } from '../../components/ui/button'
import { clampBoardPosition } from './boardReducer'
import { boardDelta } from './boardViewport'
import type { BoardViewportState } from './boardViewport'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useAutoGrowingTextarea } from '../notebook/useAutoGrowingTextarea'
import { growQuickNote, scaleQuickNote } from './noteGeometry'
import { SquareX } from 'lucide-react'
import type { NoteEdit } from './boardTypes'

type Field = 'title' | 'text'
export function QuickNote({ note, selected, enabled, surface, onSelect, onMove, onResize, onEdit, onDelete, focusBody = false, view = { scale: 1, offsetX: 0, offsetY: 0 }, viewportSize }: {
  note: Note; selected: boolean; enabled: boolean; surface: RefObject<HTMLDivElement | null>; focusBody?: boolean
  onSelect: () => void; onMove: (position: Position) => void; onResize: (factor: number) => void; onEdit: (patch: NoteEdit) => void; onDelete: () => void
  view?: BoardViewportState; viewportSize?: Size
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const root = useRef<HTMLDivElement>(null), header = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<{ field: Field; value: string } | null>(null)
  const active = useRef<{ field: Field; original: string; value: string } | null>(null)
  const composing = useRef(false), deleted = useRef(false)
  const text = draft?.field === 'text' ? draft.value : note.text
  const textarea = useAutoGrowingTextarea(text)
  const [editHeight, setEditHeight] = useState<number | null>(null)
  const [preview, setPreview] = useState<Note | null>(null)
  const drag = useRef<{ kind: 'move' | 'resize'; pointerId: number; x: number; y: number; base: Note; ready: boolean; next: Note | null; factor: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancel = useCallback(() => { clearTimeout(timer.current); drag.current = null; setPreview(null) }, [])
  useEffect(() => {
    // Navigation cancels only the gesture, preserving the active field draft and focus.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (blocked || !enabled) cancel()
  }, [blocked, enabled, cancel])
  useEffect(() => () => clearTimeout(timer.current), [])
  useLayoutEffect(() => { if (focusBody) textarea.current?.focus() }, [focusBody, textarea])
  const measuredHeight = useCallback(() => {
    const body = textarea.current, bar = header.current, box = root.current
    if (!body?.scrollHeight || !bar?.offsetHeight || !box) return undefined
    const style = getComputedStyle(box)
    return body.scrollHeight + bar.offsetHeight + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
  }, [textarea])
  useLayoutEffect(() => {
    if (active.current?.field !== 'text') return
    const height = measuredHeight()
    // Measurement is a local preview. Only field confirmation persists geometry.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (height !== undefined) setEditHeight(height)
  }, [text, note.width, note.scale, measuredHeight])
  function commit(render = true) {
    const editing = active.current
    active.current = null
    if (render) { setDraft(null); setEditHeight(null) }
    if (!editing || deleted.current || editing.value === editing.original) return
    const height = editing.field === 'text' ? measuredHeight() : undefined
    onEdit({ [editing.field]: editing.value, ...(height === undefined ? {} : { height }) })
  }
  const commitOnClose = useRef<() => void>(() => {})
  useLayoutEffect(() => { commitOnClose.current = () => commit(false) })
  useLayoutEffect(() => () => commitOnClose.current(), [])
  function begin(field: Field) {
    if (active.current?.field === field) return
    active.current = { field, original: note[field], value: note[field] }
    setDraft({ field, value: note[field] }); onSelect()
  }
  function change(field: Field, value: string) {
    active.current ??= { field, original: note[field], value: note[field] }
    active.current.value = value; setDraft({ field, value })
  }
  function key(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, field: Field) {
    if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); active.current = null; setDraft(null); setEditHeight(null); root.current?.focus()
    } else if (event.key === 'Enter' && field === 'title') {
      event.preventDefault(); event.stopPropagation(); commit(); textarea.current?.focus()
    }
  }
  function start(event: PointerEvent<HTMLElement>, kind: 'move' | 'resize') {
    if (!enabled || blockedRef.current || event.button !== 0) return
    event.stopPropagation(); event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, base: note, ready: kind === 'resize', next: null, factor: 1 }
    clearTimeout(timer.current)
    if (kind === 'move') timer.current = setTimeout(() => { if (drag.current && !blockedRef.current) drag.current.ready = true }, 250)
  }
  function move(event: PointerEvent<HTMLElement>) {
    const current = drag.current, rect = surface.current?.getBoundingClientRect()
    if (!current || current.pointerId !== event.pointerId || !current.ready || blockedRef.current || !rect?.width) return
    event.stopPropagation()
    const delta = boardDelta({ x: event.clientX - current.x, y: event.clientY - current.y }, rect, view,
      viewportSize ?? { width: surface.current!.clientWidth || rect.width, height: surface.current!.clientHeight || rect.height })
    if (current.kind === 'move') current.next = { ...current.base, position: clampBoardPosition({ x: current.base.position.x + delta.x, y: current.base.position.y + delta.y }) }
    else {
      const { width, height } = current.base
      const factor = 1 + (delta.x * width + delta.y * height) / (width ** 2 + height ** 2)
      const next = scaleQuickNote(current.base, factor)
      if (next === current.base) return
      current.factor = factor; current.next = next
    }
    setPreview(current.next)
  }
  function finish(event: PointerEvent<HTMLElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    event.stopPropagation()
    if (!blockedRef.current && enabled) {
      onSelect()
      if (current.next) { if (current.kind === 'move') onMove(current.next.position); else onResize(current.factor) }
    }
    cancel()
  }
  const box = preview ?? (editHeight === null ? note : growQuickNote(note, editHeight))
  // readOnly keeps drafts/focus intact when two fingers temporarily own navigation.
  const readOnly = !enabled || blocked
  return <div ref={root} tabIndex={-1} className="quick-note" data-note-id={note.id} data-selected={selected}
    style={{ left: box.position.x, top: box.position.y, width: box.width, height: box.height, '--note-scale': box.scale,
      pointerEvents: enabled && !blocked ? 'auto' : 'none', zIndex: selected ? 1 : undefined } as CSSProperties}>
    <div ref={header} className="quick-note-header" onPointerDown={event => start(event, 'move')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}>
      <input aria-label="Título de nota rápida" value={draft?.field === 'title' ? draft.value : note.title} readOnly={readOnly}
        onPointerDown={event => event.stopPropagation()} onFocus={() => begin('title')} onChange={event => change('title', event.target.value)} onBlur={() => commit()}
        onKeyDown={event => key(event, 'title')} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} />
      <Button disabled={!enabled || blocked} aria-label="Eliminar nota" title="Eliminar nota" onPointerDown={event => { event.stopPropagation(); event.preventDefault() }}
        onClick={() => { deleted.current = true; active.current = null; onDelete() }}><SquareX aria-hidden="true" /></Button>
    </div>
    <div className="quick-note-body" onPointerDown={event => event.stopPropagation()} onWheelCapture={event => {
      if (!event.ctrlKey && event.currentTarget.scrollHeight > event.currentTarget.clientHeight) event.stopPropagation()
    }}><textarea ref={textarea} rows={1} className="quick-note-text" aria-label="Texto de nota rápida" value={text} readOnly={readOnly}
      onPointerDown={event => event.stopPropagation()} onFocus={() => begin('text')} onChange={event => change('text', event.target.value)} onBlur={() => commit()}
      onKeyDown={event => key(event, 'text')} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} /></div>
    {selected && enabled && <button type="button" className="quick-note-resize" aria-label="Redimensionar nota rápida" disabled={blocked}
      onPointerDown={event => start(event, 'resize')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel} />}
  </div>
}
