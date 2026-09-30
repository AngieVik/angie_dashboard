import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Image, Line, Circle } from 'react-konva'
import type { PointerEvent } from 'react'
import type { BoardStroke, Position } from '../../domain/document/types'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import type { BoardImageSession } from './useBoardImage'
import type { BoardAction } from './boardTypes'
import { boardReducer, createBoardState, fitBoard, toBoardPosition } from './boardReducer'
import { BoardToolbar } from './BoardToolbar'
import { QuickNote } from './QuickNote'
import { BoardPin } from '../elements/BoardPin'
import { updateElement } from '../elements/elementCommands'
import { Button } from '../../components/ui/button'
import { useViewportInteraction } from '../../layout/ViewportContext'
import './board.css'

function Stroke({ stroke }: { stroke: BoardStroke }) {
  const operation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
  const color = stroke.color ?? '#000000'
  if (stroke.points.length === 1) return <Circle x={stroke.points[0]!.x} y={stroke.points[0]!.y} radius={stroke.width / 2} fill={color} globalCompositeOperation={operation} listening={false} />
  return <Line points={stroke.points.flatMap(point => [point.x, point.y])} stroke={color} strokeWidth={stroke.width}
    lineCap="round" lineJoin="round" globalCompositeOperation={operation} listening={false} />
}

export function BoardModule({ store, imageSession, selectedId = null, onSelect }: {
  store: DocumentStore; imageSession: BoardImageSession; selectedId?: string | null; onSelect?: (id: string | null) => void
}) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [state, setState] = useState(() => createBoardState(document.board))
  const interaction = useRef(state)
  const [color, setColor] = useState('#D63A3A'), [width, setWidth] = useState(4)
  const [editor, setEditor] = useState<{ id: string | null; position: Position; text: string } | null>(null)
  const area = useRef<HTMLDivElement>(null), surface = useRef<HTMLDivElement>(null)
  const pointer = useRef<number | null>(null)
  const emptyPointer = useRef<number | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const fitted = fitBoard(size.width, size.height)
  useLayoutEffect(() => {
    if (!area.current || typeof ResizeObserver === 'undefined') return
    const node = area.current
    const observer = new ResizeObserver(() => setSize({ width: node.clientWidth, height: node.clientHeight }))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
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
    if (clamp) return { x: (event.clientX - rect.left) * 1000 / rect.width, y: (event.clientY - rect.top) * 1000 / rect.height }
    return toBoardPosition({ x: event.clientX, y: event.clientY }, rect)
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
    <BoardToolbar mode={state.mode} onMode={mode => { pointer.current = null; emptyPointer.current = null; setEditor(null); dispatch({ type: 'mode', mode }) }}
      background={document.board.backgroundColor} onBackground={color => { imageSession.clear(); dispatch({ type: 'background', color }) }}
      color={color} onColor={setColor} width={width} onWidth={setWidth} onImage={file => { void imageSession.load(file) }} busy={imageSession.busy} blocked={blocked} />
    <div ref={area} className="board-area">
      <div ref={surface} className="board-surface" data-testid="board-surface" data-image-width={image?.width ?? 0} data-image-height={image?.height ?? 0}
        style={{ width: fitted.size, height: fitted.size, left: fitted.left, top: fitted.top }}
        onPointerDown={start} onPointerMove={event => {
          if (blockedRef.current || pointer.current !== event.pointerId) return
          const position = point(event, true)
          if (position) dispatch({ type: 'point', point: position })
        }} onPointerUp={finish} onPointerCancel={() => { pointer.current = null; emptyPointer.current = null; dispatch({ type: 'cancel' }) }}
        onLostPointerCapture={() => { pointer.current = null; emptyPointer.current = null; dispatch({ type: 'cancel' }) }}>
        <Stage width={fitted.size} height={fitted.size} scaleX={fitted.scale} scaleY={fitted.scale} listening={false}>
          <Layer listening={false}>
            <Rect width={1000} height={1000} fill={document.board.backgroundColor} />
            {image && <Image image={image.image} width={image.width * imageScale} height={image.height * imageScale}
              x={(1000 - image.width * imageScale) / 2} y={(1000 - image.height * imageScale) / 2} />}
          </Layer>
          <Layer listening={false}>{strokes.map(stroke => <Stroke key={stroke.id} stroke={stroke} />)}</Layer>
        </Stage>
        <div className="board-notes board-pins" style={{ transform: `scale(${fitted.scale})` }}>
          {document.elements.filter(element => !element.isUnit || document.filters.visibleStatuses.includes(element.operational.status)).map(element =>
            <BoardPin key={element.id} element={element} surface={surface} selected={selectedId === element.id} enabled={state.mode === 'select'}
              onSelect={() => { dispatch({ type: 'select-note', id: null }); onSelect?.(element.id) }}
              onMove={position => { if (!blockedRef.current) store.mutateDocument(document => updateElement(document, element.id, { position })) }}
              onScale={scale => {
                if (blockedRef.current || element.visual.type !== 'asset') return
                const visual = { ...element.visual, scale }
                store.mutateDocument(document => updateElement(document, element.id, { visual }))
              }} />)}
        </div>
        <div className="board-notes" style={{ transform: `scale(${fitted.scale})` }}>
          {document.board.quickNotes.map(note => <QuickNote key={note.id} note={note} surface={surface} selected={state.selectedNoteId === note.id} enabled={state.mode === 'select'}
            onSelect={() => { onSelect?.(null); dispatch({ type: 'select-note', id: note.id }) }} onMove={position => dispatch({ type: 'move-note', id: note.id, position })}
            onEdit={() => setEditor({ id: note.id, position: note.position, text: note.text })} onDelete={() => dispatch({ type: 'delete-note', id: note.id })} />)}
        </div>
      </div>
      {imageSession.error && <div className="board-image-error" role="alert">{imageSession.error}</div>}
      {editor && !blocked && <form className="board-note-editor" aria-label={editor.id ? 'Editar nota rápida' : 'Nueva nota rápida'} onSubmit={event => {
        event.preventDefault()
        if (blockedRef.current) return
        if (editor.id) dispatch({ type: 'edit-note', id: editor.id, text: editor.text })
        else dispatch({ type: 'add-note', note: { id: crypto.randomUUID(), text: editor.text, position: editor.position } })
        setEditor(null)
      }}>
        <textarea aria-label="Texto de nota rápida" autoFocus value={editor.text} onChange={event => setEditor({ ...editor, text: event.target.value })} />
        <div><Button type="submit">{editor.id ? 'Guardar nota' : 'Crear nota'}</Button><Button onClick={() => setEditor(null)}>Cancelar</Button></div>
      </form>}
    </div>
  </div>
}
