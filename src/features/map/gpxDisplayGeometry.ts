import type { GpxData } from './gpx'
import { geographicEnvelope, longitudeShift, unwrapLongitude } from './longitudeGeometry'
import type { GeographicBounds } from './longitudeGeometry'

// Worker-only preparation. The extra Float64 buffer follows the original point
// order and transfers ownership with the other geometry buffers.
export function prepareGpxDisplay(data: GpxData): void {
  const longitudes = new Float64Array(data.pointCount)
  const parts: { start: number; end: number; bounds: GeographicBounds }[] = []
  let index = 0
  for (const line of data.lines) {
    if (!line.length) continue
    const start = index
    let previous = line[0]!.longitude, south = Infinity, north = -Infinity, west = Infinity, east = -Infinity
    for (const point of line) {
      previous = unwrapLongitude(point.longitude, previous)
      longitudes[index++] = previous
      south = Math.min(south, point.latitude); north = Math.max(north, point.latitude)
      west = Math.min(west, previous); east = Math.max(east, previous)
    }
    parts.push({ start, end: index, bounds: [[south, west], [north, east]] })
  }
  for (const point of data.waypoints) {
    longitudes[index] = point.longitude
    parts.push({ start: index, end: ++index, bounds: [[point.latitude, point.longitude], [point.latitude, point.longitude]] })
  }
  const bounds = geographicEnvelope(parts.map(part => part.bounds))
  if (bounds) {
    const center = (bounds[0][1] + bounds[1][1]) / 2
    let west = Infinity, east = -Infinity
    for (const part of parts) {
      const shift = longitudeShift(part.bounds[0][1], part.bounds[1][1], center)
      for (let i = part.start; i < part.end; i++) longitudes[i] = longitudes[i]! + shift
      west = Math.min(west, part.bounds[0][1] + shift); east = Math.max(east, part.bounds[1][1] + shift)
    }
    bounds[0][1] = west; bounds[1][1] = east
  }
  data.bounds = bounds
  data.displayLongitudes = longitudes
}
