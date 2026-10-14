import { useCallback, useEffect, useRef, useState } from 'react'
import { searchMapPlaces } from './mapSearch'
import type { MapPlace } from './mapSearch'

type SearchState = { status: 'idle' | 'loading' | 'empty' } |
  { status: 'results'; places: MapPlace[] } | { status: 'error'; message: string }

export function useMapSearch(navigationKey: string) {
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const pending = useRef<AbortController | null>(null)
  const reset = useCallback(() => {
    pending.current?.abort(); pending.current = null
    setState({ status: 'idle' })
  }, [])
  useEffect(() => () => { pending.current?.abort(); pending.current = null }, [navigationKey])
  const search = useCallback(async (query: string) => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setState({ status: 'loading' })
    try {
      const places = await searchMapPlaces(query, controller.signal)
      if (controller.signal.aborted) return
      setState(places.length ? { status: 'results', places } : { status: 'empty' })
    } catch (failure) {
      if (controller.signal.aborted) return
      setState({ status: 'error', message: failure instanceof TypeError ? 'No se pudo conectar con el buscador. Comprueba la conexión e inténtalo de nuevo.' :
        failure instanceof Error && failure.name === 'TimeoutError' ? 'El buscador tardó demasiado. Inténtalo de nuevo.' :
          failure instanceof Error ? failure.message : 'No se pudo completar la búsqueda.' })
    } finally { if (pending.current === controller) pending.current = null }
  }, [])
  return { state, search, reset }
}
