import type { GeographicCoordinate } from '../coordinates/coordinateTypes'
import type { GpxPoint } from './gpx'
import type { GpxLocation } from './gpxMetrics'
import type { GpxOperation } from './gpxWorkerProtocol'

export interface GpxSelection { fileId: string; location: GpxLocation }
export type GpxSelectionPacket =
  | { type: 'start-file'; fileId: string; query: GeographicCoordinate }
  | { type: 'points'; lineIndex: number | null; points: GpxPoint[]; displayLongitudes?: Float64Array }
  | { type: 'end-file' }
  | { type: 'complete' }
export type GpxSelectionRequest = GpxOperation & { messageId: number; packet: GpxSelectionPacket }
export type GpxSelectionResponse = GpxOperation & { messageId: number } & (
  | { ok: true; nearest?: GpxSelection | null }
  | { ok: false; message: string }
)
