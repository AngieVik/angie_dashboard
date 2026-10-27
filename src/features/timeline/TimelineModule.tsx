import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { Check, PenLine, Trash } from 'lucide-react'
import { getTimelineEntryLabel, isTimelineEntryDeleted, isTimelineEntryCorrected, isCurrentTimelineEntry } from '../../domain/operations/timelineProjection'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useModuleZoom } from '../../layout/ModuleZoomContext'
import { addManualTimelineEntry, deleteTimelineEntry, reviseTimelineText, formatTimelineTime, formatTimelineDate } from './timelineCommands'
import styles from './timeline.module.css'

export function TimelineModule({ store }: { store: DocumentStore }) {
  const { document } = useDocumentStore(store)
  const { scale } = useModuleZoom()
  const { blocked, blockedRef } = useViewportInteraction()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [error, setError] = useValidationNotice()
  const errorId = useId()
  const [errorField, setErrorField] = useState<'new' | 'edit' | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const newEntryInput = useRef<HTMLInputElement>(null)
  function attempt(action: () => void, field: 'new' | 'edit' | null = null) {
    try { action(); setError(null); return true }
    catch (error) { setErrorField(field); setError(error instanceof Error ? error.message : 'No se pudo modificar la entrada.'); return false }
  }
  function finishEditing() { newEntryInput.current?.focus(); setEditing(null) }
  useLayoutEffect(() => {
    const node = list.current
    if (!node) return
    const followLatest = () => { node.scrollTop = node.scrollHeight }
    followLatest()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(followLatest)
    observer?.observe(node)
    return () => observer?.disconnect()
  }, [document.timeline, scale])
  return <div data-slot="timeline-module" className={`${styles.base} timeline-module`}>
    <div className="timeline-entries" role="log" aria-label="Entradas cronológicas" ref={list}>
      <ol>{document.timeline.filter(entry => !isTimelineEntryDeleted(entry)).map(entry => <li key={entry.id} data-entry-type={entry.type} data-current={isCurrentTimelineEntry(document, entry)} data-editing={editing?.id === entry.id}>
        <div className="timeline-entry-line">
          <time className="technical-data" dateTime={entry.occurredAt} title={formatTimelineDate(entry.occurredAt)}>{formatTimelineTime(entry.occurredAt)}</time>
          <span className="timeline-text">{getTimelineEntryLabel(entry)}{entry.type === 'status-change' && entry.nextStatus === 'Personalizada' && <span className="timeline-custom-color" aria-hidden="true" style={{ backgroundColor: entry.customColor ?? 'transparent' }} />}</span>
          {isTimelineEntryCorrected(entry) && <Badge variant="outline">Corregida</Badge>}
        </div>
        {editing?.id === entry.id ? <form className="timeline-edit" aria-label="Editar entrada" onSubmit={event => {
          event.preventDefault()
          if (blockedRef.current) return
          if (attempt(() => store.mutateDocument(document => reviseTimelineText(document, entry.id, editing.text, new Date().toISOString())), 'edit')) finishEditing()
        }}>
          {entry.type === 'status-change' && <p className="timeline-edit-context">{entry.unitName} · {entry.nextStatus === 'Personalizada' ? entry.customLabel : entry.nextStatus}</p>}
          <Textarea aria-label="Texto de entrada" aria-invalid={Boolean(error && errorField === 'edit')} aria-describedby={error && errorField === 'edit' ? errorId : undefined} autoFocus value={editing.text} disabled={blocked} onChange={event => setEditing({ ...editing, text: event.target.value })} />
          <div><Button type="submit" disabled={blocked}><Check aria-hidden="true" />Guardar entrada</Button><Button disabled={blocked} onClick={finishEditing}>Cancelar</Button></div>
        </form> : <div className="timeline-entry-actions">
          <Button aria-label="Editar entrada" title="Editar entrada" disabled={blocked} onClick={() => {
            if (!blockedRef.current) setEditing({ id: entry.id, text: getTimelineEntryLabel(entry) })
          }}><PenLine aria-hidden="true" /></Button>
          <Button aria-label="Eliminar entrada" title="Eliminar entrada" disabled={blocked} onClick={() => {
            if (blockedRef.current) return
            if (attempt(() => store.mutateDocument(document => deleteTimelineEntry(document, entry.id)))) finishEditing()
          }}><Trash aria-hidden="true" /></Button>
        </div>}
      </li>)}</ol>
    </div>
    <form aria-label="Nueva entrada" className="timeline-add" onSubmit={event => {
      event.preventDefault()
      if (blockedRef.current) return
      if (attempt(() => store.mutateDocument(document => { addManualTimelineEntry(document, text, new Date()) }), 'new')) { setText(''); newEntryInput.current?.focus() }
    }}>
      <div className="timeline-add-field">
        <Input ref={newEntryInput} aria-label="Acontecimiento" aria-invalid={Boolean(error && errorField === 'new')} aria-describedby={error && errorField === 'new' ? errorId : undefined} placeholder="Acontecimiento" value={text} disabled={blocked} onChange={event => setText(event.target.value)} />
      </div>
    </form>
    {error && <p id={errorId} className="timeline-error" role="alert">{error}</p>}
  </div>
}
