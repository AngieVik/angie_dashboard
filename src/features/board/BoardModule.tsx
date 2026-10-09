import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Image, Line, Circle, Group } from 'react-konva'
import type { PointerEvent } from 'react'
import type { BoardStroke, Position } from '../../domain/document/types'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import type { BoardImageSession } from './useBoardImage'
import type { BoardAction } from './boardTypes'
import { boardReducer, createBoardState } from './boardReducer'
import { getBoardBounds, initialBoardView, toBoardPosition } from './boardViewport'
import { useBoardViewportGestures } from './useBoardViewportGestures'
import { BoardToolbar } from './BoardToolbar'
import { QuickNote } from './QuickNote'
import { findQuickNotePlacement, getQuickNoteObstacles } from './findQuickNotePlacement'
import { BoardPin } from '../elements/BoardPin'
import { updateElement } from '../elements/elementCommands'
import { useViewportInteraction } from '../../layout/ViewportContext'
import './board.css'

function Stroke({ stroke }: { stroke: BoardStroke }) {
  const operation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
  const color = stroke.color ?? '#000000'
  if (stroke.points.length === 1) return <Circle x={stroke.points[0]!.x} y={stroke.points[0]!.y} radius={stroke.width / 2} fill={color} globalCompositeOperation={operation} listening={false} />
  return <Line points={stroke.points.flatMap(point => [point.x, point.y])} stroke={color} strokeWidth={stroke.width}
    lineCap="round" lineJoin="round" globalCompositeOperation={operation} listening={false} />
}

