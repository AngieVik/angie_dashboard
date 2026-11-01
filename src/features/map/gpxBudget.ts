import type { GpxData } from './gpx'

export const GPX_GEOMETRY_BYTES = 64 * 1024 * 1024
// Admission estimate: points, metrics/profile, transfer buffers, and two live
// Leaflet views (Mapa/Plano). This is not a measurement of the engine's heap.
export function gpxGeometryBytes(data: GpxData) {
  let bytes = 128 + data.lines.length * 96 + data.pointCount * 400
  // Isolated points own circle layers (and possibly tooltip content) in each
  // view, unlike vertices which share a bounded polyline chunk.
  bytes += (data.waypoints.length + data.lines.filter(line => line.length === 1).length) * 4000
  for (const line of [...data.lines, data.waypoints]) for (const point of line) bytes += ((point.name?.length ?? 0) + (point.time?.length ?? 0)) * 2
  return bytes
}
export interface GpxAllowance {
  points: number
  bytes: number
  files: number
  known: { fingerprint: string; points: number; bytes: number }[]
}
