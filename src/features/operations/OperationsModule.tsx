import { useLayoutEffect, useRef, useState } from 'react'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import type { OperationalStatus } from '../../domain/document/types'
import { OPERATIONAL_STATUSES } from '../../domain/operations/statuses'
import { changeElementStatus } from '../../domain/operations/changeStatus'
import { setUnitNotes } from '../../domain/operations/unitAnnotations'
import { Button } from '../../components/ui/button'
import { useValidationNotice } from '../../components/ui/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { UnitTags } from './UnitTags'
import { HelpTooltip } from '../../components/ui/tooltip'
import { Textarea } from '../../components/ui/textarea'
import { useAutoGrowingTextarea } from '../notebook/useAutoGrowingTextarea'
import './operations.css'

export function OperationsModule({ store, selectedId, onSelect }: { store: DocumentStore; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [expanded, setExpanded] = useState<OperationalStatus | null>(null)
  const [error, setError] = useValidationNotice()
  const selectionFocusPending = useRef(false)
  const selectedStateControl = useRef<HTMLButtonElement>(null)
  const selected = document.elements.find(element => element.id === selectedId)
  const unit = selected?.isUnit ? selected : null
  useLayoutEffect(() => {
    if (selectionFocusPending.current && unit) { selectionFocusPending.current = false; selectedStateControl.current?.focus() }
  }, [unit])
  const units = document.elements.filter(element => element.isUnit)
  return <div className="operations-module">
    {unit ? <>
      <p className="operations-unit-name">{unit.name}</p>
      <div className="operations-states" role="group" aria-label="Estado operativo">
        {OPERATIONAL_STATUSES.map(({ status, icon, phase, abbreviation }) => <HelpTooltip key={status} text={`${status} · Fase: ${phase}`}><Button ref={unit.operational.status === status ? selectedStateControl : undefined} aria-label={status} aria-pressed={unit.operational.status === status} disabled={blocked}
          onClick={() => {
            if (blockedRef.current || unit.operational.status === status) return
            try {
              store.mutateDocument(document => Object.assign(document, changeElementStatus(document, unit.id, status, new Date())))
              setError(null)
            } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cambiar el estado.') }
          }}><span className="operations-state-icon" aria-hidden="true">{icon}</span><span className="operations-state-name" aria-hidden="true">{status}</span><span className="operations-state-abbr technical-data" aria-hidden="true">{abbreviation}</span></Button></HelpTooltip>)}
      </div>
      <UnitNotes key={unit.id} store={store} unitId={unit.id} notes={unit.operational.notes} />
      <UnitTags key={unit.id} store={store} unitId={unit.id} tags={unit.operational.tags} />
    </> : <div className="operations-counters">
      {OPERATIONAL_STATUSES.map(({ status, icon }) => {
        const matching = units.filter(unit => unit.operational.status === status)
        if (!matching.length) return null
        return <div key={status}>
          <Button className="document-button operations-counter" aria-expanded={expanded === status} disabled={blocked} onClick={() => {
            if (!blockedRef.current) setExpanded(expanded === status ? null : status)
          }}>{icon} <span className="technical-data">{matching.length}</span> {status}</Button>
          {expanded === status && <div className="operations-matching">{matching.map(unit => <Button key={unit.id} aria-label={`Seleccionar ${unit.name}`} disabled={blocked}
            onClick={() => { if (!blockedRef.current) { selectionFocusPending.current = true; setExpanded(null); onSelect(unit.id) } }}>{unit.name}</Button>)}</div>}
        </div>
      })}
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>
}

function UnitNotes({ store, unitId, notes }: { store: DocumentStore; unitId: string; notes: string }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const notesRef = useAutoGrowingTextarea(notes)
  return <div className="operations-notes"><Textarea ref={notesRef} rows={1} aria-label="Anotación" placeholder="anotación" value={notes} disabled={blocked} onChange={event => {
    if (!blockedRef.current) store.mutateDocument(document => setUnitNotes(document, unitId, event.target.value))
  }} /></div>
}
