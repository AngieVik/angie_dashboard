import { useRef } from 'react'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { OPERATIONAL_STATUSES } from '../../domain/operations/statuses'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Separator } from '../../components/ui/separator'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { ICON_CATALOG } from '../elements/iconCatalog'
import { Eye, EyeOff } from 'lucide-react'
import './information.css'

export function InformationModule({ store, selectedId, onSelect }: { store: DocumentStore; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const selected = document.elements.find(element => element.id === selectedId)
  const status = selected?.isUnit ? OPERATIONAL_STATUSES.find(item => item.status === selected.operational.status) : null
  const units = document.elements.filter(element => element.isUnit)
  const root = useRef<HTMLDivElement>(null)
  return <div ref={root} className="information-module">
    {selected ? <>
      <div className="information-identity">
        {selected.visual.type === 'asset' ? <img src={ICON_CATALOG[selected.visual.assetId].path} alt="" /> : <span className="information-emoji" aria-hidden="true">{selected.visual.value}</span>}
        <div><strong>{selected.name}</strong><span className="information-pin" aria-label={selected.pinVisible ? 'Pin visible' : 'Pin oculto'}>{selected.pinVisible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}{selected.pinVisible ? 'Pin visible en Pizarra' : 'Pin oculto en Pizarra'}</span></div>
      </div>
      {selected.isUnit && <div className="information-operative">
        <Badge variant="outline" className="information-status" aria-label="Estado operativo">{status ? <><span aria-hidden="true">{status.icon}</span> {status.status}</> : 'Sin estado'}</Badge>
        {status && <><p className="information-phase">Fase: <span>{status.phase}</span></p><p className="information-description">{status.description}</p></>}
      </div>}
      <Separator />
      <div className="information-text">{selected.information}</div>
      {selected.isUnit && <div className="information-tags" aria-label="Etiquetas">{selected.operational.tags.map(tag => <Badge key={tag} className="unit-tag">{tag}</Badge>)}</div>}
    </> : units.length ? <div className="information-units">{units.map(unit => <Button key={unit.id} aria-label={`Seleccionar ${unit.name}`} disabled={blocked}
      onClick={() => {
        if (blockedRef.current) return
        root.current?.closest('.module-frame')?.querySelector<HTMLButtonElement>('.module-close')?.focus()
        onSelect(unit.id)
      }}>{unit.name}</Button>)}</div> : <p className="module-empty">Sin dotaciones</p>}
  </div>
}
