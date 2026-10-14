import type { GeographicCoordinate } from '../coordinates/coordinateTypes'
import type { GpxData, GpxPoint } from './gpx'

interface GpxMetrics { distances: number[][]; totalMeters: number }
export interface GpxLocation { point: GpxPoint; distanceMeters?: number; offsetMeters: number }
export interface KilometerMark { point: GpxPoint; kilometer: number }

const EARTH_RADIUS = 6_371_000
const radians = Math.PI / 180
const metricsCache = new WeakMap<GpxData, GpxMetrics>()
const wrapLongitude = (longitude: number) => ((longitude + 180) % 360 + 360) % 360 - 180

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

export function closestGpxLocation(data: GpxData, query: GeographicCoordinate): GpxLocation | null {
  const metrics = getGpxMetrics(data)
  let closest: GpxLocation | null = null
  function consider(point: GpxPoint, distanceMeters?: number) {
    const offsetMeters = geographicDistance(query, point)
    if (!closest || offsetMeters < closest.offsetMeters) closest = { point, offsetMeters, ...(distanceMeters !== undefined ? { distanceMeters } : {}) }
  }
  for (let lineIndex = 0; lineIndex < data.lines.length; lineIndex++) {
    const line = data.lines[lineIndex]!, distances = metrics.distances[lineIndex]!
    if (line.length === 1) consider(line[0]!, distances[0]!)
    for (let index = 1; index < line.length; index++) {
      const a = line[index - 1]!, b = line[index]!
      // Project onto each recorded segment instead of choosing the nearest sample.
      const scale = Math.cos((a.latitude + b.latitude) * radians / 2)
      const dx = wrapLongitude(b.longitude - a.longitude) * scale, dy = b.latitude - a.latitude
      const qx = wrapLongitude(query.longitude - a.longitude) * scale, qy = query.latitude - a.latitude
      const length = dx * dx + dy * dy
      const fraction = length ? Math.max(0, Math.min(1, (qx * dx + qy * dy) / length)) : 0
      consider(interpolate(a, b, fraction), distances[index - 1]! + (distances[index]! - distances[index - 1]!) * fraction)
    }
  }
  for (const point of data.waypoints) consider(point)
  return closest
}

export function getKilometerMarks(data: GpxData, minimumIntervalKm: number): KilometerMark[] {
  const metrics = getGpxMetrics(data)
  // Bound the number of labels even for unusually long or malformed journeys.
  const minimum = Math.max(0.1, minimumIntervalKm, metrics.totalMeters / 1_000_000)
  const magnitude = 10 ** Math.floor(Math.log10(minimum))
  const intervalKm = [1, 2, 5, 10].find(step => step * magnitude >= minimum)! * magnitude
  const intervalMeters = intervalKm * 1000
  const marks: KilometerMark[] = []
  let next = intervalMeters
  for (let lineIndex = 0; lineIndex < data.lines.length; lineIndex++) {
    const line = data.lines[lineIndex]!, distances = metrics.distances[lineIndex]!
    for (let index = 1; index < line.length; index++) {
      const from = distances[index - 1]!, to = distances[index]!
      if (to <= from) continue
      while (next <= to) {
        marks.push({ point: interpolate(line[index - 1]!, line[index]!, (next - from) / (to - from)), kilometer: next / 1000 })
        next += intervalMeters
      }
    }
  }
  return marks
}
