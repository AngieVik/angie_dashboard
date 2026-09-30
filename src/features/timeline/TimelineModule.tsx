import { useLayoutEffect, useRef, useState } from 'react'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { OPERATIONAL_STATUSES } from '../../domain/operations/statuses'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { addManualTimelineEntry, canUndoAutomaticTimelineEntry, deleteManualTimelineEntry, editManualTimelineEntry, formatTimelineTime, formatTimelineDate, undoAutomaticTimelineEntry } from './timelineCommands'
import './timeline.css'

export function TimelineModule({ store }: { store: DocumentStore }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const list = useRef<HTMLDivElement>(null)
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
      <ol>{document.timeline.map(entry => <li key={entry.id} data-entry-type={entry.type}>
        <div className="timeline-entry-line">
          <time className="technical-data" dateTime={entry.occurredAt} title={formatTimelineDate(entry.occurredAt)}>{formatTimelineTime(entry.occurredAt)}</time>
          <span aria-hidden="true"> · </span>
          {entry.type === 'manual' ? <span className="timeline-text">{entry.text}</span> : <span className="timeline-text">{entry.unitName} · {entry.previousStatus} {OPERATIONAL_STATUSES.find(item => item.status === entry.previousStatus)!.icon} → {entry.nextStatus} {OPERATIONAL_STATUSES.find(item => item.status === entry.nextStatus)!.icon}</span>}
        </div>
        {entry.type === 'manual' ? editing?.id === entry.id ? <form className="timeline-edit" aria-label="Editar entrada" onSubmit={event => {
          event.preventDefault()
          if (blockedRef.current) return
          store.mutateDocument(document => editManualTimelineEntry(document, entry.id, editing.text))
          setEditing(null)
        }}>
          <textarea aria-label="Texto de entrada" autoFocus value={editing.text} disabled={blocked} onChange={event => setEditing({ id: entry.id, text: event.target.value })} />
          <div><Button type="submit" disabled={blocked}>Guardar entrada</Button><Button disabled={blocked} onClick={() => setEditing(null)}>Cancelar</Button></div>
        </form> : <div className="timeline-entry-actions">
          <Button aria-label="Editar entrada" title="Editar entrada" disabled={blocked} onClick={() => { if (!blockedRef.current) setEditing({ id: entry.id, text: entry.text }) }}>✎</Button>
          <Button aria-label="Eliminar entrada" title="Eliminar entrada" disabled={blocked} onClick={() => {
            if (!blockedRef.current) store.mutateDocument(document => deleteManualTimelineEntry(document, entry.id))
          }}>×</Button>
        </div> : canUndoAutomaticTimelineEntry(document, entry.id) && <div className="timeline-entry-actions"><Button disabled={blocked} onClick={() => {
          if (blockedRef.current) return
          store.mutateDocument(document => {
            const result = undoAutomaticTimelineEntry(document, entry.id)
            if (result.success) { Object.assign(document, result.document); setError(null) }
            else setError(result.message)
          })
        }}>Deshacer</Button></div>}
      </li>)}</ol>
    </div>
    <form aria-label="Nueva entrada" className="timeline-add" onSubmit={event => {
      event.preventDefault()
      if (blockedRef.current) return
      store.mutateDocument(document => { addManualTimelineEntry(document, text, new Date()) })
      setText('')
    }}>
      <Input aria-label="Acontecimiento" placeholder="Acontecimiento" value={text} disabled={blocked} onChange={event => setText(event.target.value)} />
      <Button type="submit" aria-label="Añadir entrada" title="Añadir entrada" disabled={blocked}>+</Button>
    </form>
    {error && <p className="timeline-error" role="alert">{error}</p>}
  </div>
}
