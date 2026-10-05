import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Image, Line, Circle, Group } from 'react-konva'
import type { PointerEvent } from 'react'
import type { BoardStroke, Position } from '../../domain/document/types'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import type { BoardImageSession } from './useBoardImage'
import type { BoardAction } from './boardTypes'
import { boardReducer, createBoardState } from './boardReducer'
import { getBoardBounds, initialBoardView, panBoard, toBoardPosition } from './boardViewport'
import { useBoardViewportGestures } from './useBoardViewportGestures'
import { BoardToolbar } from './BoardToolbar'
import { QuickNote } from './QuickNote'
import { BoardPin } from '../elements/BoardPin'
import { updateElement } from '../elements/elementCommands'
import { Button } from '../../components/ui/button'
import { Check, SquareX } from 'lucide-react'
import { WindowResize } from '../../layout/WindowResize'
import { useViewportInteraction } from '../../layout/ViewportContext'
import './board.css'

function Stroke({ stroke }: { stroke: BoardStroke }) {
  const operation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
  const color = stroke.color ?? '#000000'
  if (stroke.points.length === 1) return <Circle x={stroke.points[0]!.x} y={stroke.points[0]!.y} radius={stroke.width / 2} fill={color} globalCompositeOperation={operation} listening={false} />
  return <Line points={stroke.points.flatMap(point => [point.x, point.y])} stroke={color} strokeWidth={stroke.width}
    lineCap="round" lineJoin="round" globalCompositeOperation={operation} listening={false} />
}

