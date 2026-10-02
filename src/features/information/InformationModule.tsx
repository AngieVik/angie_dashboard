import { useRef } from 'react'
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
  const status = selected?.isUnit ? OPERATIONAL_STATUSES.find(item => item.status === selected.operational.status)! : null
  const units = document.elements.filter(element => element.isUnit)
  const root = useRef<HTMLDivElement>(null)
  return <div ref={root} className="information-module">
    {selected ? <>
      <div className="information-text">{selected.information}</div>
      {selected.isUnit && <>
        <p className="information-status" aria-label="Estado operativo"><span aria-hidden="true">{status!.icon}</span> {status!.status}</p>
        <p className="information-phase">Fase: <span>{status!.phase}</span></p>
        <div className="information-tags" aria-label="Etiquetas">{selected.operational.tags.map(tag => <span key={tag} className="unit-tag">{tag}</span>)}</div>
      </>}
    </> : units.length ? <div className="information-units">{units.map(unit => <Button key={unit.id} aria-label={`Seleccionar ${unit.name}`} disabled={blocked}
      onClick={() => {
        if (blockedRef.current) return
        root.current?.closest('.module-frame')?.querySelector<HTMLButtonElement>('.module-close')?.focus()
        onSelect(unit.id)
      }}>{unit.name}</Button>)}</div> : <p className="module-empty">Sin dotaciones</p>}
  </div>
}
