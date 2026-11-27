import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Image, Line, Circle, Group } from 'react-konva'
import type { PointerEvent, RefObject } from 'react'
import type { BoardStroke, Position } from '../../domain/document/types'
import type { DocumentStore } from '../document/documentStore'
import type { DocumentCommand } from '../../domain/document/documentCommand'
import { replaceBoard } from '../document/documentEdits'
import { useDocumentStore } from '../document/documentStore'
import type { BoardImageSession } from './useBoardImage'
import type { BoardAction } from './boardTypes'
import { boardReducer, createBoardState } from './boardReducer'
import { INPUT_BUDGETS, budgetIssue } from '../../domain/input/inputBudgets'
import { boardDelta, getBoardBounds, zoomBoardAt, toBoardPosition } from './boardViewport'
import { useBoardViewportGestures } from './useBoardViewportGestures'
import { transformBoardImage } from './boardImageGeometry'
import type { BoardImageLayout, ImageAction } from './boardImageGeometry'
import { drawingHistory, recordDrawingEdit, replayDrawingEdit } from '../drawing/drawingHistory'
import { DrawingToolbar, type DrawingTool } from '../drawing/DrawingToolbar'
import { DrawingPanel } from '../drawing/DrawingPanel'
import { SelectionEditor } from '../drawing/SelectionEditor'
import { DrawingImages, ImageTools, type ImageActions, type ImageMode } from '../drawing/DrawingImages'
import { InkSurface } from '../drawing/InkSurface'
import { inkAt, inkReferences, replaceInk } from '../drawing/inkGeometry'
import { ShapeSurface } from '../drawing/ShapeSurface'
import { distance, drawingMembers, groupVisible, type Projection } from '../drawing/shapeGeometry'
import { useDrawingTools } from '../drawing/useDrawingTools'
import drawingStyles from '../drawing/drawing.module.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { applyDocumentCommands } from '@/domain/document/documentCommand'
import { togglePinVisibility } from '../elements/elementCommands'
import { DrawingCursor } from '@/components/DrawingCursor'
import { QuickNote } from './QuickNote'
import { findQuickNotePlacement, getQuickNoteObstacles } from './findQuickNotePlacement'
import { BoardPin } from '../elements/BoardPin'
import { updateElement } from '../elements/elementCommands'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useModuleZoom } from '../../layout/ModuleZoomContext'
import { readNavigation, writeNavigation } from '../../layout/navigationStorage'
import { toast } from '@/components/ui/sonner'
import styles from './board.module.css'
import { Textarea } from '@/components/ui/textarea'
import noteStyles from './QuickNote.module.css'

function Stroke({ stroke }: { stroke: BoardStroke }) {
  const operation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
  const color = stroke.color ?? '#000000'
  if (stroke.points.length === 1) return <Circle x={stroke.points[0]!.x} y={stroke.points[0]!.y} radius={stroke.width / 2} fill={color} globalCompositeOperation={operation} listening={false} />
  return <Line points={stroke.points.flatMap(point => [point.x, point.y])} stroke={color} strokeWidth={stroke.width}
    lineCap="round" lineJoin="round" globalCompositeOperation={operation} listening={false} />
}

