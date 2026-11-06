import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentStore } from '../document/documentStore'
import type { DocumentStore } from '../document/documentStore'
import type { BoardImage } from './boardTypes'
import { replaceBoard } from '../document/documentEdits'
import { clampBoardImagePosition, initialImageLayout } from './boardImageGeometry'
import type { BoardImageLayout } from './boardImageGeometry'
import { loadBoardImage } from './imageLoader'
import { boardImageFile, registerImage, releaseImage } from '../../storage/imageResources'

export function useBoardImage(store: DocumentStore) {
  const { document, documentGeneration } = useDocumentStore(store)
  const saved = document.board.backgroundImage
  const [state, setState] = useState<{ generation: number; noticeRevision: number; image: BoardImage | null; error: string | null; busy: boolean }>({ generation: documentGeneration, noticeRevision: 0, image: null, error: null, busy: false })
  const [resourceError, setResourceError] = useState<{ generation: number; resourceId: string; message: string } | null>(null)
  const resource = useRef<{ generation: number; resourceId: string; image: BoardImage } | null>(null)
  const request = useRef(0)
  const noticeSession = useRef(0)
  const mounted = useRef(false)
  const dismissError = useCallback(() => {
    noticeSession.current++
    setState(previous => previous.error ? { ...previous, error: null } : previous)
  }, [])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; resource.current?.image.dispose(); resource.current = null } }, [])
  const resourceId = saved?.resourceId
  useEffect(() => {
    if (resource.current?.generation === documentGeneration && resource.current.resourceId === resourceId) return
    const sequence = ++request.current
    resource.current?.image.dispose()
    resource.current = null
    setResourceError(null)
    setState({ generation: documentGeneration, noticeRevision: sequence, image: null, error: null, busy: Boolean(resourceId) })
    if (!resourceId) return
    let active = true
    void loadBoardImage(boardImageFile(saved!)).then(result => {
      if (!active || !mounted.current || sequence !== request.current || documentGeneration !== store.getSnapshot().documentGeneration) { if (result.success) result.dispose(); return }
      if (result.success) {
        resource.current = { generation: documentGeneration, resourceId, image: result }
        setState({ generation: documentGeneration, noticeRevision: sequence, image: result, error: null, busy: false })
      } else {
        setResourceError({ generation: documentGeneration, resourceId, message: result.message })
        setState({ generation: documentGeneration, noticeRevision: sequence, image: null, error: null, busy: false })
      }
    })
    return () => { active = false }
  }, [resourceId, saved, documentGeneration, store])
  function clear() {
    const accepted = store.applyDocumentCommand(document => {
      const board = { ...document.board }
      delete board.backgroundImage
      return replaceBoard(document, board)
    })
    if (!accepted) {
      setState(previous => ({ ...previous, error: store.getSnapshot().fileMessage ?? 'No se pudo quitar la imagen.' }))
      return false
    }
    request.current++
    resource.current?.image.dispose()
    resource.current = null
    setResourceError(null)
    setState({ generation: store.getSnapshot().documentGeneration, noticeRevision: request.current, image: null, error: null, busy: false })
    return true
  }
  async function load(file: File) {
    const sequence = ++request.current, generation = store.getSnapshot().documentGeneration
    const noticeGeneration = noticeSession.current
    setState(previous => ({ generation, noticeRevision: sequence, image: previous.generation === generation ? previous.image : null, error: null, busy: true }))
    const result = await loadBoardImage(file)
    if (!mounted.current || sequence !== request.current || generation !== store.getSnapshot().documentGeneration) { if (result.success) result.dispose(); return }
    if (!result.success) { setState(previous => ({ ...previous, error: noticeSession.current === noticeGeneration ? result.message : null, busy: false })); return }
    let source: string | undefined
    try {
      source = await registerImage(file)
      if (!mounted.current || sequence !== request.current || generation !== store.getSnapshot().documentGeneration) {
        if (store.getSnapshot().document.board.backgroundImage?.resourceId !== source) releaseImage(source)
        result.dispose(); return
      }
      const resourceId = source
      const accepted = store.applyDocumentCommand(document => replaceBoard(document, { ...document.board, backgroundImage: { resourceId, layout: initialImageLayout(result.width, result.height) } }))
      if (!accepted) throw new Error(store.getSnapshot().fileMessage ?? 'No se pudo cargar la imagen.')
      resource.current?.image.dispose()
      resource.current = { generation, resourceId: source, image: result }
      setResourceError(null)
      setState({ generation, noticeRevision: sequence, image: result, error: null, busy: false })
      return true
    } catch (error) {
      if (source && store.getSnapshot().document.board.backgroundImage?.resourceId !== source) releaseImage(source)
      result.dispose()
      if (mounted.current && sequence === request.current && generation === store.getSnapshot().documentGeneration) setState(previous => ({ ...previous, busy: false, error: noticeSession.current === noticeGeneration ? error instanceof Error ? error.message : 'No se pudo cargar la imagen.' : null }))
    }
  }
  function updateLayout(layout: BoardImageLayout) {
    if (state.generation !== store.getSnapshot().documentGeneration || !state.image ||
      ![layout.x, layout.y, layout.width, layout.height].every(Number.isFinite) || layout.width <= 0 || layout.height <= 0) return false
    layout = clampBoardImagePosition(layout)
    const accepted = store.applyDocumentCommand(document => replaceBoard(document, document.board.backgroundImage
      ? { ...document.board, backgroundImage: { ...document.board.backgroundImage, layout } } : document.board))
    if (!accepted) setState(previous => ({ ...previous, error: store.getSnapshot().fileMessage ?? 'No se pudo modificar la imagen.' }))
    return accepted
  }
  return { layout: saved ? clampBoardImagePosition(saved.layout) : null, updateLayout, noticeRevision: state.noticeRevision, image: state.generation === documentGeneration ? state.image : null,
    error: state.generation === documentGeneration ? state.error : null,
    resourceError: resourceError?.generation === documentGeneration && resourceError.resourceId === resourceId ? resourceError.message : null,
    busy: state.generation === documentGeneration && state.busy, load, clear, dismissError }
}
export type BoardImageSession = ReturnType<typeof useBoardImage>
