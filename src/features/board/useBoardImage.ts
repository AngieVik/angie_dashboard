import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentStore } from '../document/documentStore'
import type { DocumentStore } from '../document/documentStore'
import type { BoardImage } from './boardTypes'
import { loadBoardImage } from './imageLoader'

export function useBoardImage(store: DocumentStore) {
  const { documentGeneration } = useDocumentStore(store)
  const [state, setState] = useState<{ generation: number; noticeRevision: number; image: BoardImage | null; error: string | null; busy: boolean }>({ generation: documentGeneration, noticeRevision: 0, image: null, error: null, busy: false })
  const resource = useRef<{ generation: number; image: BoardImage } | null>(null)
  const request = useRef(0)
  const noticeSession = useRef(0)
  const mounted = useRef(false)
  const dismissError = useCallback(() => {
    noticeSession.current++
    setState(previous => previous.error ? { ...previous, error: null } : previous)
  }, [])
  useEffect(() => {
    if (!state.error || state.generation !== documentGeneration) return
    const timer = setTimeout(dismissError, 5000)
    return () => clearTimeout(timer)
  }, [state.error, state.noticeRevision, state.generation, documentGeneration, dismissError])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => () => {
    if (resource.current?.generation === documentGeneration) {
      resource.current.image.dispose()
      resource.current = null
    }
  }, [documentGeneration])
  function clear() {
    request.current++
    resource.current?.image.dispose()
    resource.current = null
    setState({ generation: store.getSnapshot().documentGeneration, noticeRevision: request.current, image: null, error: null, busy: false })
  }
  async function load(file: File) {
    const sequence = ++request.current, generation = store.getSnapshot().documentGeneration
    const noticeGeneration = noticeSession.current
    setState(previous => ({ generation, noticeRevision: sequence, image: previous.generation === generation ? previous.image : null, error: null, busy: true }))
    const result = await loadBoardImage(file)
    if (!mounted.current || sequence !== request.current || generation !== store.getSnapshot().documentGeneration) {
      if (result.success) result.dispose()
      return
    }
    if (result.success) {
      resource.current?.image.dispose()
      resource.current = { generation, image: result }
      setState({ generation, noticeRevision: sequence, image: result, error: null, busy: false })
    } else setState(previous => ({ ...previous, error: noticeSession.current === noticeGeneration ? result.message : null, busy: false }))
  }
  return { noticeRevision: state.noticeRevision, image: state.generation === documentGeneration ? state.image : null,
    error: state.generation === documentGeneration ? state.error : null,
    busy: state.generation === documentGeneration && state.busy, load, clear, dismissError }
}
export type BoardImageSession = ReturnType<typeof useBoardImage>
