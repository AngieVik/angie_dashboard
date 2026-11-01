import type { MapGpxReference } from '../../domain/document/types'
import { INPUT_BUDGETS } from '../../domain/input/inputBudgets'

export interface GpxPoint { latitude: number; longitude: number; name?: string; elevation?: number; time?: string }
export interface GpxData { lines: GpxPoint[][]; waypoints: GpxPoint[]; pointCount: number; bounds?: [[number, number], [number, number]] }
export const PK_INTERVALS = [0.1, 0.5, 1, 5, 10] as const
export interface LoadedGpx extends MapGpxReference {
  data: GpxData
}

export const MAX_GPX_BYTES = INPUT_BUDGETS.gpxBytes
