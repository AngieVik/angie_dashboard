import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { OPERATIONAL_STATUSES } from '../../domain/operations/statuses'
import { Button } from '../../components/ui/button'
import { useViewportInteraction } from '../../layout/ViewportContext'
import './information.css'

export function InformationModule({ store, selectedId, onSelect }: { store: DocumentStore; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const selected = document.elements.find(element => element.id === selectedId)
  const units = document.elements.filter(element => element.isUnit)
  return <div className="information-module">
    {selected ? <>
      <div className="information-text">{selected.information}</div>
      {selected.isUnit && <>
        <p className="information-phase">Fase: <span>{OPERATIONAL_STATUSES.find(item => item.status === selected.operational.status)!.phase}</span></p>
        <div className="information-tags" aria-label="Etiquetas">{selected.operational.tags.map(tag => <span key={tag} className="unit-tag">{tag}</span>)}</div>
      </>}
    </> : units.length ? <div className="information-units">{units.map(unit => <Button key={unit.id} aria-label={`Seleccionar ${unit.name}`} disabled={blocked}
      onClick={() => { if (!blockedRef.current) onSelect(unit.id) }}>{unit.name}</Button>)}</div> : <p className="module-empty">Sin dotaciones</p>}
  </div>
}
