import { useState } from 'react'
import { Ambulance, Copy, Eraser, Eye, EyeOff, Focus, Hand, MapPin, MousePointer2, Package, Pencil, Settings2, Trash2, Undo2, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { HelpTooltip } from '../../components/ui/tooltip'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '../../components/ui/alert-dialog'
import { useValidationNotice } from '../../components/ui/useValidationNotice'
import type { AngieDocument, PlanPin, PlanStroke } from '../../domain/document/types'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { copyText } from '../../platform/clipboard'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { MapModule } from '../map/MapModule'
import type { LoadedGpx } from '../map/gpx'
import { PlanDrawing } from './PlanDrawing'
import { PlanPins } from './PlanPins'
import { PlanStrokeControls } from './PlanStrokeControls'
import { updateElement } from '../elements/elementCommands'
import { addPlanStroke, placePlanPin, removePlanPin, removePlanStroke, togglePlanPin } from './planCommands'
import './plan.css'

export type PlanMode = 'navigate' | 'select' | 'draw' | 'erase' | 'place'
const EMPTY_PINS: PlanPin[] = []
const EMPTY_STROKES: PlanStroke[] = []
const MODES = [
  { mode: 'navigate', label: 'Navegar', icon: Hand },
  { mode: 'select', label: 'Seleccionar', icon: MousePointer2 },
  { mode: 'draw', label: 'Dibujar', icon: Pencil },
  { mode: 'erase', label: 'Borrar trazo', icon: Eraser },
] as const

export function PlanModule({ navigationKey, files, onFilesChange, store, selectedId, onSelect, onEditElement, onOpenModule }: {
  navigationKey: string
  files: LoadedGpx[]
  onFilesChange: (files: LoadedGpx[]) => void
  store: DocumentStore
  selectedId: string | null
  onSelect: (id: string | null) => void
  onEditElement: (id: string) => void
  onOpenModule: (id: 'elements' | 'dotations') => void
}) {
  const { document, documentGeneration } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [mode, setMode] = useState<PlanMode>('navigate')
  const [color, setColor] = useState('#D63A3A')
  const [width, setWidth] = useState(3)
  const [focusRequest, setFocusRequest] = useState(0)
  const [clearOpen, setClearOpen] = useState(false)
  const [error, setError] = useValidationNotice(null, documentGeneration, 3000)
  const pins = document.plan?.pins ?? EMPTY_PINS
  const strokes = document.plan?.strokes ?? EMPTY_STROKES
  const selected = document.elements.find(element => element.id === selectedId)
  const pin = pins.find(pin => pin.elementId.toLowerCase() === selectedId?.toLowerCase())
  function apply(update: (document: AngieDocument) => void) {
    const snapshot = store.getSnapshot()
    if (blockedRef.current || !snapshot.ready || snapshot.replacing || snapshot.documentGeneration !== documentGeneration) return false
    try { store.mutateDocument(update); setError(null); return true }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo actualizar el plano.'); return false }
  }
  return <div className="plan-module" data-mode={mode}>
    <div className="plan-toolbar" role="toolbar" aria-label="Herramientas del Plano operativo">
      <div className="plan-tools" role="group" aria-label="Modo del plano">
        {MODES.map(({ mode: tool, label, icon: Icon }) => <HelpTooltip key={tool} text={label}><Button aria-label={label} aria-pressed={mode === tool} disabled={blocked}
          onClick={() => { if (!blockedRef.current) setMode(tool) }}><Icon aria-hidden="true" /></Button></HelpTooltip>)}
        <PlanStrokeControls color={color} width={width} blocked={blocked} onColor={value => { if (!blockedRef.current) setColor(value.toUpperCase()) }}
          onWidth={value => { if (!blockedRef.current) setWidth(value) }} />
        <HelpTooltip text="Deshacer trazo"><Button aria-label="Deshacer último trazo" disabled={blocked || !strokes.length} onClick={() => {
          const last = strokes.at(-1)
          if (last) apply(document => removePlanStroke(document, last.id))
        }}><Undo2 aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Borrar trazos"><Button aria-label="Borrar todos los trazos del plano" disabled={blocked || !strokes.length} onClick={() => { if (!blockedRef.current) setClearOpen(true) }}><Trash2 aria-hidden="true" /></Button></HelpTooltip>
      </div>
      <div className="plan-tools plan-resources" role="group" aria-label="Recursos del plano">
        <select className="plan-resource-select" aria-label="Recurso del plano" value={selected?.id ?? ''} disabled={blocked || !document.elements.length}
          onChange={event => { if (!blockedRef.current) { onSelect(event.target.value || null); setMode('select') } }}>
          <option value="">{document.elements.length ? 'Recursos' : 'Sin recursos'}</option>
          {document.elements.map(element => <option key={element.id} value={element.id}>{element.name}{element.isUnit ? ' · Dotación' : ''}</option>)}
        </select>
        <HelpTooltip text="Colocar pin"><Button aria-label="Colocar recurso en el plano" aria-pressed={mode === 'place'} disabled={blocked || !selected}
          onClick={() => { if (!blockedRef.current) setMode(mode === 'place' ? 'select' : 'place') }}><MapPin aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text={pin?.visible ? 'Ocultar pin' : 'Mostrar pin'}><Button aria-label={pin?.visible ? 'Ocultar pin del plano' : 'Mostrar pin del plano'} disabled={blocked || !pin}
          onClick={() => { if (selectedId) apply(document => togglePlanPin(document, selectedId)) }}>{pin?.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</Button></HelpTooltip>
        <HelpTooltip text="Retirar pin"><Button aria-label="Retirar pin del plano" disabled={blocked || !pin} onClick={() => { if (selectedId) apply(document => removePlanPin(document, selectedId)) }}><X aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Centrar recursos"><Button aria-label="Centrar recursos del plano" disabled={blocked || (selected ? !pin?.visible : !pins.some(pin => pin.visible))} onClick={() => {
          if (blockedRef.current) return
          if (selected) setMode('select')
          setFocusRequest(value => value + 1)
        }}><Focus aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Modificar recurso"><Button aria-label="Modificar recurso" disabled={blocked || !selected} onClick={() => { if (!blockedRef.current && selected) onEditElement(selected.id) }}><Settings2 aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Elementos"><Button aria-label="Abrir Elementos" disabled={blocked} onClick={() => { if (!blockedRef.current) onOpenModule('elements') }}><Package aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Dotaciones"><Button aria-label="Abrir Dotaciones" disabled={blocked} onClick={() => { if (!blockedRef.current) onOpenModule('dotations') }}><Ambulance aria-hidden="true" /></Button></HelpTooltip>
      </div>
    </div>
    {mode === 'place' && selected && <p className="plan-notice" role="status">Colocar: {selected.name}</p>}
    {error && <p className="plan-notice plan-error" role="alert">{error}</p>}
    <MapModule navigationKey={'plan.' + navigationKey} files={files} onFilesChange={onFilesChange} store={store} overlay={<>
      <PlanPins navigationKey={navigationKey} elements={document.elements} pins={pins} mode={mode} selectedId={selectedId}
        focusRequest={focusRequest} onSelect={onSelect} onEdit={onEditElement} onMove={(id, point) => apply(document => placePlanPin(document, id, point))}
        onNameMove={(id, nameOffset) => apply(document => updateElement(document, id, { nameOffset }))}
        onScale={(id, scale) => apply(document => {
          const element = document.elements.find(element => element.id === id)
          if (!element) throw new Error('El recurso ya no existe.')
          updateElement(document, id, { visual: { ...element.visual, scale } })
        })} />
      <PlanDrawing navigationKey={navigationKey} mode={mode} color={color} width={width} strokes={strokes} placeId={selected?.id ?? null}
        onStroke={stroke => apply(document => addPlanStroke(document, stroke))} onErase={id => apply(document => removePlanStroke(document, id))}
        onPlace={(id, point) => { if (apply(document => placePlanPin(document, id, point))) setMode('select') }} />
    </>} />
    {selected && <div className="plan-selection" aria-label="Recurso seleccionado">
      <strong>{selected.name}</strong>
      <span className="technical-data">{pin ? `${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}` : 'Sin ubicación'}</span>
      {selected.isUnit && <span>{selected.operational.status === 'Personalizada' ? selected.operational.notes || 'Personalizada' : selected.operational.status ?? 'Sin estado'}</span>}
      <HelpTooltip text="Copiar coordenadas"><Button aria-label="Copiar coordenadas del recurso" disabled={blocked || !pin} onClick={async () => {
        if (!pin || blockedRef.current) return
        const copied = await copyText(`${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}`)
        if (!copied && store.getSnapshot().documentGeneration === documentGeneration) setError('No se pudieron copiar las coordenadas.')
      }}><Copy aria-hidden="true" /></Button></HelpTooltip>
    </div>}
    <AlertDialog open={clearOpen && !blocked} onOpenChange={setClearOpen}>
      <AlertDialogContent>
        <AlertDialogTitle>Borrar trazos del plano</AlertDialogTitle>
        <AlertDialogDescription>Se eliminarán todos los trazos. Los pines y los GPX se conservarán.</AlertDialogDescription>
        <div className="document-dialog-actions">
          <AlertDialogCancel asChild><Button>Cancelar</Button></AlertDialogCancel>
          <Button onClick={() => { if (apply(document => { if (document.plan) document.plan.strokes = [] })) setClearOpen(false) }}>Borrar trazos</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
