import type { MapGpxReference } from '../../domain/document/types'

export interface GpxPoint { latitude: number; longitude: number; name?: string; elevation?: number; time?: string }
export interface GpxData {
  lines: GpxPoint[][]
  waypoints: GpxPoint[]
  pointCount: number
  // Visual bounds may extend beyond ±180°. Original points remain normalized.
  bounds?: [[number, number], [number, number]]
  displayLongitudes?: Float64Array<ArrayBuffer>
}
export const PK_INTERVALS = [0.1, 0.5, 1, 5, 10] as const
export interface LoadedGpx extends MapGpxReference {
  data: GpxData
}
