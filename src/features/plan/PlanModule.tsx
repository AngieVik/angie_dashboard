import { useEffect, useRef, useState } from 'react'
import { Ambulance, Copy, Eraser, Eye, EyeOff, Focus, Hand, MapPin, MousePointer2, Package, Pencil, Settings2, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { toast } from '@/components/ui/sonner'
import type { PlanPin, PlanStroke } from '../../domain/document/types'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { copyText } from '../../platform/clipboard'
import type { GeographicCoordinate } from '../coordinates/coordinateTypes'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { MapModule } from '../map/MapModule'
import type { MapNotice } from '../map/MapModule'
import type { DocumentCommand } from '../../domain/document/documentCommand'
import { PlanDrawing } from './PlanDrawing'
import { PlanPins } from './PlanPins'
import { PlanStrokeControls } from './PlanStrokeControls'
import type { PlanMode } from './planTypes'
import { updateElement } from '../elements/elementCommands'
import { addPlanStroke, clearPlanStrokes, placePlanPin, removePlanPin, removePlanStroke, togglePlanPin } from './planCommands'
import styles from './plan.module.css'
import toolbarStyles from '@/layout/moduleToolbar.module.css'

const EMPTY_PINS: PlanPin[] = []
const EMPTY_STROKES: PlanStroke[] = []
const MODES = [
  { mode: 'navigate', label: 'Navegar', icon: Hand },
  { mode: 'select', label: 'Seleccionar', icon: MousePointer2 },
  { mode: 'draw', label: 'Dibujar', icon: Pencil },
  { mode: 'erase', label: 'Borrar trazo', icon: Eraser },
] as const

export function PlanModule({ navigationKey, store, selectedId, onSelect, onCoordinateSelect, onEditElement, onOpenModule, onNoticesChange }: {
  navigationKey: string
  store: DocumentStore
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCoordinateSelect?: (point: GeographicCoordinate) => void
  onEditElement: (id: string) => void
  onOpenModule: (id: 'elements' | 'dotations') => void
  onNoticesChange: (source: 'map' | 'plan', notice: MapNotice | null) => void
}) {
  const { document, documentGeneration } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [mode, setMode] = useState<PlanMode>('navigate')
  const [color, setColor] = useState('#D63A3A')
  const [width, setWidth] = useState(3)
  const [focusRequest, setFocusRequest] = useState(0)
  const [clearOpen, setClearOpen] = useState(false)
  const noticeId = navigationKey + '-plan-notice'
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; toast.dismiss(noticeId) }
  }, [noticeId])
  const pins = document.plan?.pins ?? EMPTY_PINS
  const strokes = document.plan?.strokes ?? EMPTY_STROKES
  const selected = document.elements.find(element => element.id === selectedId)
  const pin = pins.find(pin => pin.elementId.toLowerCase() === selectedId?.toLowerCase())
  function apply(update: DocumentCommand) {
    const snapshot = store.getSnapshot()
    if (blockedRef.current || !snapshot.ready || snapshot.replacing || snapshot.documentGeneration !== documentGeneration) return false
    try {
      const accepted = store.applyDocumentCommand(update)
      if (!accepted) toast.error(store.getSnapshot().fileMessage ?? 'No se pudo actualizar el plano.', { id: noticeId })
      return accepted
    }
    catch (failure) { toast.error(failure instanceof Error ? failure.message : 'No se pudo actualizar el plano.', { id: noticeId }); return false }
  }
  return <div className={`plan-module ${styles.base}`} data-mode={mode}>
    <div className={`plan-toolbar ${toolbarStyles.base}`} role="toolbar" aria-label="Herramientas del Plano operativo">
      <div className="plan-tools" role="group" aria-label="Modo del plano">
        {MODES.map(({ mode: tool, label, icon: Icon }) => <Button key={tool} aria-label={label} aria-pressed={mode === tool} disabled={blocked}
          onClick={() => { if (!blockedRef.current) setMode(tool) }}><Icon aria-hidden="true" /></Button>)}
        <PlanStrokeControls color={color} width={width} blocked={blocked} onColor={value => { if (!blockedRef.current) setColor(value.toUpperCase()) }}
          onWidth={value => { if (!blockedRef.current) setWidth(value) }} />
        <Button aria-label="Deshacer último trazo" disabled={blocked || !strokes.length} onClick={() => {
          const last = strokes.at(-1)
          if (last) apply(document => removePlanStroke(document, last.id))
        }}><Undo2 aria-hidden="true" /></Button>
        <Button aria-label="Borrar todos los trazos del plano" disabled={blocked || !strokes.length} onClick={() => { if (!blockedRef.current) setClearOpen(true) }}><Trash2 aria-hidden="true" /></Button>
      </div>
      <div className="plan-tools plan-resources" role="group" aria-label="Recursos del plano">
        <Select className="plan-resource-select" aria-label="Recurso del plano" value={selected?.id ?? ''} disabled={blocked || !document.elements.length}
          onValueChange={value => { if (!blockedRef.current) { onSelect(value || null); setMode('select') } }}
          options={[{ value: '', label: document.elements.length ? 'Recursos' : 'Sin recursos' }, ...document.elements.map(element => ({ value: element.id, label: element.name + (element.isUnit ? ' · Dotación' : '') }))]} />
        <Button aria-label="Colocar recurso en el plano" aria-pressed={mode === 'place'} disabled={blocked || !selected}
          onClick={() => { if (!blockedRef.current) setMode(mode === 'place' ? 'select' : 'place') }}><MapPin aria-hidden="true" /></Button>
        <Button aria-label={pin?.visible ? 'Ocultar pin del plano' : 'Mostrar pin del plano'} disabled={blocked || !pin}
          onClick={() => { if (selectedId) apply(document => togglePlanPin(document, selectedId)) }}>{pin?.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</Button>
        <Button aria-label="Retirar pin del plano" disabled={blocked || !pin} onClick={() => { if (selectedId) apply(document => removePlanPin(document, selectedId)) }}><Trash2 aria-hidden="true" /></Button>
        <Button aria-label="Centrar recursos del plano" disabled={blocked || (selected ? !pin?.visible : !pins.some(pin => pin.visible))} onClick={() => {
          if (blockedRef.current) return
          if (selected) setMode('select')
          setFocusRequest(value => value + 1)
        }}><Focus aria-hidden="true" /></Button>
        <Button aria-label="Modificar recurso" disabled={blocked || !selected} onClick={() => { if (!blockedRef.current && selected) onEditElement(selected.id) }}><Settings2 aria-hidden="true" /></Button>
        <Button aria-label="Abrir Elementos" disabled={blocked} onClick={() => { if (!blockedRef.current) onOpenModule('elements') }}><Package aria-hidden="true" /></Button>
        <Button aria-label="Abrir Dotaciones" disabled={blocked} onClick={() => { if (!blockedRef.current) onOpenModule('dotations') }}><Ambulance aria-hidden="true" /></Button>
      </div>
    </div>
    <MapModule navigationKey={'plan.' + navigationKey} store={store} onCoordinateSelect={onCoordinateSelect} onNoticesChange={onNoticesChange} noticeSource="plan" overlay={<>
      <PlanPins navigationKey={navigationKey} elements={document.elements} pins={pins} mode={mode} selectedId={selectedId}
        focusRequest={focusRequest} onSelect={onSelect} onEdit={onEditElement} onMove={(id, point) => apply(document => placePlanPin(document, id, point))}
        onNameMove={(id, nameOffset) => apply(document => updateElement(document, id, { nameOffset }))}
        onScale={(id, scale) => apply(document => {
          const element = document.elements.find(element => element.id === id)
          if (!element) throw new Error('El recurso ya no existe.')
          return updateElement(document, id, { visual: { ...element.visual, scale } })
        })} />
      <PlanDrawing navigationKey={navigationKey} mode={mode} color={color} width={width} strokes={strokes} placeId={selected?.id ?? null}
        onReject={message => toast.error(message, { id: noticeId })}
        onStroke={stroke => apply(document => addPlanStroke(document, stroke))} onErase={id => apply(document => removePlanStroke(document, id))}
        onPlace={(id, point) => { if (apply(document => placePlanPin(document, id, point))) { setMode('select'); onCoordinateSelect?.(point) } }} />
    </>} />
    {selected && <div className="plan-selection" aria-label="Recurso seleccionado">
      <strong>{selected.name}</strong>
      <span className="technical-data">{pin ? `${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}` : 'Sin ubicación'}</span>
      {selected.isUnit && <span>{selected.operational.status === 'Personalizada' ? selected.operational.notes || 'Personalizada' : selected.operational.status ?? 'Sin estado'}</span>}
      <Button aria-label="Copiar coordenadas del recurso" disabled={blocked || !pin} onClick={async () => {
        if (!pin || blockedRef.current) return
        const copied = await copyText(`${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}`)
        if (!mounted.current || store.getSnapshot().documentGeneration !== documentGeneration) return
        if (!copied) toast.error('No se pudieron copiar las coordenadas.', { id: noticeId })
      }}><Copy aria-hidden="true" /></Button>
    </div>}
    <AlertDialog open={clearOpen && !blocked} onOpenChange={setClearOpen}>
      <AlertDialogContent>
        <AlertDialogTitle>Borrar trazos del plano</AlertDialogTitle>
        <AlertDialogDescription>Los pines y los GPX se conservan.</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel asChild><Button>Cancelar</Button></AlertDialogCancel>
          <Button onClick={() => { if (apply(clearPlanStrokes)) setClearOpen(false) }}>Borrar trazos</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