export function BoardModule({ store, imageSession, selectedId = null, onSelect, onViewChange }: {
  store: DocumentStore; imageSession: BoardImageSession; selectedId?: string | null; onSelect?: (id: string | null) => void
  onViewChange?: (center: Position) => void
}) {
  const { document } = useDocumentStore(store)
  const dismissImageError = imageSession.dismissError
  useEffect(() => () => dismissImageError(), [dismissImageError])
  const { blocked, blockedRef } = useViewportInteraction()
  const [state, setState] = useState(() => createBoardState(document.board))
  const interaction = useRef(state)
  const [color, setColor] = useState('#D63A3A'), [width, setWidth] = useState(4)
  const [editor, setEditor] = useState<{ id: string | null; position: Position; text: string } | null>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const restoreToolFocus = useRef(false)
  function focusTool() { toolbar.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')?.focus() }
  function finishEditor() { restoreToolFocus.current = true; setEditor(null) }
  useLayoutEffect(() => {
    if (!editor && restoreToolFocus.current) { restoreToolFocus.current = false; focusTool() }
  }, [editor])
  const area = useRef<HTMLDivElement>(null), surface = useRef<HTMLDivElement>(null)
  const pointer = useRef<number | null>(null)
  const emptyPointer = useRef<number | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState({ scale: 1, offsetX: 0, offsetY: 0 })
  const previousSize = useRef({ width: 0, height: 0 })
  const bounds = getBoardBounds(size, document.board, document.elements, Boolean(imageSession.image))
  const navigation = useBoardViewportGestures(view, size, bounds, setView, surface)
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
      setView(current => previous.width ? panBoard({ ...current,
        offsetX: current.offsetX + (next.width - previous.width) / 2, offsetY: current.offsetY + (next.height - previous.height) / 2,
      }, 0, 0, next, getBoardBounds(next, document.board, document.elements)) : initialBoardView(next, document.board, document.elements))
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
    // The external viewport gesture must cancel the draft and editor together.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (blocked) { pointer.current = null; emptyPointer.current = null; dispatch({ type: 'cancel' }); setEditor(null) }
  }, [blocked, dispatch])
  function point(event: PointerEvent, clamp = false) {
    const rect = surface.current?.getBoundingClientRect()
    if (!rect?.width) return null
    const position = { x: clamp ? Math.max(rect.left, Math.min(rect.right, event.clientX)) : event.clientX,
      y: clamp ? Math.max(rect.top, Math.min(rect.bottom, event.clientY)) : event.clientY }
    return toBoardPosition(position, rect, view, size)
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (blockedRef.current || event.button !== 0 || editor) return
    const position = point(event)
    if (!position) return
    const mode = interaction.current.mode
    if (mode === 'note') { event.preventDefault(); setEditor({ id: null, position, text: '' }); return }
    if (mode === 'select') {
      emptyPointer.current = event.pointerId
      event.currentTarget.setPointerCapture?.(event.pointerId)
      return
    }
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointer.current = event.pointerId
    dispatch({ type: 'start', id: crypto.randomUUID(), point: position, color, width })
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    if (emptyPointer.current === event.pointerId) {
      emptyPointer.current = null
      if (!blockedRef.current) { dispatch({ type: 'select-note', id: null }); onSelect?.(null) }
      return
    }
    if (pointer.current !== event.pointerId) return
    pointer.current = null
    dispatch({ type: blockedRef.current ? 'cancel' : 'finish' })
  }
  const image = imageSession.image
  const imageScale = image ? 1000 / Math.max(image.width, image.height) : 1
  const strokes = state.draft && !blocked ? [...document.board.strokes, state.draft] : document.board.strokes
  return <div className="board-module" data-mode={state.mode}>
    <BoardToolbar toolbarRef={toolbar} mode={state.mode} onMode={mode => { pointer.current = null; emptyPointer.current = null; setEditor(null); dispatch({ type: 'mode', mode }) }}
      background={document.board.backgroundColor} onBackground={color => { imageSession.clear(); dispatch({ type: 'background', color }) }}
      color={color} onColor={setColor} width={width} onWidth={setWidth} onImage={file => { void imageSession.load(file) }} busy={imageSession.busy} blocked={blocked} />
    <div ref={area} className="board-area">
      <div ref={surface} className="board-surface" data-testid="board-surface" data-image-width={image?.width ?? 0} data-image-height={image?.height ?? 0}
        data-scale={view.scale} data-offset-x={view.offsetX} data-offset-y={view.offsetY} data-viewport-width={size.width} data-viewport-height={size.height}
        {...navigation}
        onPointerDown={start} onPointerMove={event => {
          if (blockedRef.current || pointer.current !== event.pointerId) return
          const position = point(event, true)
          if (position) dispatch({ type: 'point', point: position })
        }} onPointerUp={finish} onPointerCancel={() => { pointer.current = null; emptyPointer.current = null; dispatch({ type: 'cancel' }) }}
        onLostPointerCapture={() => { pointer.current = null; emptyPointer.current = null; dispatch({ type: 'cancel' }) }}>
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
          {document.board.quickNotes.map(note => <QuickNote key={note.id} note={note} surface={surface} view={view} viewportSize={size} selected={state.selectedNoteId === note.id} enabled={state.mode === 'select'}
            onSelect={() => { onSelect?.(null); dispatch({ type: 'select-note', id: note.id }) }} onMove={position => dispatch({ type: 'move-note', id: note.id, position })}
            onResize={size => dispatch({ type: 'resize-note', id: note.id, size })}
            onEdit={() => setEditor({ id: note.id, position: note.position, text: note.text })} onDelete={() => { focusTool(); dispatch({ type: 'delete-note', id: note.id }) }} />)}
        </div>
      </div>
      {imageSession.error && <div className="board-image-error" role="alert">{imageSession.error}</div>}
      {editor && !blocked && <form className="board-note-editor" aria-label={editor.id ? 'Editar nota rápida' : 'Nueva nota rápida'} onSubmit={event => {
        event.preventDefault()
        if (blockedRef.current) return
        if (editor.id) dispatch({ type: 'edit-note', id: editor.id, text: editor.text })
        else dispatch({ type: 'add-note', note: { id: crypto.randomUUID(), title: '', scale: 1, text: editor.text, position: editor.position, width: 220, height: 96 } })
        finishEditor()
      }}>
        <textarea aria-label="Texto de nota rápida" autoFocus value={editor.text} onChange={event => setEditor({ ...editor, text: event.target.value })} />
        <div><Button type="submit" aria-label={editor.id ? 'Guardar nota' : 'Crear nota'} title={editor.id ? 'Guardar nota' : 'Crear nota'}><Check aria-hidden="true" /></Button><Button aria-label="Cancelar" title="Cancelar" onClick={finishEditor}><SquareX aria-hidden="true" /></Button></div>
        <WindowResize label="Redimensionar editor de nota" />
      </form>}
    </div>
  </div>
}
