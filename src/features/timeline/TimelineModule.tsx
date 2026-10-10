import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { TimelineEntry } from '../../domain/document/types'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '../../components/ui/alert-dialog'
import { useValidationNotice } from '../../components/ui/useValidationNotice'
import { Check, PenLine, Trash } from 'lucide-react'
import { getTimelineEntryLabel, isTimelineEntryDeleted, isTimelineEntryCorrected, isCurrentTimelineEntry } from '../../domain/operations/timelineProjection'
import { useViewportInteraction } from '../../layout/ViewportContext'
import type { CurrentStatusGuard } from './timelineCommands'
import { addManualTimelineEntry, correctCurrentStatusEntry, deleteTimelineEntry, reviseTimelineText, formatTimelineTime, formatTimelineDate } from './timelineCommands'
import './timeline.css'

type Confirmation = { entryId: string; description: string } & ({ kind: 'delete' } | { kind: 'correction'; expected: CurrentStatusGuard })

export function TimelineModule({ store }: { store: DocumentStore }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string; expected: CurrentStatusGuard | null } | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
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
  function requestConfirmation(entry: TimelineEntry, kind: 'delete' | 'correction') {
    if (blockedRef.current) return
    attempt(() => {
      const candidate = structuredClone(store.getSnapshot().document)
      const now = new Date().toISOString()
      const expected = editing?.expected
      if (kind === 'correction') {
        if (!expected) throw new Error('La entrada dejó de ser Actual. Vuelve a abrir el editor.')
        correctCurrentStatusEntry(candidate, entry.id, expected, now)
      } else deleteTimelineEntry(candidate, entry.id, now)
      const unit = entry.type === 'status-change' ? candidate.elements.find(unit => unit.id.toLowerCase() === entry.unitId.toLowerCase()) : null
      const result = entry.type === 'manual' ? 'Se ocultará este acontecimiento.'
        : unit?.isUnit ? `${unit.name}: ${unit.operational.status ?? 'Sin estado'}.`
        : `${entry.unitName}: dotación eliminada.`
      const description = `${result} ${kind === 'correction' ? 'La entrada permanecerá visible como corregida.' : 'La entrada dejará de mostrarse.'} Se conservará todo su historial.`
      setConfirmation(kind === 'correction' ? { kind, entryId: entry.id, description, expected: expected! } : { kind, entryId: entry.id, description })
    })
  }
  const following = useRef(true)
  const previousIds = useRef(new Set<string>())
  useLayoutEffect(() => {
    const hasNewEntry = document.timeline.some(entry => !previousIds.current.has(entry.id))
    if (hasNewEntry && following.current && list.current) list.current.scrollTop = list.current.scrollHeight
    previousIds.current = new Set(document.timeline.map(entry => entry.id))
  }, [document.timeline])
  return <div className="timeline-module">
    <div className="timeline-entries" role="log" aria-label="Entradas cronológicas" ref={list} onScroll={() => {
      const node = list.current
      if (node) following.current = node.scrollHeight - node.clientHeight - node.scrollTop <= 2
    }}>
      <ol>{document.timeline.filter(entry => !isTimelineEntryDeleted(entry)).map(entry => <li key={entry.id} data-entry-type={entry.type} data-current={isCurrentTimelineEntry(document, entry)} data-editing={editing?.id === entry.id}>
        <div className="timeline-entry-line">
          <time className="technical-data" dateTime={entry.occurredAt} title={formatTimelineDate(entry.occurredAt)}>{formatTimelineTime(entry.occurredAt)}</time>
          <span className="timeline-text">{getTimelineEntryLabel(entry)}</span>
          {isCurrentTimelineEntry(document, entry) && <Badge className="timeline-current">Actual</Badge>}
          {isTimelineEntryCorrected(entry) && <Badge variant="outline">Corregida</Badge>}
        </div>
        {editing?.id === entry.id ? <form className="timeline-edit" aria-label="Editar entrada" onSubmit={event => {
          event.preventDefault()
          if (blockedRef.current) return
          if (attempt(() => store.mutateDocument(document => reviseTimelineText(document, entry.id, editing.text, new Date().toISOString())), 'edit')) finishEditing()
        }}>
          {entry.type === 'status-change' && <p className="timeline-edit-context">{entry.unitName} · {entry.nextStatus}</p>}
          <textarea aria-label="Texto de entrada" aria-invalid={Boolean(error && errorField === 'edit')} aria-describedby={error && errorField === 'edit' ? errorId : undefined} autoFocus value={editing.text} disabled={blocked} onChange={event => setEditing({ ...editing, text: event.target.value })} />
          <div><Button type="submit" disabled={blocked}><Check aria-hidden="true" />Guardar entrada</Button><Button disabled={blocked} onClick={finishEditing}>Cancelar</Button></div>
          {editing.expected && isCurrentTimelineEntry(document, entry) && <Button className="document-button timeline-correct" disabled={blocked} onClick={() => requestConfirmation(entry, 'correction')}>Corregir estado actual</Button>}
        </form> : <div className="timeline-entry-actions">
          <Button aria-label="Editar entrada" title="Editar entrada" disabled={blocked} onClick={() => {
            if (!blockedRef.current) setEditing({ id: entry.id, text: getTimelineEntryLabel(entry), expected: entry.type === 'status-change' && isCurrentTimelineEntry(document, entry) ? { currentEntryId: entry.id, status: entry.nextStatus, revisionCount: entry.revisions.length } : null })
          }}><PenLine aria-hidden="true" /></Button>
          <Button aria-label="Eliminar entrada" title="Eliminar entrada" disabled={blocked} onClick={() => requestConfirmation(entry, 'delete')}><Trash aria-hidden="true" /></Button>
        </div>}
      </li>)}</ol>
    </div>
    <form aria-label="Nueva entrada" className="timeline-add" onSubmit={event => {
      event.preventDefault()
      if (blockedRef.current) return
      if (attempt(() => store.mutateDocument(document => { addManualTimelineEntry(document, text, new Date()) }), 'new')) { setText(''); newEntryInput.current?.focus() }
    }}>
      <Button aria-label="Escribir acontecimiento" title="Escribir acontecimiento" disabled={blocked} onClick={() => { if (!blockedRef.current) newEntryInput.current?.focus() }}><PenLine aria-hidden="true" /></Button>
      <Input ref={newEntryInput} aria-label="Acontecimiento" aria-invalid={Boolean(error && errorField === 'new')} aria-describedby={error && errorField === 'new' ? errorId : undefined} placeholder="Acontecimiento" value={text} disabled={blocked} onChange={event => setText(event.target.value)} />
      <Button type="submit" aria-label="Añadir entrada" title="Añadir entrada" disabled={blocked}><Check aria-hidden="true" /></Button>
    </form>
    {error && <p id={errorId} className="timeline-error" role="alert">{error}</p>}
    <AlertDialog open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null) }}>
      <AlertDialogContent onCloseAutoFocus={event => { event.preventDefault(); newEntryInput.current?.focus() }}>
        <AlertDialogTitle>{confirmation?.kind === 'correction' ? 'Corregir estado actual' : 'Eliminar entrada'}</AlertDialogTitle>
        <AlertDialogDescription>{confirmation?.description}</AlertDialogDescription>
        <div className="timeline-confirm-actions">
          <AlertDialogCancel asChild><Button>Cancelar</Button></AlertDialogCancel>
          <AlertDialogAction asChild><Button disabled={blocked} onClick={event => {
            event.preventDefault()
            if (blockedRef.current || !confirmation) return
            const success = attempt(() => store.mutateDocument(document => {
              const now = new Date().toISOString()
              if (confirmation.kind === 'correction') correctCurrentStatusEntry(document, confirmation.entryId, confirmation.expected, now)
              else deleteTimelineEntry(document, confirmation.entryId, now)
            }))
            setConfirmation(null)
            if (success) finishEditing()
          }}>{confirmation?.kind === 'correction' ? 'Confirmar corrección' : 'Eliminar entrada'}</Button></AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
