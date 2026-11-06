import type { GeographicCoordinate } from '../coordinates/coordinateTypes'
import type { GpxData, GpxPoint } from './gpx'
import { wrapLongitude } from './longitudeGeometry'

export interface GpxMetrics { distances: number[][]; totalMeters: number }
export interface GpxLocation { point: GpxPoint; distanceMeters?: number; offsetMeters: number; displayLongitude?: number }
export interface KilometerMark { point: GpxPoint; kilometer: number; displayLongitude?: number }

const EARTH_RADIUS = 6_371_000
const radians = Math.PI / 180
const metricsCache = new WeakMap<GpxData, GpxMetrics>()
export function primeGpxMetrics(data: GpxData, metrics: GpxMetrics) { metricsCache.set(data, metrics) }

export function geographicDistance(a: GeographicCoordinate, b: GeographicCoordinate): number {
  const latitude = Math.sin((b.latitude - a.latitude) * radians / 2)
  const longitude = Math.sin(wrapLongitude(b.longitude - a.longitude) * radians / 2)
  const haversine = latitude * latitude + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * longitude * longitude
  return EARTH_RADIUS * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, haversine))))
}

export function getGpxMetrics(data: GpxData): GpxMetrics {
  const cached = metricsCache.get(data)
  if (cached) return cached
  let totalMeters = 0
  const distances = data.lines.map(line => line.map((point, index) => {
    // Segments share the accumulated distance, but gaps add no invented metres.
    if (index > 0) totalMeters += geographicDistance(line[index - 1]!, point)
    return totalMeters
  }))
  const metrics = { distances, totalMeters }
  metricsCache.set(data, metrics)
  return metrics
}

function interpolate(a: GpxPoint, b: GpxPoint, fraction: number): GpxPoint {
  if (fraction <= 0) return a
  if (fraction >= 1) return b
  const elevation = a.elevation !== undefined && b.elevation !== undefined ? a.elevation + (b.elevation - a.elevation) * fraction : undefined
  const time = a.time && b.time ? new Date(Date.parse(a.time) + (Date.parse(b.time) - Date.parse(a.time)) * fraction).toISOString() : undefined
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * fraction,
    longitude: wrapLongitude(a.longitude + wrapLongitude(b.longitude - a.longitude) * fraction),
    ...(elevation !== undefined ? { elevation } : {}), ...(time ? { time } : {}),
  }
}

// Used by the streaming selection worker. Keep the
// recorded precision, antimeridian handling and metadata interpolation identical.
export function projectGpxSegment(a: GpxPoint, b: GpxPoint, query: GeographicCoordinate, fromMeters: number, toMeters: number, display?: [number, number]): GpxLocation {
  const scale = Math.cos((a.latitude + b.latitude) * radians / 2)
  const dx = wrapLongitude(b.longitude - a.longitude) * scale, dy = b.latitude - a.latitude
  const qx = wrapLongitude(query.longitude - a.longitude) * scale, qy = query.latitude - a.latitude
  const length = dx * dx + dy * dy
  const fraction = length ? Math.max(0, Math.min(1, (qx * dx + qy * dy) / length)) : 0
  const point = interpolate(a, b, fraction)
  return { point, offsetMeters: geographicDistance(query, point), distanceMeters: fromMeters + (toMeters - fromMeters) * fraction,
    ...(display ? { displayLongitude: display[0] + (display[1] - display[0]) * fraction } : {}) }
}

export function getKilometerMarks(data: GpxData, minimumIntervalKm: number): KilometerMark[] {
  return Array.from(iterateKilometerMarks(data, minimumIntervalKm)).filter((mark): mark is KilometerMark => mark !== undefined)
}

// Empty yields bound scanning work too, including tracks with few/no PKs.
export function* iterateKilometerMarks(data: GpxData, minimumIntervalKm: number, maximumMarks = 1000): Generator<KilometerMark | undefined> {
  const metrics = getGpxMetrics(data)
  // Bound the number of labels even for unusually long or malformed journeys.
  const minimum = Math.max(0.1, minimumIntervalKm, metrics.totalMeters / (Math.max(1, maximumMarks) * 1000))
  const magnitude = 10 ** Math.floor(Math.log10(minimum))
  const intervalKm = [1, 2, 5, 10].find(step => step * magnitude >= minimum)! * magnitude
  const intervalMeters = intervalKm * 1000
  let next = intervalMeters
  let work = 0
  let pointOffset = 0
  for (let lineIndex = 0; lineIndex < data.lines.length; lineIndex++) {
    const line = data.lines[lineIndex]!, distances = metrics.distances[lineIndex]!
    for (let index = 1; index < line.length; index++) {
      if (++work % 256 === 0) yield undefined
      const from = distances[index - 1]!, to = distances[index]!
      if (to <= from) continue
      while (next <= to) {
        const fraction = (next - from) / (to - from)
        const a = data.displayLongitudes?.[pointOffset + index - 1], b = data.displayLongitudes?.[pointOffset + index]
        yield { point: interpolate(line[index - 1]!, line[index]!, fraction), kilometer: next / 1000,
          ...(a === undefined || b === undefined ? {} : { displayLongitude: a + (b - a) * fraction }) }
        next += intervalMeters
      }
    }
    pointOffset += line.length
  }
}