export function BoardModule({ store, imageSession, imageInputRef, selectedId = null, onSelect, onEditElement, selectionReset = 0 }: {
  selectionReset?: number; store: DocumentStore; imageSession: BoardImageSession; selectedId?: string | null; onSelect?: (id: string | null) => void
  imageInputRef: RefObject<HTMLInputElement | null>
  onEditElement?: (id: string) => void
}) {
  const { document, documentGeneration } = useDocumentStore(store)
  const dismissImageError = imageSession.dismissError
  const noticeId = 'board-image-' + documentGeneration
  const shownRevision = useRef<number | null>(null)
  useEffect(() => {
    if (imageSession.error && shownRevision.current !== imageSession.noticeRevision) {
      shownRevision.current = imageSession.noticeRevision
      toast.error(imageSession.error, { notice: 'boardImage', id: noticeId })
    }
  }, [imageSession.error, imageSession.noticeRevision, noticeId])
  useEffect(() => () => { dismissImageError(); toast.dismiss(noticeId) }, [dismissImageError, noticeId])
  const { blocked, blockedRef } = useViewportInteraction()
  const [state, setState] = useState(() => createBoardState(document.board))
  const interaction = useRef(state)
  const [color, setColor] = useState('#D63A3A'), [width, setWidth] = useState(4)
  const [focusNote, setFocusNote] = useState<string | null>(null)
  const tools = useDrawingTools()
  const workspace = useRef<HTMLDivElement>(null), imageActions = useRef<ImageActions>(null)
  const [imageMode, setImageMode] = useState<ImageMode>('move')
  const [localPoint, setLocalPoint] = useState<Position | null>(null)
  const [calibration, setCalibration] = useState<Position[]>([]), [meters, setMeters] = useState('')
  const [locate, setLocate] = useState<{ id: string; revision: number } | null>(null)
  const toolbar = useRef<HTMLDivElement>(null), noteMeasure = useRef<HTMLDivElement>(null)
  function focusTool() { toolbar.current?.querySelector<HTMLButtonElement>('[data-board-mode][aria-pressed="true"]')?.focus() }
  const area = useRef<HTMLDivElement>(null), surface = useRef<HTMLDivElement>(null)
  const [inkPreview, setInkPreview] = useState<BoardStroke[] | null>(null)
  const pointer = useRef<number | null>(null)
  const emptyPointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const { scale, changeScale, navigationKey, fitContentRef } = useModuleZoom()
  const canvasKey = navigationKey ? navigationKey + '.canvas' : undefined
  const [view, setView] = useState(() => readNavigation(canvasKey))
  const scaledView = zoomBoardAt(view, scale, { x: 0, y: 0 }, { width: 0, height: 0 }, { left: 0, top: 0, right: 0, bottom: 0 })
  if (view.scale !== scaledView.scale) setView(scaledView)
  useEffect(() => { writeNavigation(canvasKey, view) }, [canvasKey, view])
  const [explored, setExplored] = useState({ width: 0, height: 0 })
  const previousSize = useRef({ width: 0, height: 0 })
  const [imagePreview, setImagePreview] = useState<{ image: typeof imageSession.image; layout: BoardImageLayout } | null>(null)
  if (blocked && imagePreview) setImagePreview(null)
  const imageGesture = useRef<{ id: number; action: ImageAction; origin: Position; initial: BoardImageLayout; result: BoardImageLayout; image: typeof imageSession.image; view: typeof view; size: typeof size; rect: DOMRect } | null>(null)
  const cancelImage = useCallback(() => { imageGesture.current = null; setImagePreview(null) }, [])
  const imageLayout = imagePreview?.image === imageSession.image && !blocked && !imageSession.busy ? imagePreview?.layout ?? imageSession.layout : imageSession.layout
  const imageBounds = imageSession.image && imageLayout ? { right: Math.max(0, imageLayout.x + imageLayout.width), bottom: Math.max(0, imageLayout.y + imageLayout.height) } : { right: 0, bottom: 0 }
  const objectBounds = getBoardBounds({ width: 0, height: 0 }, document.board, document.elements)
  const actualBounds = { ...objectBounds, right: Math.max(objectBounds.right, imageBounds.right), bottom: Math.max(objectBounds.bottom, imageBounds.bottom) }
  useLayoutEffect(() => {
    if (!fitContentRef) return
    const fitContent = () => {
      setView(previous => ({ ...previous, offsetX: 0, offsetY: 0 }))
      return { width: Math.max(320, actualBounds.right * scale, toolbar.current?.scrollWidth ?? 0),
        height: Math.max(220, actualBounds.bottom * scale) + (toolbar.current?.offsetHeight ?? 0) }
    }
    fitContentRef.current = fitContent
    return () => { if (fitContentRef.current === fitContent) fitContentRef.current = null }
  }, [fitContentRef, actualBounds.right, actualBounds.bottom, scale])
  const contentBounds = { ...actualBounds, right: Math.max(size.width, actualBounds.right), bottom: Math.max(size.height, actualBounds.bottom) }
  const bounds = { ...contentBounds, right: Math.max(contentBounds.right, explored.width), bottom: Math.max(contentBounds.bottom, explored.height) }
  if (bounds.right > explored.width || bounds.bottom > explored.height) {
    setExplored({ width: bounds.right, height: bounds.bottom })
  }
  const navigate = useCallback((next: typeof view) => {
    setView(next)
    setExplored(previous => ({ width: Math.max(previous.width, (size.width - next.offsetX) / next.scale),
      height: Math.max(previous.height, (size.height - next.offsetY) / next.scale) }))
  }, [size])
  const navigation = useBoardViewportGestures(view, size, bounds, navigate, surface, state.mode === 'select')
  useLayoutEffect(() => {
    if (!area.current) return
    const node = area.current
    function measure() {
      const next = { width: node.clientWidth, height: node.clientHeight }, previous = previousSize.current
      if (!next.width || !next.height || (previous.width === next.width && previous.height === next.height)) return
      setSize(next)
      previousSize.current = next
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [store])
  const apply = useCallback((command: DocumentCommand) => {
    if (store.getSnapshot().documentGeneration !== documentGeneration) return false
    try {
      if (!recordDrawingEdit(store, 'board', command)) {
        toast.error(store.getSnapshot().fileMessage ?? 'No se pudo modificar la Pizarra.', { notice: 'boardEdit' }); return false
      }
      return true
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo modificar la Pizarra.', { notice: 'boardEdit' }); return false }
  }, [store, documentGeneration])
  const dispatch = useCallback((action: BoardAction) => {
    if (store.getSnapshot().documentGeneration !== documentGeneration) return false
    const board = store.getSnapshot().document.board
    if (action.type === 'point' && (interaction.current.draft?.points.length ?? 0) >= INPUT_BUDGETS.strokePoints) {
      toast.error(budgetIssue(`board.strokes[${board.strokes.length}].points`, INPUT_BUDGETS.strokePoints, 'puntos').message, { notice: 'boardPoints' })
      action = { type: 'cancel' }
    }
    const next = boardReducer({ ...interaction.current, board }, action)
    if (next.board !== board && !apply(document => replaceBoard(document, next.board))) return false
    interaction.current = next
    setState(next)
    return true
  }, [store, documentGeneration, apply])
  useEffect(() => { dispatch({ type: 'select-note', id: null }) }, [selectionReset, dispatch])
  useEffect(() => {
    // The external viewport gesture cancels the stroke and pending empty selection.
    if (blocked) { pointer.current = null; emptyPointer.current = null; imageGesture.current = null; dispatch({ type: 'cancel' }) }
  }, [blocked, dispatch])
  function point(event: PointerEvent, clamp = false) {
    const rect = surface.current?.getBoundingClientRect()
    if (!rect?.width) return null
    const position = { x: clamp ? Math.max(rect.left, Math.min(rect.right, event.clientX)) : event.clientX,
      y: clamp ? Math.max(rect.top, Math.min(rect.bottom, event.clientY)) : event.clientY }
    return toBoardPosition(position, rect, view, size)
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (blockedRef.current || !event.isPrimary || event.button !== 0) return
    const position = point(event)
    if (!position) return
    const mode = interaction.current.mode
    if (mode === 'image' && imageSession.image && imageSession.layout && !imageSession.busy) {
      const action = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-image-action]')?.dataset.imageAction as ImageAction | undefined : undefined
      if (action) {
        event.preventDefault()
        emptyPointer.current = null
        imageGesture.current = { id: event.pointerId, action, origin: { x: event.clientX, y: event.clientY }, initial: imageSession.layout,
          result: imageSession.layout, image: imageSession.image, view, size, rect: event.currentTarget.getBoundingClientRect() }
        event.currentTarget.setPointerCapture?.(event.pointerId)
        return
      }
    }
    const overObject = [...event.currentTarget.querySelectorAll('.board-pin,.quick-note')].some(node => {
      const rect = node.getBoundingClientRect()
      return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
    })
    emptyPointer.current = overObject ? null : { id: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    if (mode !== 'pen') return
    event.preventDefault()
    pointer.current = event.pointerId
    dispatch({ type: 'start', id: crypto.randomUUID(), point: position, color, width })
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    const gesture = imageGesture.current
    if (gesture?.id === event.pointerId) {
      if (!blockedRef.current && gesture.image === imageSession.image && !imageSession.busy) imageSession.updateLayout(gesture.result)
      cancelImage()
      return
    }
    const empty = emptyPointer.current
    emptyPointer.current = null
    if (pointer.current === event.pointerId) {
      pointer.current = null
      dispatch({ type: blockedRef.current ? 'cancel' : 'finish' })
    }
    if (empty?.id === event.pointerId && !blockedRef.current && Math.hypot(event.clientX - empty.x, event.clientY - empty.y) <= 4) {
      if (interaction.current.mode === 'image') dispatch({ type: 'mode', mode: 'select' })
      tools.select(null); dispatch({ type: 'select-note', id: null }); onSelect?.(null)
    }
  }
  function addNote() {
    if (blockedRef.current || !size.width || !size.height) return
    const current = store.getSnapshot().document
    const rect = surface.current?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return
    const clips = [surface.current?.closest('.module-content'), surface.current?.closest('[data-testid="mobile-viewport"]')]
      .flatMap(node => node ? [node.getBoundingClientRect()] : [])
    const left = Math.max(0, rect.left, ...clips.map(clip => clip.left)), top = Math.max(0, rect.top, ...clips.map(clip => clip.top))
    const right = Math.min(window.innerWidth, rect.right, ...clips.map(clip => clip.right)), bottom = Math.min(window.innerHeight, rect.bottom, ...clips.map(clip => clip.bottom))
    const visible = { x: ((left - rect.left) * size.width / rect.width - view.offsetX) / view.scale,
      y: ((top - rect.top) * size.height / rect.height - view.offsetY) / view.scale,
      width: Math.max(0, right - left) * size.width / rect.width / view.scale, height: Math.max(0, bottom - top) * size.height / rect.height / view.scale }
    const occupied = getQuickNoteObstacles(current.board, current.elements, element => {
      const name = surface.current?.querySelector(`[data-element-id="${element.id}"] .board-pin-name`)
      return rect?.width ? (name?.getBoundingClientRect().width ?? 0) * size.width / rect.width / view.scale : 0
    })
    const dimensions = { width: 180, height: noteMeasure.current?.offsetHeight || 32 }
    const { position } = findQuickNotePlacement(visible, dimensions, occupied)
    const id = crypto.randomUUID()
    pointer.current = null; emptyPointer.current = null
    if (!dispatch({ type: 'add-note', note: { id, title: '', text: '', scale: 1, position, ...dimensions } })) return
    onSelect?.(null); setFocusNote(id)
  }
  const history = drawingHistory(store, 'board')
  function replay(direction: 'undo' | 'redo') {
    if (blockedRef.current) return
    pointer.current = null
    dispatch({ type: 'cancel' })
    try { replayDrawingEdit(store, 'board', direction) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo restaurar la edición.', { notice: 'boardEdit' }) }
  }
  useEffect(() => {
    function cancelDrawing(event: KeyboardEvent) {
      if (event.key === 'Escape' && pointer.current !== null) {
        pointer.current = null
        dispatch({ type: 'cancel' })
      }
    }
    window.addEventListener('keydown', cancelDrawing)
    return () => window.removeEventListener('keydown', cancelDrawing)
  }, [dispatch])
  const board = document.board
  const projection: Projection = {
    screen: p => ({ x: p.x * view.scale + view.offsetX, y: p.y * view.scale + view.offsetY }),
    world: p => ({ x: Math.max(0, (p.x - view.offsetX) / view.scale), y: Math.max(0, (p.y - view.offsetY) / view.scale) }),
    pixelsPerUnit: () => view.scale / (board.metersPerUnit ?? 1),
  }
  const change = (patch: Partial<typeof board>) => !blockedRef.current && apply(d => replaceBoard(d, { ...d.board, ...patch }))
  function activate(mode: DrawingTool) {
    cancelImage(); pointer.current = null; emptyPointer.current = null
    setInkPreview(null); tools.activate(state.mode, mode); dispatch({ type: 'mode', mode })
  }
  function selectDrawing(id: string | null) {
    tools.select(id); onSelect?.(null); dispatch({ type: 'select-note', id: null })
  }
  const pins = document.elements.filter(e => e.position)
  const placed = new Map(pins.map(e => [e.id, e.pinVisible]))
  function place(id: string, position: Position) {
    if (placed.has(id) || blockedRef.current) return
    if (apply(d => applyDocumentCommands(d, [doc => updateElement(doc, id, { position }),
      ...(document.elements.find(e => e.id === id)?.pinVisible === false ? [(doc: typeof document) => togglePinVisibility(doc, id)] : [])]))) {
      onSelect?.(id); activate('select')
    }
  }
  function center(p: Position, zoom = view.scale) {
    changeScale?.(zoom)
    navigate({ scale: zoom, offsetX: size.width / 2 - p.x * zoom, offsetY: size.height / 2 - p.y * zoom })
  }
  function fit(ids: string[]) {
    const points = pins.filter(e => ids.includes(e.id)).map(e => e.position!)
    for (const s of board.shapes ?? []) if (ids.includes(s.id)) {
      const r = s.radii, c = s.points[0]!, factor = s.unit === 'world' ? 1 / (board.metersPerUnit ?? 1) : 1 / view.scale
      if (r) points.push({ x: c.x - r.x * factor, y: c.y - r.y * factor }, { x: c.x + r.x * factor, y: c.y + r.y * factor })
      else points.push(...s.points)
    }
    for (const s of board.strokes) if (ids.includes(s.id)) for (const p of s.points) points.push(p)
    if (!points.length) return
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
    for (const p of points) { left = Math.min(left, p.x); right = Math.max(right, p.x); top = Math.min(top, p.y); bottom = Math.max(bottom, p.y) }
    center({ x: (left + right) / 2, y: (top + bottom) / 2 }, Math.max(.25, Math.min(2, (size.width - 32) / Math.max(1, right - left), (size.height - 32) / Math.max(1, bottom - top))))
  }
  const pick = state.mode === 'origin' ? (p: Position) => { if (change({ origin: p })) activate('select') }
    : state.mode === 'calibrate' ? (p: Position) => { if (!calibration.length || distance(calibration[0]!, p) > 0) setCalibration([...calibration.slice(0, 1), p]) }
    : state.mode === 'place' && selectedId ? (p: Position) => place(selectedId, p) : undefined
  const imageSelected = board.images?.some(i => i.id === tools.selected) ?? false
  const editPin = document.elements.find(e => e.id === selectedId)
  const located = pins.find(e => e.id === locate?.id)?.position
  const image = imageSession.image
  const ink = board.strokes.filter(s => s.tool === 'pen' && groupVisible(board, s.id)).map(s => ({ id: s.id, points: s.points, width: s.width * view.scale }))
  const inkMode = state.mode
  const committed = !blocked && (state.mode === 'eraser' || state.mode === 'select') ? inkPreview ?? board.strokes : board.strokes
  const strokes = state.draft && !blocked ? [...committed, state.draft] : committed
  return <div className={`board-module ${styles.base}`} data-mode={state.mode}>
    <DrawingToolbar module="board" toolbarRef={toolbar} mode={state.mode} settings={tools.settings} setOption={tools.setOption} panels={tools.panels} toggle={tools.toggle} onMode={activate}
      canUndo={!!history.undo.length} canRedo={!!history.redo.length} replay={replay} onAddNote={addNote} background={board.backgroundColor}
      onBackground={color => dispatch({ type: 'background', color })} color={color} onColor={setColor} width={width} onWidth={setWidth} blocked={blocked} />
    <input ref={imageInputRef} hidden type="file" accept="image/png,image/jpeg" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void imageSession.load(file) }} />
    <div className={drawingStyles.workspace} ref={workspace}>
    <div ref={area} className="board-area" style={tools.panels.length ? { flex: '0 0 ' + tools.panelWidth + '%' } : undefined}>
      <div ref={noteMeasure} className={`quick-note-measure ${noteStyles.base} ${noteStyles.measurement}`} aria-hidden="true">
        <div className="quick-note-header" /><Textarea rows={1} className="quick-note-text" tabIndex={-1} readOnly />
      </div>
      <div ref={surface} className="board-surface" data-testid="board-surface" data-image-width={image?.width ?? 0} data-image-height={image?.height ?? 0}
        data-image-x={imageLayout?.x ?? 0} data-image-y={imageLayout?.y ?? 0} data-image-display-width={imageLayout?.width ?? 0} data-image-display-height={imageLayout?.height ?? 0}
        data-content-width={actualBounds.right} data-content-height={actualBounds.bottom} data-extent-width={bounds.right} data-extent-height={bounds.bottom} data-scale={view.scale} data-offset-x={view.offsetX} data-offset-y={view.offsetY} data-viewport-width={size.width} data-viewport-height={size.height}
        {...navigation}
        onPointerDown={start} onPointerMove={event => {
          if (tools.panels.includes('src')) setLocalPoint(point(event))
          const gesture = imageGesture.current
          if (gesture?.id === event.pointerId) {
            if (blockedRef.current || gesture.image !== imageSession.image || imageSession.busy) { cancelImage(); return }
            const delta = boardDelta({ x: event.clientX - gesture.origin.x, y: event.clientY - gesture.origin.y }, gesture.rect, gesture.view, gesture.size)
            gesture.result = transformBoardImage(gesture.initial, gesture.action, delta)
            setImagePreview({ image: gesture.image, layout: gesture.result })
            return
          }
          const empty = emptyPointer.current
          if (empty?.id === event.pointerId && Math.hypot(event.clientX - empty.x, event.clientY - empty.y) > 4) emptyPointer.current = null
          if (blockedRef.current || pointer.current !== event.pointerId) return
          const position = point(event, true)
          if (position) dispatch({ type: 'point', point: position })
        }} onPointerUp={finish} onPointerCancel={() => { cancelImage(); pointer.current = null; emptyPointer.current = null; dispatch({ type: 'cancel' }) }}
        onLostPointerCapture={() => { cancelImage(); pointer.current = null; emptyPointer.current = null; dispatch({ type: 'cancel' }) }}>
        {!blocked && state.mode === 'pen' && <DrawingCursor diameter={width * view.scale}
          color={state.mode === 'pen' ? color : undefined} exclude=".board-pin,.quick-note" />}
        <Stage width={size.width} height={size.height} listening={false}>
          <Layer listening={false}>
            <Rect width={size.width} height={size.height} fill={document.board.backgroundColor} />
            <Group x={view.offsetX} y={view.offsetY} scaleX={view.scale} scaleY={view.scale}>
              {image && imageLayout && <Image image={image.image} {...imageLayout} />}
            </Group>
          </Layer>
        </Stage>
        <DrawingImages images={board.images ?? []} actions={imageActions} projection={projection} mode={imageMode} enabled={!blocked && state.mode === 'select'}
          selected={tools.selected} select={id => { selectDrawing(id); activate('select') }} save={images => change({ images })} warn={message => toast.error(message, { notice: 'boardImage' })} />
        <Stage className={drawingStyles.boardInk} width={size.width} height={size.height} listening={false}>
          <Layer listening={false} x={view.offsetX} y={view.offsetY} scaleX={view.scale} scaleY={view.scale}>{strokes.filter(stroke => groupVisible(board, stroke.id)).map(stroke => <Stroke key={stroke.id} stroke={stroke} />)}</Layer>
        </Stage>
        {!blocked && (inkMode === 'select' || inkMode === 'eraser') && <InkSurface key={inkMode} mode={inkMode}
          paths={ink} objects={board} projection={projection} selected={tools.selected} select={selectDrawing}
          preview={changes => setInkPreview(replaceInk(board.strokes, changes, p => p))} clear={() => setInkPreview(null)}
          commit={(changes, delta) => change({ strokes: replaceInk(board.strokes, changes, p => p), ...inkReferences(board, changes, projection, delta) })} />}
        <ShapeSurface suspended={blocked} key={state.mode} mode={state.mode}
          color={color} width={width} fixed={state.mode === 'circle' ? tools.settings.circle : tools.settings.polyline} objects={board} projection={projection}
          ownerVisible={id => placed.get(id) !== false}
          anchorAt={p => pins.findLast(e => e.pinVisible && groupVisible(board, e.id) && distance(projection.screen(e.position!), projection.screen(p)) < 12)?.id ?? inkAt(ink, projection, p)}
          selected={tools.selected} select={selectDrawing} change={change} pick={pick} warn={message => toast.error(message, { notice: 'boardPoints' })} />
        {locate && located && <span key={locate.revision} className={drawingStyles.locate} onAnimationEnd={() => setLocate(null)} style={{ left: projection.screen(located).x, top: projection.screen(located).y }} />}
        {image && imageLayout && state.mode === 'image' && !blocked && !imageSession.busy && <div className="board-image-editor"
          aria-label="Mover imagen de fondo" data-image-action="move"
          style={{ left: view.offsetX + imageLayout.x * view.scale, top: view.offsetY + imageLayout.y * view.scale,
            width: imageLayout.width * view.scale, height: imageLayout.height * view.scale }}>
          {(['nw', 'ne', 'sw', 'se'] as const).map(corner => <button key={corner} type="button" tabIndex={-1}
            className="board-image-resize" data-corner={corner} data-image-action={corner} aria-label={'Redimensionar imagen ' + corner} />)}
        </div>}
        <div className="board-notes board-pins" style={{ transform: `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.scale})` }}>
          {document.elements.filter(element => element.pinVisible && groupVisible(board, element.id)).map(element =>
            <BoardPin key={element.id} element={element} surface={surface} view={view} viewportSize={size} selected={selectedId === element.id} enabled={state.mode === 'select'}
              onSelect={() => { tools.select(null); dispatch({ type: 'select-note', id: null }); onSelect?.(element.id) }}
              onEdit={() => {
                if (blockedRef.current) return
                dispatch({ type: 'select-note', id: null }); onSelect?.(element.id); onEditElement?.(element.id)
              }}
              onMove={position => { if (!blockedRef.current) apply(document => updateElement(document, element.id, { position })) }}
              onNameMove={nameOffset => { if (!blockedRef.current) apply(document => updateElement(document, element.id, { nameOffset })) }}
              onNameColor={nameColor => { if (!blockedRef.current) apply(document => updateElement(document, element.id, { nameColor })) }}
              onScale={scale => {
                if (blockedRef.current) return
                const visual = { ...element.visual, scale }
                apply(document => updateElement(document, element.id, { visual }))
              }} />)}
        </div>
        <div className="board-notes" style={{ transform: `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.scale})` }}>
          {document.board.quickNotes.map(note => <QuickNote key={note.id} note={note} surface={surface} view={view} viewportSize={size} focusBody={focusNote === note.id} selected={state.selectedNoteId === note.id} enabled={state.mode === 'select'}
            onSelect={() => { tools.select(null); onSelect?.(null); dispatch({ type: 'select-note', id: note.id }) }} onMove={position => dispatch({ type: 'move-note', id: note.id, position })}
            onResize={size => dispatch({ type: 'resize-note', id: note.id, size })}
            initialDraft={store.getQuickNoteDraft(note.id, documentGeneration)} onDraftChange={text => store.setQuickNoteDraft(note.id, text, documentGeneration)}
            onEdit={patch => dispatch({ type: 'edit-note', id: note.id, ...patch })} onDelete={() => {
              if (!dispatch({ type: 'delete-note', id: note.id })) return false
              focusTool(); return true
            }} />)}
        </div>
      </div>
    </div>
    {tools.panels.length > 0 && <DrawingPanel container={workspace} width={tools.panelWidth} setWidth={tools.setPanelWidth} panels={tools.panels} blocked={blocked}
      elements={document.elements} placed={placed} selected={selectedId} select={id => { tools.select(null); onSelect?.(id) }}
      place={(id, client) => {
        onSelect?.(id)
        if (!client) { dispatch({ type: 'mode', mode: 'place' }); return }
        const rect = surface.current?.getBoundingClientRect(), position = rect && toBoardPosition(client, rect, view, size)
        if (position) place(id, position)
      }} center={id => { const p = pins.find(e => e.id === id)?.position; if (p) { center(p); setLocate({ id, revision: performance.now() }) } }}
      pins={(ids, visible) => apply(d => applyDocumentCommands(d, ids.map(id => doc => visible === null ? updateElement(doc, id, { position: null })
        : doc.elements.find(e => e.id === id)?.pinVisible === visible ? { document: doc, value: undefined, changed: false } : togglePinVisibility(doc, id))))}
      groups={board.groups ?? []} saveGroups={groups => change({ groups })} fit={fit}
      members={[...pins.map(e => ({ id: e.id, name: e.name })), ...drawingMembers(board)]}
      editor={<><SelectionEditor key={tools.selected ?? state.selectedNoteId ?? selectedId} objects={board} selected={tools.selected ?? state.selectedNoteId} pin={editPin}
        getProjection={() => projection} toPoint={(p: Position) => p} fromPoint={p => p} change={change} clear={() => selectDrawing(null)}
        editPin={() => editPin && onEditElement?.(editPin.id)} modifyPin={visual => editPin && apply(d => updateElement(d, editPin.id, { visual }))}
        removePin={editPin?.position ? () => { if (apply(d => updateElement(d, editPin.id, { position: null }))) selectDrawing(null) } : undefined} />
        <ImageTools actions={imageActions} selected={imageSelected} mode={imageMode} setMode={value => { activate('select'); setImageMode(value) }}
        remove={() => change({ images: board.images?.filter(i => i.id !== tools.selected) })} />
        {image && <><Button onClick={() => dispatch({ type: 'mode', mode: 'image' })}>Mover imagen de fondo</Button><Button onClick={imageSession.clear}>Retirar imagen de fondo</Button></>}</>}
      src={<><Button onClick={() => dispatch({ type: 'mode', mode: 'origin' })}>Fijar origen</Button>
        {board.origin && localPoint && <output>Posición local: {((localPoint.x - board.origin.x) * (board.metersPerUnit ?? 1)).toFixed(2)}, {((board.origin.y - localPoint.y) * (board.metersPerUnit ?? 1)).toFixed(2)} {board.metersPerUnit ? 'm' : 'unidades'}</output>}
        <Button onClick={() => { setCalibration([]); setMeters(''); dispatch({ type: 'mode', mode: 'calibrate' }) }}>Calibrar escala</Button>
        {state.mode === 'calibrate' && (calibration.length < 2 ? <span>{calibration.length ? 'Marca el segundo punto' : 'Marca el primer punto'}</span> :
          <form onSubmit={e => { e.preventDefault(); const value = Number(meters) / distance(calibration[0]!, calibration[1]!); if (value > 0 && Number.isFinite(value) && change({ metersPerUnit: value })) activate('select') }}>
            <label>Distancia real (m)<Input type="number" min="0" step="any" required value={meters} onChange={e => setMeters(e.target.value)} /></label><Button type="submit">Aplicar escala</Button></form>)}
        {board.metersPerUnit && <output>{Number(board.metersPerUnit.toPrecision(6))} m por unidad</output>}</>} />}
    </div>
  </div>
}
