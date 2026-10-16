import { useState } from 'react'
import type { DocumentElement, PlanPin, TimelineEntry } from '../../domain/document/types'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { OPERATIONAL_STATUSES } from '../../domain/operations/statuses'
import { removeUnitTag } from '../../domain/operations/unitAnnotations'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { ICON_CATALOG } from '../elements/iconCatalog'
import { ListChevronsUpDown, ListChevronsDownUp, Eye, EyeOff, X } from 'lucide-react'
import { formatTimelineDate, formatTimelineTime } from '../timeline/timelineCommands'
import './information.css'

export function InformationModule({ store, selectedId, onSelect }: { store: DocumentStore; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { document } = useDocumentStore(store)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const planPins = new Map<string, PlanPin>(document.plan?.pins.map(pin => [pin.elementId.toLowerCase(), pin]))
  return <div className="information-module">
    {document.elements.length ? document.elements.map(element => <InformationCard key={element.id} element={element} planPin={planPins.get(element.id.toLowerCase())} currentEntry={element.isUnit ? document.timeline.find(entry => entry.id.toLowerCase() === element.operational.currentEntryId?.toLowerCase()) : undefined} store={store} selected={element.id === selectedId} onSelect={onSelect} expanded={expandedId === element.id} onToggle={() => setExpandedId(current => current === element.id ? null : element.id)} />) : <p className="module-empty">Sin elementos</p>}
  </div>
}

function InformationCard({ element, planPin, currentEntry, store, selected, onSelect, expanded, onToggle }: { element: DocumentElement; planPin?: PlanPin; currentEntry?: TimelineEntry; store: DocumentStore; selected: boolean; onSelect: (id: string | null) => void; expanded: boolean; onToggle: () => void }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [error, setError] = useState<string | null>(null)
  const status = element.isUnit ? OPERATIONAL_STATUSES.find(item => item.status === element.operational.status) : undefined
  const custom = currentEntry?.type === 'status-change' && currentEntry.nextStatus === 'Personalizada' ? currentEntry : undefined
  const tags = element.isUnit ? element.operational.tags : []
  const hasDetails = Boolean(status || tags.length || element.information.trim())
  return <article className="information-card" aria-label={element.name} data-expanded={expanded} data-selected={selected} data-expandable={hasDetails} onClick={event => {
    if (blockedRef.current || !(event.target instanceof Element) || event.target.closest('button,input,textarea,select,a,[role="button"],[contenteditable="true"]')) return
    onSelect(element.id)
  }}>
    <div className="information-summary">
      <div className="information-identity">
        <Button className="information-select" aria-label={'Seleccionar ' + element.name} aria-pressed={selected} disabled={blocked} onClick={() => { if (!blockedRef.current) onSelect(element.id) }}>
          {element.visual.type === 'asset' ? <img src={ICON_CATALOG[element.visual.assetId].path} alt="" /> : <span className="information-emoji" aria-hidden="true">{element.visual.value}</span>}
          <span className="information-name"><strong>{element.name}</strong><span className="information-pin" aria-label={element.pinVisible ? 'Pin visible' : 'Pin oculto'}>{element.pinVisible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</span></span>
        </Button>
      </div>
      {planPin && <p className="information-coordinates technical-data" aria-label="Coordenadas del Plano operativo">{planPin.latitude.toFixed(6)}, {planPin.longitude.toFixed(6)}</p>}
      {element.isUnit && <div className="information-operative"><Badge variant="outline" className="information-status" aria-label="Estado operativo">
        {custom ? <><span className="information-custom-color" aria-hidden="true" style={{ backgroundColor: custom.customColor ?? 'transparent' }} /><span className="information-custom-name">{custom.customLabel}</span></> : status ? <><span aria-hidden="true">{status.icon}</span> {status.status}</> : 'Sin estado'}
      </Badge>{currentEntry?.type === 'status-change' && element.operational.status !== null && <time className="information-state-time technical-data" aria-label="Hora de entrada al estado" dateTime={currentEntry.occurredAt} title={formatTimelineDate(currentEntry.occurredAt)}>Desde {formatTimelineTime(currentEntry.occurredAt)}</time>}</div>}
      {hasDetails && <Button className="information-expand" aria-label={(expanded ? 'Contraer ' : 'Expandir ') + element.name} aria-expanded={expanded} aria-controls={'information-details-' + element.id} disabled={blocked} onClick={() => { if (!blockedRef.current) { onSelect(element.id); onToggle() } }}>
        {expanded ? <ListChevronsDownUp aria-hidden="true" /> : <ListChevronsUpDown aria-hidden="true" />}
      </Button>}
    </div>
    {hasDetails && <div id={'information-details-' + element.id} className="information-additional" aria-hidden={!expanded} inert={!expanded}>
      <div className="information-details">
        {status && <>
          <p className="information-phase">Fase: <span>{status.phase}</span></p>
          <p className="information-description">{status.description}</p>
        </>}
        {tags.length > 0 && <div className="information-tags" aria-label="Etiquetas">
          {tags.map((tag, index) => <Badge key={tag} className="unit-tag">
            <span>{tag}</span><Button className="unit-tag-remove" aria-label={'Eliminar etiqueta ' + tag} disabled={blocked} onClick={() => {
              if (blockedRef.current) return
              try { store.mutateDocument(document => removeUnitTag(document, element.id, index)); setError(null) }
              catch (error) { setError(error instanceof Error ? error.message : 'No se pudo eliminar la etiqueta.') }
            }}><X aria-hidden="true" /></Button>
          </Badge>)}
        </div>}
        {element.information && <div className="information-text">{element.information}</div>}
      </div>
    </div>}
    {error && <p className="information-error" role="alert">{error}</p>}
  </article>
}