export function BoardModule({ store, imageSession, selectedId = null, onSelect, onViewChange, onOpenModule }: {
  store: DocumentStore; imageSession: BoardImageSession; selectedId?: string | null; onSelect?: (id: string | null) => void
  onViewChange?: (center: Position) => void; onOpenModule?: (id: 'dotations' | 'elements') => void
}) {
  const { document, documentGeneration } = useDocumentStore(store)
  const dismissImageError = imageSession.dismissError
  useEffect(() => () => dismissImageError(), [dismissImageError])
  const { blocked, blockedRef } = useViewportInteraction()
  const [state, setState] = useState(() => createBoardState(document.board))
  const interaction = useRef(state)
  const [color, setColor] = useState('#D63A3A'), [width, setWidth] = useState(4)
  const [focusNote, setFocusNote] = useState<string | null>(null)
  const toolbar = useRef<HTMLDivElement>(null), noteMeasure = useRef<HTMLDivElement>(null)
  function focusTool() { toolbar.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')?.focus() }
  const area = useRef<HTMLDivElement>(null), surface = useRef<HTMLDivElement>(null)
  const pointer = useRef<number | null>(null)
  const emptyPointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState({ scale: 1, offsetX: 0, offsetY: 0 })
  const [explored, setExplored] = useState({ width: 0, height: 0 })
  const previousSize = useRef({ width: 0, height: 0 })
  const contentBounds = getBoardBounds(size, document.board, document.elements, Boolean(imageSession.image))
  const bounds = { ...contentBounds, right: Math.max(contentBounds.right, explored.width), bottom: Math.max(contentBounds.bottom, explored.height) }
  if (bounds.right > explored.width || bounds.bottom > explored.height) {
    setExplored({ width: bounds.right, height: bounds.bottom })
  }
  const navigate = useCallback((next: typeof view) => {
    setView(next)
    setExplored(previous => ({ width: Math.max(previous.width, (size.width - next.offsetX) / next.scale),
      height: Math.max(previous.height, (size.height - next.offsetY) / next.scale) }))
  }, [size])
  const navigation = useBoardViewportGestures(view, size, bounds, navigate, surface)
  useEffect(() => {
    if (size.width && size.height) onViewChange?.({ x: Math.max(0, (size.width / 2 - view.offsetX) / view.scale), y: Math.max(0, (size.height / 2 - view.offsetY) / view.scale) })
  }, [view, size, onViewChange])
  useLayoutEffect(() => {
    if (!area.current) return
    const node = area.current
    function measure() {
      const next = { width: node.clientWidth, height: node.clientHeight }, previous = previousSize.current
      if (!next.width || !next.height || (previous.width === next.width && previous.height === next.height)) return
      const document = store.getSnapshot().document
      setSize(next)
      setView(current => previous.width ? current : initialBoardView(next, document.board, document.elements))
      previousSize.current = next
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [store])
  const dispatch = useCallback((action: BoardAction) => {
    const board = store.getSnapshot().document.board
    const next = boardReducer({ ...interaction.current, board }, action)
    interaction.current = next
    setState(next)
    if (next.board !== board) store.mutateDocument(document => { document.board = next.board })
  }, [store])
  useEffect(() => {
    // The external viewport gesture cancels the stroke and pending empty selection.
    if (blocked) { pointer.current = null; emptyPointer.current = null; dispatch({ type: 'cancel' }) }
  }, [blocked, dispatch])
  function point(event: PointerEvent, clamp = false) {
    const rect = surface.current?.getBoundingClientRect()
    if (!rect?.width) return null
    const position = { x: clamp ? Math.max(rect.left, Math.min(rect.right, event.clientX)) : event.clientX,
      y: clamp ? Math.max(rect.top, Math.min(rect.bottom, event.clientY)) : event.clientY }
    return toBoardPosition(position, rect, view, size)
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (blockedRef.current || event.button !== 0) return
    const position = point(event)
    if (!position) return
    const mode = interaction.current.mode
    const overObject = [...event.currentTarget.querySelectorAll('.board-pin,.quick-note')].some(node => {
      const rect = node.getBoundingClientRect()
      return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
    })
    emptyPointer.current = overObject ? null : { id: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    if (mode === 'select') return
    event.preventDefault()
    pointer.current = event.pointerId
    dispatch({ type: 'start', id: crypto.randomUUID(), point: position, color, width })
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    const empty = emptyPointer.current
    emptyPointer.current = null
    if (pointer.current === event.pointerId) {
      pointer.current = null
      dispatch({ type: blockedRef.current ? 'cancel' : 'finish' })
    }
    if (empty?.id === event.pointerId && !blockedRef.current && Math.hypot(event.clientX - empty.x, event.clientY - empty.y) <= 4) {
      dispatch({ type: 'select-note', id: null }); onSelect?.(null)
    }
  }
  function trackCursor(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch' || blockedRef.current || event.target instanceof Element && event.target.closest('.board-pin,.quick-note')) { setCursor(null); return }
    const rect = surface.current?.getBoundingClientRect()
    if (rect?.width) setCursor({ x: (event.clientX - rect.left) * size.width / rect.width, y: (event.clientY - rect.top) * size.height / rect.height })
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
    const dimensions = { width: 180, height: noteMeasure.current?.offsetHeight || 58 }
    const { position } = findQuickNotePlacement(visible, dimensions, occupied)
    const id = crypto.randomUUID()
    pointer.current = null; emptyPointer.current = null
    dispatch({ type: 'add-note', note: { id, title: '', text: '', scale: 1, position, ...dimensions } })
    onSelect?.(null); setFocusNote(id)
  }
  const image = imageSession.image
  const imageScale = image ? 1000 / Math.max(image.width, image.height) : 1
  const strokes = state.draft && !blocked ? [...document.board.strokes, state.draft] : document.board.strokes
  return <div className="board-module" data-mode={state.mode}>
    <BoardToolbar toolbarRef={toolbar} mode={state.mode} onMode={mode => { pointer.current = null; emptyPointer.current = null; dispatch({ type: 'mode', mode }) }}
      onAddNote={addNote} background={document.board.backgroundColor} onBackground={color => { imageSession.clear(); dispatch({ type: 'background', color }) }}
      color={color} onColor={setColor} width={width} onWidth={setWidth} onClearImage={imageSession.clear} hasImage={Boolean(imageSession.image)} onOpenModule={onOpenModule} onImage={file => { void imageSession.load(file) }} busy={imageSession.busy} blocked={blocked} />
    <div ref={area} className="board-area">
      <div ref={noteMeasure} className="quick-note-measure" aria-hidden="true">
        <div className="quick-note-header" /><textarea rows={1} className="quick-note-text" tabIndex={-1} readOnly />
      </div>
      <div ref={surface} className="board-surface" data-testid="board-surface" data-image-width={image?.width ?? 0} data-image-height={image?.height ?? 0}
        data-extent-width={bounds.right} data-extent-height={bounds.bottom} data-scale={view.scale} data-offset-x={view.offsetX} data-offset-y={view.offsetY} data-viewport-width={size.width} data-viewport-height={size.height}
        {...navigation}
        onPointerDown={event => { trackCursor(event); start(event) }} onPointerMove={event => {
          trackCursor(event)
          const empty = emptyPointer.current
          if (empty?.id === event.pointerId && Math.hypot(event.clientX - empty.x, event.clientY - empty.y) > 4) emptyPointer.current = null
          if (blockedRef.current || pointer.current !== event.pointerId) return
          const position = point(event, true)
          if (position) dispatch({ type: 'point', point: position })
        }} onPointerEnter={trackCursor} onPointerLeave={() => setCursor(null)} onPointerUp={finish} onPointerCancel={() => { pointer.current = null; emptyPointer.current = null; dispatch({ type: 'cancel' }) }}
        onLostPointerCapture={() => { pointer.current = null; emptyPointer.current = null; dispatch({ type: 'cancel' }) }}>
        {cursor && !blocked && (state.mode === 'pen' || state.mode === 'eraser') && <div className="board-tool-cursor" aria-hidden="true" data-tool={state.mode}
          style={{ left: cursor.x, top: cursor.y, width: width * view.scale, height: width * view.scale,
            backgroundColor: state.mode === 'pen' ? color : 'transparent', boxShadow: state.mode === 'eraser' ? 'inset 0 0 0 1px #F2F2F0' : 'none' }} />}
        <Stage width={size.width} height={size.height} listening={false}>
          <Layer listening={false}>
            <Rect width={size.width} height={size.height} fill={document.board.backgroundColor} />
            <Group x={view.offsetX} y={view.offsetY} scaleX={view.scale} scaleY={view.scale}>
              {image && <Image image={image.image} width={image.width * imageScale} height={image.height * imageScale}
                x={(1000 - image.width * imageScale) / 2} y={(1000 - image.height * imageScale) / 2} />}
            </Group>
          </Layer>
          <Layer listening={false} x={view.offsetX} y={view.offsetY} scaleX={view.scale} scaleY={view.scale}>{strokes.map(stroke => <Stroke key={stroke.id} stroke={stroke} />)}</Layer>
        </Stage>
        <div className="board-notes board-pins" style={{ transform: `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.scale})` }}>
          {document.elements.filter(element => element.pinVisible).map(element =>
            <BoardPin key={element.id} element={element} surface={surface} view={view} viewportSize={size} selected={selectedId === element.id} enabled={state.mode === 'select'}
              onSelect={() => { dispatch({ type: 'select-note', id: null }); onSelect?.(element.id) }}
              onMove={position => { if (!blockedRef.current) store.mutateDocument(document => updateElement(document, element.id, { position })) }}
              onScale={scale => {
                if (blockedRef.current) return
                const visual = { ...element.visual, scale }
                store.mutateDocument(document => updateElement(document, element.id, { visual }))
              }} />)}
        </div>
        <div className="board-notes" style={{ transform: `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.scale})` }}>
          {document.board.quickNotes.map(note => <QuickNote key={note.id} note={note} surface={surface} view={view} viewportSize={size} focusBody={focusNote === note.id} selected={state.selectedNoteId === note.id} enabled={state.mode === 'select'}
            onSelect={() => { onSelect?.(null); dispatch({ type: 'select-note', id: note.id }) }} onMove={position => dispatch({ type: 'move-note', id: note.id, position })}
            onResize={factor => dispatch({ type: 'resize-note', id: note.id, factor })}
            onEdit={patch => { if (store.getSnapshot().documentGeneration === documentGeneration) dispatch({ type: 'edit-note', id: note.id, ...patch }) }} onDelete={() => { focusTool(); dispatch({ type: 'delete-note', id: note.id }) }} />)}
        </div>
      </div>
      {imageSession.error && <div className="board-image-error" role="alert">{imageSession.error}</div>}
    </div>
  </div>
}
