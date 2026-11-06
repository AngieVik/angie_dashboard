import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { TimelineEntry } from '../../domain/document/types'
import { applyDocumentCommands } from '../../domain/document/documentCommand'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { ArrowLeft, PenLine, Save, Trash, X } from 'lucide-react'
import { getTimelineEntryLabel, isTimelineEntryDeleted, isTimelineEntryCorrected, isCurrentTimelineEntry } from '../../domain/operations/timelineProjection'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useModuleZoom } from '../../layout/ModuleZoomContext'
import { addManualTimelineEntry, deleteTimelineEntry, reviseTimelineText, formatTimelineTime } from './timelineCommands'
import styles from './timeline.module.css'
import toolbarStyles from '@/layout/moduleToolbar.module.css'

export function TimelineModule({ store }: { store: DocumentStore }) {
  const { documentGeneration } = useDocumentStore(store)
  return <TimelineContent key={documentGeneration} store={store} />
}

function TimelineContent({ store }: { store: DocumentStore }) {
  const { document } = useDocumentStore(store)
  const { scale } = useModuleZoom()
  const { blocked, blockedRef } = useViewportInteraction()
  const formId = useId()
  const [text, setText] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [editing, setEditing] = useState<{ entry: TimelineEntry; text: string }[] | null>(null)
  const [error, setError] = useValidationNotice()
  const [errorField, setErrorField] = useState<'new' | 'edit' | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const newEntryInput = useRef<HTMLInputElement>(null)
  const editControl = useRef<HTMLButtonElement>(null)
  const listScroll = useRef(0)
  const restoreList = useRef(false)
  const latestId = document.timeline.at(-1)?.id
  const previousLatest = useRef<string | undefined>(undefined)
  const previousScale = useRef(scale)
  const entries = document.timeline.filter(entry => !isTimelineEntryDeleted(entry))
  const checked = entries.filter(entry => checkedIds.includes(entry.id))
  const actionEntries = selectionMode ? checked : entries.filter(entry => entry.id === selectedId)
  const editingOpen = editing !== null
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const rowPointer = useRef<{ id: number; entryId: string; x: number; y: number } | null>(null)
  const activePointers = useRef(new Set<number>())
  const longPressed = useRef(false)

  function cancelHold() {
    clearTimeout(holdTimer.current); holdTimer.current = undefined; rowPointer.current = null
  }
  useEffect(() => {
    function release(event: PointerEvent) {
      activePointers.current.delete(event.pointerId)
      if (rowPointer.current?.id === event.pointerId) cancelHold()
    }
    function blur() { cancelHold(); activePointers.current.clear() }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', blur)
    return () => {
      cancelHold()
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', blur)
    }
  }, [])
  useLayoutEffect(() => {
    if (blocked || editingOpen) { cancelHold(); activePointers.current.clear() }
  }, [blocked, editingOpen])
  function attempt(action: () => boolean, field: 'new' | 'edit' | null = null) {
    try {
      if (!action()) {
        setErrorField(field); setError(store.getSnapshot().fileMessage ?? 'No se pudo modificar la entrada.'); return false
      }
      setError(null); setErrorField(null); return true
    }
    catch (error) { setErrorField(field); setError(error instanceof Error ? error.message : 'No se pudo modificar la entrada.'); return false }
  }
  function finishEditing() { restoreList.current = true; setEditing(null); setError(null) }
  function edit(targets: TimelineEntry[]) {
    if (blockedRef.current || !targets.length) return
    cancelHold(); setError(null)
    listScroll.current = list.current?.scrollTop ?? 0
    setEditing(targets.map(entry => ({ entry, text: getTimelineEntryLabel(entry) })))
  }
  useLayoutEffect(() => {
    const node = list.current
    if (!node || editingOpen) return
    const appended = latestId !== previousLatest.current
    const ratio = scale / previousScale.current
    previousLatest.current = latestId
    previousScale.current = scale
    if (restoreList.current) {
      node.scrollTop = listScroll.current * ratio
      restoreList.current = false
      editControl.current?.focus({ preventScroll: true })
    } else if (appended) node.scrollTop = node.scrollHeight
    else if (ratio !== 1) node.scrollTop *= ratio
    // Resizing and text revisions must not navigate the log.
  }, [latestId, scale, editingOpen])

  return <div data-slot="timeline-module" className={`${styles.base} timeline-module`} onPointerDownCapture={event => {
    activePointers.current.add(event.pointerId)
    if (activePointers.current.size > 1) cancelHold()
  }}>
    <div className={`timeline-toolbar ${toolbarStyles.base}`} role="group" aria-label="Acciones de Registro">
      {editing ? <>
        <Button type="submit" form={formId} aria-label="Guardar" disabled={blocked}><Save aria-hidden="true" /></Button>
        <Button aria-label="Atrás" disabled={blocked} onClick={() => { if (!blockedRef.current) finishEditing() }}><ArrowLeft aria-hidden="true" /></Button>
      </> : <>
        <Button ref={editControl} aria-label="Editar" disabled={blocked || !actionEntries.length} onClick={() => edit(actionEntries)}><PenLine aria-hidden="true" /></Button>
        <Button aria-label="Eliminar" disabled={blocked || !actionEntries.length} onClick={() => {
          if (blockedRef.current || !actionEntries.length) return
          cancelHold()
          const ids = actionEntries.map(entry => entry.id)
          const now = new Date().toISOString()
          if (attempt(() => store.applyDocumentCommand(document => applyDocumentCommands(document, ids.map(id => document => deleteTimelineEntry(document, id, now)))))) {
            setCheckedIds(idsBefore => idsBefore.filter(id => !ids.includes(id)))
            if (selectedId && ids.includes(selectedId)) setSelectedId(null)
          }
        }}><Trash aria-hidden="true" /></Button>
        {selectionMode && <div className="timeline-selection-controls">
          <label><Checkbox aria-label="Todos" checked={entries.length > 0 && checked.length === entries.length} disabled={blocked || !entries.length} onCheckedChange={next => {
            if (!blockedRef.current) { cancelHold(); setCheckedIds(next ? entries.map(entry => entry.id) : []) }
          }} />Todos</label>
          <Button aria-label="Salir de selección múltiple" disabled={blocked} onClick={() => {
            if (!blockedRef.current) { cancelHold(); setSelectionMode(false); setCheckedIds([]) }
          }}><X aria-hidden="true" /></Button>
        </div>}
      </>}
    </div>
    <div className="timeline-entries" role="log" aria-label="Entradas cronológicas" ref={list} hidden={editingOpen}>
      <ol>{entries.map(entry => <li key={entry.id} data-entry-type={entry.type} data-current={isCurrentTimelineEntry(document, entry)} data-selected={entry.id === selectedId} data-checked={selectionMode && checkedIds.includes(entry.id)}>
        {selectionMode && <Checkbox aria-label={`Incluir ${getTimelineEntryLabel(entry)} en selección múltiple`} checked={checkedIds.includes(entry.id)} disabled={blocked} onCheckedChange={next => {
          if (!blockedRef.current) setCheckedIds(ids => next ? [...ids.filter(id => id !== entry.id), entry.id] : ids.filter(id => id !== entry.id))
        }} />}
        <Button appearance="integrated" className="timeline-entry-line" aria-label={`Seleccionar ${getTimelineEntryLabel(entry)}`} aria-pressed={entry.id === selectedId} disabled={blocked}
          onClick={() => { if (!blockedRef.current) setSelectedId(entry.id) }}
          onDoubleClick={() => { if (!longPressed.current) edit([entry]) }}
          onContextMenu={event => event.preventDefault()}
          onPointerDown={event => {
            if (blockedRef.current || activePointers.current.size > 1 || event.button !== 0) { cancelHold(); return }
            cancelHold(); longPressed.current = false
            const pointer = { id: event.pointerId, entryId: entry.id, x: event.clientX, y: event.clientY }
            rowPointer.current = pointer
            holdTimer.current = setTimeout(() => {
              holdTimer.current = undefined
              if (blockedRef.current || rowPointer.current !== pointer || activePointers.current.size !== 1 ||
                !store.getSnapshot().document.timeline.some(candidate => candidate.id === entry.id && !isTimelineEntryDeleted(candidate))) return
              longPressed.current = true
              setSelectionMode(true); setSelectedId(entry.id)
              setCheckedIds(ids => ids.includes(entry.id) ? ids : [...ids, entry.id])
            }, 500)
          }} onPointerMove={event => {
            const pointer = rowPointer.current
            if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4) cancelHold()
          }} onPointerUp={event => {
            cancelHold()
            if (longPressed.current && event.pointerType === 'touch') event.preventDefault()
          }} onPointerCancel={cancelHold} onPointerLeave={() => { if (rowPointer.current?.entryId === entry.id) cancelHold() }}>
          <time className="technical-data" dateTime={entry.occurredAt}>{formatTimelineTime(entry.occurredAt)}</time>
          <span className="timeline-text">{getTimelineEntryLabel(entry)}{entry.type === 'status-change' && entry.nextStatus === 'Personalizada' && <span className="timeline-custom-color" aria-hidden="true" style={{ backgroundColor: entry.customColor ?? 'transparent' }} />}</span>
          {isTimelineEntryCorrected(entry) && <Badge variant="outline">Corregida</Badge>}
        </Button>
      </li>)}</ol>
    </div>
    {editing ? <form id={formId} className="timeline-edit" data-minimum-scroll-content aria-label="Editar registros" onSubmit={event => {
      event.preventDefault()
      if (blockedRef.current) return
      const now = new Date().toISOString()
      if (attempt(() => store.applyDocumentCommand(document => applyDocumentCommands(document, editing.map(({ entry, text }) => document => reviseTimelineText(document, entry.id, text, now)))), 'edit')) finishEditing()
    }}>
      {editing.map(({ entry, text }, index) => <div className="timeline-edit-field" key={entry.id}>
        <label htmlFor={`${formId}-${entry.id}`}><time className="technical-data" dateTime={entry.occurredAt}>{formatTimelineTime(entry.occurredAt)}</time>{entry.type === 'status-change' && <span>{entry.unitName} · {entry.nextStatus === 'Personalizada' ? entry.customLabel : entry.nextStatus}</span>}</label>
        <Textarea id={`${formId}-${entry.id}`} aria-label={`Texto del registro ${index + 1}`} aria-invalid={Boolean(error && errorField === 'edit')} autoFocus={index === 0} value={text} disabled={blocked} onChange={event => {
          if (!blockedRef.current) setEditing(current => current?.map(draft => draft.entry.id === entry.id ? { ...draft, text: event.target.value } : draft) ?? null)
        }} />
      </div>)}
    </form> : <form aria-label="Nueva entrada" className="timeline-add" onSubmit={event => {
      event.preventDefault()
      if (blockedRef.current) return
      if (attempt(() => store.applyDocumentCommand(document => addManualTimelineEntry(document, text, new Date())), 'new')) { setText(''); newEntryInput.current?.focus({ preventScroll: true }) }
    }}>
      <div className="timeline-add-field">
        <Input ref={newEntryInput} aria-label="Acontecimiento" aria-invalid={Boolean(error && errorField === 'new')} placeholder="Acontecimiento" value={text} disabled={blocked} onChange={event => setText(event.target.value)} />
      </div>
    </form>}
  </div>
}
