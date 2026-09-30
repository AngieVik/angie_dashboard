import { useState } from 'react'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import type { OperationalStatus } from '../../domain/document/types'
import { OPERATIONAL_STATUSES } from '../../domain/operations/statuses'
import { changeElementStatus } from '../../domain/operations/changeStatus'
import { setUnitNotes } from '../../domain/operations/unitAnnotations'
import { Button } from '../../components/ui/button'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { UnitTags } from './UnitTags'
import './operations.css'

export function OperationsModule({ store, selectedId, onSelect }: { store: DocumentStore; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [expanded, setExpanded] = useState<OperationalStatus | null>(null)
  const selected = document.elements.find(element => element.id === selectedId)
  const unit = selected?.isUnit ? selected : null
  const units = document.elements.filter(element => element.isUnit)
  return <div className="operations-module">
    {unit ? <>
      <p className="operations-unit-name">{unit.name}</p>
      <div className="operations-states" role="group" aria-label="Estado operativo">
        {OPERATIONAL_STATUSES.map(({ status, icon }) => <Button key={status} aria-label={status} aria-pressed={unit.operational.status === status} disabled={blocked}
          onClick={() => {
            if (blockedRef.current) return
            store.mutateDocument(document => Object.assign(document, changeElementStatus(document, unit.id, status, new Date())))
          }}><span aria-hidden="true">{icon}</span> {status}</Button>)}
      </div>
      <label className="operations-notes">Anotación<textarea value={unit.operational.notes} disabled={blocked} onChange={event => {
        if (!blockedRef.current) store.mutateDocument(document => setUnitNotes(document, unit.id, event.target.value))
      }} /></label>
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
            onClick={() => { if (!blockedRef.current) { setExpanded(null); onSelect(unit.id) } }}>{unit.name}</Button>)}</div>}
        </div>
      })}
    </div>}
  </div>
}
