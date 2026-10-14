import type { GeographicCoordinate } from '../coordinates/coordinateTypes'

const ELEVATION_ENDPOINT = 'https://api-processes.idee.es/processes/getElevation/execution'

export async function lookupMapElevation(point: GeographicCoordinate, signal: AbortSignal): Promise<number | null> {
  signal.throwIfAborted()
  if (!Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 ||
    !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180) return null

  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(new DOMException('Tiempo de espera agotado.', 'TimeoutError')), 12000)
  try {
    const response = await fetch(ELEVATION_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'strict-origin-when-cross-origin',
      signal: controller.signal,
      body: JSON.stringify({ inputs: {
        geom: JSON.stringify({ type: 'FeatureCollection', features: [
          { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] } },
        ] }),
        formato: 'geojson', crs: 4326, withCoord: true, outputFormat: 'array',
      } }),
    })
    signal.throwIfAborted()
    if (!response.ok) throw new Error('Consulta no disponible')
    const data: unknown = await response.json()
    signal.throwIfAborted()
    if (typeof data !== 'object' || data === null || !('values' in data) ||
      !Array.isArray(data.values) || data.values.length !== 1) return null
    const value: unknown = data.values[0]
    if (!Array.isArray(value) || value.length !== 3) return null
    const [longitude, latitude, elevation]: unknown[] = value
    if (typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude - point.longitude) > 0.000001 ||
      typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude - point.latitude) > 0.000001 ||
      typeof elevation !== 'number' || !Number.isFinite(elevation)) return null
    // Discard raster no-data sentinels and values outside terrestrial terrain heights.
    if (elevation < -500 || elevation > 9000) return null
    return elevation
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}
