import { useLayoutEffect, useRef, useState } from 'react'
import { Check, Pencil } from 'lucide-react'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { OPERATIONAL_STATUSES } from '../../domain/operations/statuses'
import { changeElementStatus } from '../../domain/operations/changeStatus'
import { setUnitNotes, setUnitNotesColor } from '../../domain/operations/unitAnnotations'
import { Button } from '../../components/ui/button'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { UnitTags } from './UnitTags'
import { HelpTooltip } from '../../components/ui/tooltip'
import { Textarea } from '@/components/ui/textarea'
import './operations.css'
import styles from './OperationsModule.module.css'

export function OperationsModule({ store, selectedId }: { store: DocumentStore; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [error, setError] = useValidationNotice(null, 0, 3000)
  const selected = document.elements.find(element => element.id === selectedId)
  const unit = selected?.isUnit ? selected : null
  return <div className="operations-module">
    <div className="operations-cards">
      <div className="operations-states" role="group" aria-label="Estado operativo">
        {OPERATIONAL_STATUSES.map(({ status, icon, phase, abbreviation }) => <HelpTooltip key={status} text={status + ' · Fase: ' + phase}><Button className="document-button operations-state" aria-label={status} aria-pressed={unit?.operational.status === status} disabled={blocked || !unit}
          onClick={() => {
            if (blockedRef.current || !unit || unit.operational.status === status) return
            try {
              store.mutateDocument(document => Object.assign(document, changeElementStatus(document, unit.id, status, new Date())))
              setError(null)
            } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cambiar el estado.') }
          }}><span className="operations-state-icon" aria-hidden="true">{icon}</span><span className="operations-state-name" aria-hidden="true">{status}</span><span className="operations-state-abbr technical-data" aria-hidden="true">{abbreviation}</span></Button></HelpTooltip>)}
        <UnitNotes key="custom-status" store={store} unitId={unit?.id} active={unit?.operational.status === 'Personalizada'} />
        <UnitTags key="unit-tag" store={store} unitId={unit?.id} />
      </div>
    </div>
    {error && <p role="alert">{error}</p>}
  </div>
}

function UnitNotes({ store, unitId, active }: { store: DocumentStore; unitId?: string; active: boolean }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [draftNotes, setDraftNotes] = useState('')
  const [draftColor, setDraftColor] = useState('#d63a3a')
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const editControl = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useValidationNotice(null, 0, 3000)
  useLayoutEffect(() => { if (editing) notesRef.current?.focus() }, [editing, notesRef])
  function apply() {
    if (blockedRef.current || !unitId) return
    try {
      store.mutateDocument(document => {
        setUnitNotes(document, unitId, draftNotes)
        setUnitNotesColor(document, unitId, draftColor)
        Object.assign(document, changeElementStatus(document, unitId, 'Personalizada', new Date()))
      })
      setError(null)
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo aplicar el estado personalizado.') }
  }
  return <div className="operations-notes" data-active={active} data-disabled={blocked || !unitId}>
    <div className="operations-custom-row">
      <label className="operations-note-color" style={{ backgroundColor: draftColor }} title="Color de anotación">
        <input type="color" aria-label="Color de anotación" value={draftColor} disabled={blocked} onChange={event => {
          if (blockedRef.current) return
          setDraftColor(event.target.value); setError(null)
        }} />
      </label>
      <Button className="operations-activate" aria-label="Aplicar estado personalizado" title={draftNotes || 'Personalizado'} aria-pressed={active} hidden={editing} disabled={blocked || !unitId} onClick={apply}><span className="operations-state-name" aria-hidden="true">{draftNotes || 'Personalizado'}</span><span className="operations-state-abbr technical-data" aria-hidden="true">PER</span></Button>
      <Textarea ref={notesRef} className={styles.annotation} rows={1} wrap="off" aria-label="Anotación" placeholder="Personalizado" hidden={!editing} value={draftNotes} disabled={blocked} onKeyDown={event => {
        if (blockedRef.current) return
        if (event.key === 'Escape' || event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault(); setEditing(false); editControl.current?.focus()
        }
      }} onChange={event => {
        if (blockedRef.current) return
        setDraftNotes(event.target.value); setError(null)
      }} />
      <HelpTooltip text={editing ? 'Terminar edición' : 'Editar estado personalizado'}><Button ref={editControl} className="operations-edit" aria-label={editing ? 'Terminar edición del estado personalizado' : 'Editar estado personalizado'} aria-expanded={editing} disabled={blocked} onClick={() => { if (!blockedRef.current) setEditing(value => !value) }}>{editing ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}</Button></HelpTooltip>
    </div>
    {error && <p className="operations-error" role="alert">{error}</p>}
  </div>
}
