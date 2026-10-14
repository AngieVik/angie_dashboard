import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyMapQuery, searchMapPlaces } from './mapSearch'
import { useMapSearch } from './useMapSearch'

const place = { place_id: 1, lat: '40.4168', lon: '-3.7038', name: 'Madrid', display_name: 'Madrid, Comunidad de Madrid, España' }
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200 })

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })

describe('Buscador de mapas', () => {
  it('interpreta DD, DMS, DMM y UTM directamente y conserva los errores de coordenadas', () => {
    for (const input of ['40.4168, -3.7038', '37°03\'36.8"N 2°00\'08.2"W', "37°03.614'N 2°00.137'W", '30S 588700 4101800']) {
      expect(classifyMapQuery(input).kind).toBe('coordinate')
    }
    for (const input of ['91, 0', '37.12', '30S 588700 99999999', '37°99\'0"N 2°0\'0"W']) {
      expect(classifyMapQuery(input).kind).toBe('invalid')
    }
  })

  it('reconoce municipios, lugares y direcciones con números como búsquedas de lugares', () => {
    for (const input of ['Madrid', 'Hospital de La Paz, Madrid', '123 Calle Mayor, Madrid', 'Calle 30, Madrid', '7 E 42nd Street, New York']) {
      expect(classifyMapQuery(input)).toEqual({ kind: 'place', query: input })
    }
    expect(classifyMapQuery('   ').kind).toBe('invalid')
  })

  it('consulta manualmente y conserva la dirección completa y las coordenadas de varias coincidencias', async () => {
    const fetch = vi.fn().mockResolvedValue(response([place, { ...place, place_id: 2, display_name: 'Madrid, Cundinamarca, Colombia' }]))
    vi.stubGlobal('fetch', fetch)
    const results = await searchMapPlaces('Madrid', new AbortController().signal)
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ label: place.display_name, latitude: 40.4168, longitude: -3.7038 })
    const url = new URL(fetch.mock.calls[0]![0] as string)
    expect(url.origin).toBe('https://nominatim.openstreetmap.org')
    expect(url.searchParams.get('q')).toBe('Madrid')
    expect(url.searchParams.get('limit')).toBe('5')
  })

  it('reutiliza la caché local incluso sin conexión', async () => {
    const fetch = vi.fn().mockResolvedValue(response([place]))
    vi.stubGlobal('fetch', fetch)
    const first = await searchMapPlaces('Madrid', new AbortController().signal)
    fetch.mockRejectedValue(new TypeError('offline'))
    expect(await searchMapPlaces('  MADRID  ', new AbortController().signal)).toEqual(first)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('distingue una respuesta vacía de un fallo HTTP o de conexión y rechaza respuestas inválidas', async () => {
    const fetch = vi.fn().mockResolvedValue(response([]))
    vi.stubGlobal('fetch', fetch)
    expect(await searchMapPlaces('vacío', new AbortController().signal)).toEqual([])
    fetch.mockResolvedValue(new Response('', { status: 503 }))
    await expect(searchMapPlaces('fallo HTTP', new AbortController().signal)).rejects.toThrow()
    fetch.mockRejectedValue(new TypeError('offline'))
    await expect(searchMapPlaces('sin conexión', new AbortController().signal)).rejects.toThrow()
    fetch.mockResolvedValue(response({ error: 'invalid' }))
    await expect(searchMapPlaces('respuesta inválida', new AbortController().signal)).rejects.toThrow()
    fetch.mockResolvedValue(response([{ ...place, lat: 'NaN' }]))
    await expect(searchMapPlaces('punto inválido', new AbortController().signal)).rejects.toThrow()
  })

  it('espacia las consultas de red al menos un segundo y cancela la espera', async () => {
    vi.useFakeTimers()
    const times: number[] = []
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => { times.push(Date.now()); return Promise.resolve(response([])) }))
    const first = searchMapPlaces('primera', new AbortController().signal)
    await vi.runAllTimersAsync(); await first
    const second = searchMapPlaces('segunda', new AbortController().signal)
    await vi.runAllTimersAsync(); await second
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(1000)
    const controller = new AbortController()
    const cancelled = searchMapPlaces('cancelada', controller.signal)
    const rejection = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await vi.runAllTimersAsync(); await rejection
    expect(times).toHaveLength(2)
  })

  it('muestra búsqueda, coincidencias, vacío y error y descarta una respuesta antigua tras editar', async () => {
    let resolveOld: (value: Response) => void = () => {}
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve }))
    vi.stubGlobal('fetch', fetch)
    const { result, unmount } = renderHook(() => useMapSearch('documento'))
    act(() => { void result.current.search('antigua') })
    expect(result.current.state.status).toBe('loading')
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    act(() => result.current.reset())
    await act(async () => { resolveOld(response([place])) })
    expect(result.current.state.status).toBe('idle')
    fetch.mockResolvedValue(response([place]))
    await act(async () => { await result.current.search('Madrid') })
    expect(result.current.state.status).toBe('results')
    fetch.mockResolvedValue(response([]))
    await act(async () => { await result.current.search('vacío') })
    expect(result.current.state.status).toBe('empty')
    fetch.mockRejectedValue(new TypeError('offline'))
    await act(async () => { await result.current.search('error') })
    expect(result.current.state.status).toBe('error')
    unmount()
  })
})
