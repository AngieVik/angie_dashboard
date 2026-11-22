import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
import { DrawingToolbar, type DrawingTool } from '../drawing/DrawingToolbar'
import { DrawingPanel } from '../drawing/DrawingPanel'
import { ImageTools, type ImageMode, type ImageActions } from '../drawing/DrawingImages'
import { useDrawingTools } from '../drawing/useDrawingTools'
import { drawingMembers, groupVisible } from '../drawing/shapeGeometry'
import { PlanShapes, type PlanSurfaceActions } from './PlanShapes'
import { PlanNotes } from './PlanNotes'
import drawingStyles from '../drawing/drawing.module.css'
import { applyDocumentCommands, commandResult } from '@/domain/document/documentCommand'
import { drawingHistory, recordDrawingEdit, replayDrawingEdit } from '../drawing/drawingHistory'
import type { PlanMode } from './planTypes'
import { updateElement } from '../elements/elementCommands'
import { addPlanStroke, placePlanPin, removePlanPin, togglePlanPin } from './planCommands'
import styles from './plan.module.css'

const EMPTY_PINS: PlanPin[] = []
const EMPTY_STROKES: PlanStroke[] = []
const EMPTY_PLAN = { pins: EMPTY_PINS, strokes: EMPTY_STROKES }
export function PlanModule({ navigationKey, store, selectedId, onSelect, onCoordinateSelect, onEditElement, onNoticesChange }: {
  navigationKey: string
  store: DocumentStore
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCoordinateSelect?: (point: GeographicCoordinate) => void
  onEditElement: (id: string) => void
  onNoticesChange: (source: 'map' | 'plan', notice: MapNotice | null) => void
}) {
  const { document, documentGeneration } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [mode, setMode] = useState<PlanMode>('select')
  const [color, setColor] = useState('#D63A3A')
  const [width, setWidth] = useState(3)
  const tools = useDrawingTools()
  const workspace = useRef<HTMLDivElement>(null), canvas = useRef<PlanSurfaceActions>(null), notes = useRef<{ add: () => void }>(null)
  const [srcPanel, setSrcPanel] = useState<HTMLDivElement | null>(null)
  const imageActions = useRef<ImageActions>(null), [imageMode, setImageMode] = useState<ImageMode>('move')
  const plan: NonNullable<typeof document.plan> = document.plan ?? EMPTY_PLAN
  const visiblePins = useMemo(() => plan.pins.filter(pin => groupVisible(plan, pin.elementId)), [plan])
  const [inkPreview, setInkPreview] = useState<PlanStroke[] | null>(null)
  const visibleStrokes = useMemo(() => ((!blocked && (mode === 'eraser' || mode === 'select') && inkPreview) || plan.strokes).filter(s => groupVisible(plan, s.id)), [plan, blocked, mode, inkPreview])
  const history = drawingHistory(store, 'plan')
  const noticeId = navigationKey + '-plan-notice'
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; toast.dismiss(noticeId) }
  }, [noticeId])
  const pins = document.plan?.pins ?? EMPTY_PINS
  const selected = document.elements.find(element => element.id === selectedId)
  const pin = pins.find(pin => pin.elementId.toLowerCase() === selectedId?.toLowerCase())
  function apply(update: DocumentCommand) {
    const snapshot = store.getSnapshot()
    if (blockedRef.current || !snapshot.ready || snapshot.replacing || snapshot.documentGeneration !== documentGeneration) return false
    try {
      const accepted = recordDrawingEdit(store, 'plan', update)
      if (!accepted) toast.error(store.getSnapshot().fileMessage ?? 'No se pudo actualizar el plano.', { notice: 'planEdit', id: noticeId })
      return accepted
    }
    catch (failure) { toast.error(failure instanceof Error ? failure.message : 'No se pudo actualizar el plano.', { notice: 'planEdit', id: noticeId }); return false }
  }
  function replay(direction: 'undo' | 'redo') {
    if (blockedRef.current) return
    try { replayDrawingEdit(store, 'plan', direction) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo restaurar la edición.', { notice: 'planEdit', id: noticeId }) }
  }
  function activate(next: DrawingTool) {
    if (blockedRef.current) return
    setInkPreview(null); tools.activate(mode, next); setMode(next)
  }
  function change(patch: Partial<typeof plan>) {
    return apply(d => commandResult(d, { ...d, plan: { ...d.plan ?? EMPTY_PLAN, ...patch } }))
  }
  function selectObject(id: string | null) { tools.select(id); onSelect(null) }
  const placed = new Map(plan.pins.map(p => [p.elementId, p.visible]))
  return <div className={`plan-module ${styles.base}`} data-mode={mode}>
    <DrawingToolbar module="plan" mode={mode} settings={tools.settings} panels={tools.panels} toggle={tools.toggle} onMode={activate} replay={replay}
      canUndo={!!history.undo.length} canRedo={!!history.redo.length} color={color} width={width} blocked={blocked} onWidth={setWidth} onColor={setColor} onAddNote={() => notes.current?.add()} />
    <div className={drawingStyles.workspace} ref={workspace}>
    <div className={styles.mapArea} style={tools.panels.length ? { flex: '0 0 ' + tools.panelWidth + '%' } : undefined}>
    <MapModule srcPanel={srcPanel} navigationKey={'plan.' + navigationKey} store={store} onCoordinateSelect={onCoordinateSelect} onNoticesChange={onNoticesChange} noticeSource="plan" overlay={<>
      <PlanPins navigationKey={navigationKey} elements={document.elements} pins={visiblePins} mode={mode} selectedId={selectedId}
        onSelect={id => { tools.select(null); onSelect(id) }} onEdit={onEditElement} onMove={(id, point) => apply(document => placePlanPin(document, id, point))}
        onNameMove={(id, nameOffset) => apply(document => updateElement(document, id, { nameOffset }))}
        onScale={(id, scale) => apply(document => {
          const element = document.elements.find(element => element.id === id)
          if (!element) throw new Error('El recurso ya no existe.')
          return updateElement(document, id, { visual: { ...element.visual, scale } })
        })} />
      <PlanShapes previewInk={setInkPreview} saveInk={change} objects={plan} mode={blocked ? 'blocked' : mode === 'eraser' && tools.settings.eraser ? 'erase-object' : mode} actions={canvas}
        imageMode={imageMode} imageActions={imageActions} saveImages={images => change({ images })} selectImage={id => { selectObject(id); activate('select') }}
        color={color} width={width} fixed={mode === 'circle' ? tools.settings.circle : tools.settings.polyline} selected={tools.selected} select={selectObject}
        change={change} warn={message => toast.error(message, { notice: 'planInput', id: noticeId })} />
      <PlanNotes notes={plan.quickNotes ?? []} enabled={!blocked && mode === 'select'} store={store} generation={documentGeneration} actions={notes}
        selected={tools.selected} select={selectObject} activate={() => activate('select')} save={update => apply(d => {
          const current = d.plan ?? EMPTY_PLAN
          return commandResult(d, { ...d, plan: { ...current, quickNotes: update(d.plan?.quickNotes ?? []) } })
        })} />
      <PlanDrawing navigationKey={navigationKey} mode={mode} color={color} width={width} strokes={visibleStrokes} placeId={selected?.id ?? null}
        onReject={message => toast.error(message, { notice: 'planInput', id: noticeId })}
        onStroke={stroke => apply(document => addPlanStroke(document, stroke))}
        onPlace={(id, point) => { if (apply(document => placePlanPin(document, id, point))) { setMode('select'); onCoordinateSelect?.(point) } }} />
    </>} />
    </div>
    {tools.panels.length > 0 && <DrawingPanel container={workspace} width={tools.panelWidth} setWidth={tools.setPanelWidth} panels={tools.panels} blocked={blocked}
      elements={document.elements} selected={selectedId} placed={placed} select={id => { tools.select(null); onSelect(id) }}
      place={(id, client) => {
        if (placed.has(id)) return
        onSelect(id)
        if (!client) { setMode('place'); return }
        const point = canvas.current?.drop(client)
        if (point && apply(d => placePlanPin(d, id, { latitude: point.y, longitude: point.x }))) setMode('select')
      }} center={id => { const p = pins.find(p => p.elementId === id); if (p) canvas.current?.center({ x: p.longitude, y: p.latitude }) }}
      pins={(ids, visible) => apply(d => applyDocumentCommands(d, ids.filter(id => visible === null || placed.get(id) !== visible).map(id =>
        doc => visible === null ? removePlanPin(doc, id) : togglePlanPin(doc, id))))}
      groups={plan.groups ?? []} saveGroups={groups => change({ groups })} fit={ids => canvas.current?.fit(ids)}
      members={[...document.elements.filter(e => placed.has(e.id)).map(e => ({ id: e.id, name: e.name })), ...drawingMembers(plan)]}
      images={<ImageTools actions={imageActions} selected={!!plan.images?.some(i => i.id === tools.selected)} mode={imageMode}
        setMode={value => { activate('select'); setImageMode(value) }} remove={() => change({ images: plan.images?.filter(i => i.id !== tools.selected) })} />}
      src={<div ref={setSrcPanel} />} />}
    </div>
    {selected && <div className="plan-selection" aria-label="Recurso seleccionado">
      <strong>{selected.name}</strong>
      <span className="technical-data">{pin ? `${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}` : 'Sin ubicación'}</span>
      {selected.isUnit && <span>{selected.operational.status === 'Personalizada' ? selected.operational.notes || 'Personalizada' : selected.operational.status ?? 'Sin estado'}</span>}
      <Button aria-label="Copiar coordenadas del recurso" disabled={blocked || !pin} onClick={async () => {
        if (!pin || blockedRef.current) return
        const copied = await copyText(`${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}`)
        if (!mounted.current || store.getSnapshot().documentGeneration !== documentGeneration) return
        if (!copied) toast.error('No se pudieron copiar las coordenadas.', { notice: 'planCopy', id: noticeId })
      }}><Copy aria-hidden="true" /></Button>
    </div>}
  </div>
}
