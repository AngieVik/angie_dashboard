import { useState } from 'react'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { OPERATIONAL_STATUSES } from '../../domain/operations/statuses'
import { changeElementStatus } from '../../domain/operations/changeStatus'
import { setUnitNotes, setUnitNotesColor } from '../../domain/operations/unitAnnotations'
import { Button } from '../../components/ui/button'
import { useValidationNotice } from '../../components/ui/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { UnitTags } from './UnitTags'
import { HelpTooltip } from '../../components/ui/tooltip'
import { Textarea } from '../../components/ui/textarea'
import { useAutoGrowingTextarea } from '../notebook/useAutoGrowingTextarea'
import './operations.css'

export function OperationsModule({ store, selectedId }: { store: DocumentStore; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [error, setError] = useValidationNotice()
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
      </div>
      <UnitNotes key={'notes-' + selectedId} store={store} unitId={unit?.id} notes={unit?.operational.notes ?? ''} color={unit?.operational.notesColor} active={unit?.operational.status === 'Personalizada'} />
      <UnitTags key={'tags-' + selectedId} store={store} unitId={unit?.id} />
    </div>
    {error && <p role="alert">{error}</p>}
  </div>
}

function UnitNotes({ store, unitId, notes, color, active }: { store: DocumentStore; unitId?: string; notes: string; color?: string; active: boolean }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const notesRef = useAutoGrowingTextarea(notes)
  const [error, setError] = useState<string | null>(null)
  function apply() {
    if (blockedRef.current || !unitId) return
    try {
      store.mutateDocument(document => Object.assign(document, changeElementStatus(document, unitId, 'Personalizada', new Date())))
      setError(null)
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo aplicar el estado personalizado.') }
  }
  return <div className="operations-notes" role="button" aria-label="Aplicar estado personalizado" aria-pressed={active} aria-disabled={blocked || !unitId} tabIndex={blocked || !unitId ? undefined : 0}
    onClick={event => { if (event.target instanceof Element && !event.target.closest('input,textarea,label')) apply() }}
    onKeyDown={event => {
      if (event.target instanceof HTMLInputElement) return
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === ' ' && event.target === event.currentTarget) { event.preventDefault(); apply() }
    }}>
    <label className="operations-note-color" style={{ backgroundColor: color ?? 'transparent' }} title="Color de anotación">
      <input type="color" aria-label="Color de anotación" value={color ?? '#d63a3a'} disabled={blocked || !unitId} onChange={event => {
        if (blockedRef.current || !unitId) return
        try { store.mutateDocument(document => setUnitNotesColor(document, unitId, event.target.value)); setError(null) }
        catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cambiar el color.') }
      }} />
    </label>
    <Textarea ref={notesRef} rows={1} aria-label="Anotación" value={notes} disabled={blocked || !unitId} onChange={event => {
      if (!blockedRef.current && unitId) store.mutateDocument(document => setUnitNotes(document, unitId, event.target.value))
    }} />
    {error && <p className="operations-error" role="alert">{error}</p>}
  </div>
}
