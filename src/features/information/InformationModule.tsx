import { useRef, useState } from 'react'
import type { DocumentElement, PlanPin, TimelineEntry } from '../../domain/document/types'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { OPERATIONAL_STATUSES } from '../../domain/operations/statuses'
import { OperationalStatusIcon } from '../operations/OperationalStatusIcon'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { ICON_CATALOG } from '../elements/iconCatalog'
import { ListChevronsUpDown, ListChevronsDownUp, Eye, EyeOff } from 'lucide-react'
import styles from './information.module.css'

export function InformationModule({ store, selectedId, onSelect }: { store: DocumentStore; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { document } = useDocumentStore(store)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [headingHeights, setHeadingHeights] = useState<Record<string, number>>({})
  const root = useRef<HTMLDivElement>(null)
  function toggle(id: string) {
    if (expandedId === id) { setExpandedId(null); setHeadingHeights({}); return }
    // Keep existing summaries in place; details extend the selected card below them.
    setHeadingHeights(Object.fromEntries(Array.from(root.current?.querySelectorAll<HTMLElement>('.information-heading') ?? [])
      .map(heading => [heading.dataset.elementId!, heading.offsetHeight])))
    setExpandedId(id)
  }
  const units = document.elements.filter((element): element is Extract<DocumentElement, { isUnit: true }> => element.isUnit)
  const planPins = new Map<string, PlanPin>(document.plan?.pins.map(pin => [pin.elementId.toLowerCase(), pin]))
  return <div ref={root} data-slot="information-module" className={`${styles.base} information-module`}>
    {units.length ? units.map(element => <InformationCard key={element.id} element={element} planPin={planPins.get(element.id.toLowerCase())} currentEntry={document.timeline.find(entry => entry.id.toLowerCase() === element.operational.currentEntryId?.toLowerCase())} selected={element.id === selectedId} onSelect={onSelect} expanded={expandedId === element.id} headingHeight={expandedId ? headingHeights[element.id] : undefined} onToggle={() => toggle(element.id)} />) : <p className="module-empty">Sin dotaciones</p>}
  </div>
}

function InformationCard({ element, planPin, currentEntry, selected, onSelect, expanded, headingHeight, onToggle }: { element: Extract<DocumentElement, { isUnit: true }>; planPin?: PlanPin; currentEntry?: TimelineEntry; selected: boolean; onSelect: (id: string | null) => void; expanded: boolean; headingHeight?: number; onToggle: () => void }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const status = OPERATIONAL_STATUSES.find(item => item.status === element.operational.status)
  const custom = currentEntry?.type === 'status-change' && currentEntry.nextStatus === 'Personalizada' ? currentEntry : undefined
  const hasDetails = Boolean(status || element.information.trim())
  return <article className="information-card" aria-label={element.name} data-expanded={expanded} data-selected={selected} data-expandable={hasDetails} onClick={event => {
    if (blockedRef.current || !(event.target instanceof Element) || event.target.closest('button,input,textarea,select,a,[role="button"],[contenteditable="true"]')) return
    onSelect(element.id)
  }}>
    <div className="information-heading" data-element-id={element.id} style={{ minHeight: headingHeight }}>
    <div className="information-summary">
      <Button appearance="integrated" className="information-select" aria-label={'Seleccionar ' + element.name} aria-pressed={selected} disabled={blocked} onClick={() => { if (!blockedRef.current) onSelect(element.id) }}>
        {element.visual.type === 'asset' ? <img src={ICON_CATALOG[element.visual.assetId].path} alt="" /> : <span className="information-emoji" aria-hidden="true">{element.visual.value}</span>}
      </Button>
      <strong className="information-name">{element.name}</strong>
      <span className="information-pin" aria-label={element.pinVisible ? 'Pin visible' : 'Pin oculto'}>{element.pinVisible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</span>
      <div className="information-operative"><Badge className="information-status" aria-label="Estado operativo">
        {custom ? <><OperationalStatusIcon color={custom.customColor ?? 'transparent'} /><span className="information-status-name">{custom.customLabel || 'Personalizado'}</span></> : status ? <><OperationalStatusIcon icon={status.icon} /><span className="information-status-name">{status.status}</span></> : <><OperationalStatusIcon /><span className="information-status-name">Sin estado</span></>}
      </Badge></div>
      {hasDetails && <Button className="information-expand" aria-label={(expanded ? 'Contraer ' : 'Expandir ') + element.name} aria-expanded={expanded} aria-controls={'information-details-' + element.id} disabled={blocked} onClick={() => { if (!blockedRef.current) { onSelect(element.id); onToggle() } }}>
        {expanded ? <ListChevronsDownUp aria-hidden="true" /> : <ListChevronsUpDown aria-hidden="true" />}
      </Button>}
    </div>
    {planPin && <p className="information-coordinates technical-data" aria-label="Coordenadas del Plano operativo">{planPin.latitude.toFixed(6)}, {planPin.longitude.toFixed(6)}</p>}
    </div>
    {hasDetails && <div id={'information-details-' + element.id} className="information-additional" hidden={!expanded} aria-hidden={!expanded} inert={!expanded}>
      <div className="information-details">
        {status && <>
          <p className="information-phase">Fase: <span>{status.phase}</span></p>
          <p className="information-description">{status.description}</p>
        </>}
        {element.information && <div className="information-text">{element.information}</div>}
      </div>
    </div>}
  </article>
}
