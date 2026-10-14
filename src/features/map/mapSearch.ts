import { parseCoordinate } from '../coordinates/parseCoordinate'
import type { CoordinateParseResult, GeographicCoordinate } from '../coordinates/coordinateTypes'
import { MAX_MAP_LATITUDE } from './mapNavigation'

export interface MapPlace extends GeographicCoordinate { id: string; name: string; label: string }
type MapQuery = { kind: 'coordinate'; parsed: Extract<CoordinateParseResult, { ok: true }> } |
  { kind: 'place'; query: string } | { kind: 'invalid'; error: string }

const DEFAULT_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const CACHE_KEY = 'angie.map.search.cache.v1'
const RATE_KEY = 'angie.map.search.last-request'
const CACHE_LIFETIME = 24 * 60 * 60 * 1000
interface CacheEntry { key: string; time: number; places: MapPlace[] }
let fallbackCache: CacheEntry[] = [], fallbackLastRequest = 0
let queue: Promise<unknown> = Promise.resolve()

export function classifyMapQuery(input: string): MapQuery {
  const query = input.trim()
  if (!query) return { kind: 'invalid', error: 'Introduce un lugar, dirección o coordenadas.' }
  const parsed = parseCoordinate(query)
  if (parsed.ok) return { kind: 'coordinate', parsed }
  // Keep malformed coordinate input local, without treating numbered streets as UTM.
  if (/^[\d\s.,;+−-]+$/.test(query) || /^[+-]?\d+\s*°/.test(query) || /^\d{1,2}\s*[A-Za-z]\s+[+−\d-][\d\s.,;+−-]*$/.test(query)) {
    return { kind: 'invalid', error: parsed.error }
  }
  return { kind: 'place', query }
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function validPlace(value: unknown): value is MapPlace {
  return record(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.label === 'string' &&
    typeof value.latitude === 'number' && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= MAX_MAP_LATITUDE &&
    typeof value.longitude === 'number' && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180
}
function cacheEntries(): CacheEntry[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]')
    if (!Array.isArray(stored)) return []
    return stored.filter((entry): entry is CacheEntry => record(entry) && typeof entry.key === 'string' &&
      typeof entry.time === 'number' && entry.time <= Date.now() && Date.now() - entry.time < CACHE_LIFETIME &&
      Array.isArray(entry.places) && entry.places.length <= 5 && entry.places.every(validPlace)).slice(-40)
  } catch { return fallbackCache.filter(entry => Date.now() - entry.time < CACHE_LIFETIME) }
}
function cachePlaces(key: string, places: MapPlace[]) {
  const entries = [...cacheEntries().filter(entry => entry.key !== key), { key, time: Date.now(), places }].slice(-40)
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(entries)) } catch { fallbackCache = entries }
}
function endpoint() {
  // Operators can switch to a compatible Nominatim service without updating the app:
  // localStorage.setItem('angie.map.search.endpoint', 'https://provider.example/search')
  let configured: string | null = null
  try { configured = localStorage.getItem('angie.map.search.endpoint') } catch { /* Use the default provider. */ }
  const url = new URL(configured || DEFAULT_ENDPOINT)
  if (url.protocol !== 'https:') throw new Error('El servicio de búsqueda debe usar HTTPS.')
  return url
}
function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, milliseconds)
    signal.addEventListener('abort', abort, { once: true })
  })
}
function decodePlaces(data: unknown): MapPlace[] {
  if (!Array.isArray(data)) throw new Error('El servicio devolvió una respuesta inválida.')
  const places: MapPlace[] = []
  for (const item of data.slice(0, 5)) {
    if (!record(item) || typeof item.lat !== 'string' || typeof item.lon !== 'string' ||
      !item.lat.trim() || !item.lon.trim() || typeof item.display_name !== 'string' || !item.display_name.trim()) {
      throw new Error('El servicio devolvió una respuesta inválida.')
    }
    const latitude = Number(item.lat), longitude = Number(item.lon), label = item.display_name
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      throw new Error('El servicio devolvió una respuesta inválida.')
    }
    if (Math.abs(latitude) > MAX_MAP_LATITUDE) continue
    const id = `${latitude},${longitude}:${label}`
    if (!places.some(place => place.id === id)) places.push({ id, latitude, longitude, label,
      name: typeof item.name === 'string' && item.name.trim() ? item.name : label.split(',')[0]! })
  }
  return places
}

export async function searchMapPlaces(query: string, signal: AbortSignal): Promise<MapPlace[]> {
  signal.throwIfAborted()
  const url = endpoint()
  const key = `${url.href}\n${query.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')}`
  const cached = cacheEntries().find(entry => entry.key === key)
  if (cached) return cached.places
  const run = async () => {
    signal.throwIfAborted()
    const cached = cacheEntries().find(entry => entry.key === key)
    if (cached) return cached.places
    let last = fallbackLastRequest
    try { last = Number(localStorage.getItem(RATE_KEY)) || 0 } catch { /* Serialize in memory if storage is unavailable. */ }
    const delay = Math.max(0, 1000 - (Date.now() - last))
    if (delay) await wait(delay, signal)
    signal.throwIfAborted()
    try { localStorage.setItem(RATE_KEY, String(Date.now())) } catch { fallbackLastRequest = Date.now() }
    url.searchParams.set('q', query.trim())
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '5')
    url.searchParams.set('accept-language', 'es')
    const controller = new AbortController()
    const abort = () => controller.abort(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => controller.abort(new DOMException('Tiempo de espera agotado.', 'TimeoutError')), 12000)
    try {
      const response = await fetch(url.href, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' })
      signal.throwIfAborted()
      if (!response.ok) throw new Error(response.status === 429 ? 'El buscador está ocupado. Inténtalo de nuevo más tarde.' : 'El servicio de búsqueda no está disponible.')
      const places = decodePlaces(await response.json())
      signal.throwIfAborted()
      cachePlaces(key, places)
      return places
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort) }
  }
  // Web Locks also serialize same-origin tabs; the queue covers browsers without them.
  const result = queue.then(() => navigator.locks ? navigator.locks.request('angie.map.search', { signal }, run) : run())
  queue = result.catch(() => {})
  return result
}
