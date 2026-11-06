import type { GeographicCoordinate } from '../coordinates/coordinateTypes'
import type { GpxPoint } from './gpx'
import { geographicDistance, projectGpxSegment } from './gpxMetrics'
import type { GpxLocation } from './gpxMetrics'
import type { GpxSelection, GpxSelectionRequest, GpxSelectionResponse } from './gpxSelectionProtocol'
import { measureWork } from '../../platform/workMetrics'

// One worker per selection, one acknowledged batch at a time. Carry only the
// preceding point and cumulative distance, including across chunk boundaries.
let file: { id: string; query: GeographicCoordinate; lineIndex: number | null; linePoints: number;
  previous?: GpxPoint; displayLongitude?: number; distanceMeters: number; closest: GpxLocation | null } | undefined
let nearest: GpxSelection | null = null
function consider(location: GpxLocation) {
  if (file && (!file.closest || location.offsetMeters < file.closest.offsetMeters)) file.closest = location
}
function finishLine() {
  if (file?.linePoints === 1 && file.previous) consider({ point: file.previous,
    offsetMeters: geographicDistance(file.query, file.previous), distanceMeters: file.distanceMeters, displayLongitude: file.displayLongitude })
  if (file) { file.previous = undefined; file.displayLongitude = undefined; file.linePoints = 0 }
}
self.onmessage = (event: MessageEvent<GpxSelectionRequest>) => {
  const { operationId, documentGeneration, messageId, packet } = event.data
  const identity = { operationId, documentGeneration, messageId }
  let response: GpxSelectionResponse
  try {
    if (packet.type === 'start-file') {
      file = { id: packet.fileId, query: packet.query, lineIndex: null, linePoints: 0, distanceMeters: 0, closest: null }
    } else if (packet.type === 'points') {
      if (!file) throw new Error('La selección GPX ya no está activa.')
      if (packet.lineIndex !== file.lineIndex) { finishLine(); file.lineIndex = packet.lineIndex }
      const current = file
      measureWork('gpx.selection-batch', () => {
        for (let index = 0; index < packet.points.length; index++) {
          const point = packet.points[index]!, displayLongitude = packet.displayLongitudes?.[index]
          if (packet.lineIndex === null) { consider({ point, offsetMeters: geographicDistance(current.query, point), displayLongitude }); continue }
          if (current.previous) {
            const from = current.distanceMeters
            current.distanceMeters += geographicDistance(current.previous, point)
            consider(projectGpxSegment(current.previous, point, current.query, from, current.distanceMeters,
              current.displayLongitude === undefined || displayLongitude === undefined ? undefined : [current.displayLongitude, displayLongitude]))
          }
          current.previous = point; current.displayLongitude = displayLongitude; current.linePoints++
        }
      })
    } else if (packet.type === 'end-file') {
      if (!file) throw new Error('La selección GPX ya no está activa.')
      finishLine()
      const location = file.closest
      if (location && (!nearest || location.offsetMeters < nearest.location.offsetMeters)) nearest = { fileId: file.id, location }
      file = undefined
    }
    response = { ...identity, ok: true, ...(packet.type === 'complete' ? { nearest } : {}) }
  } catch (error) {
    response = { ...identity, ok: false, message: error instanceof Error ? error.message : 'No se pudo seleccionar el punto GPX.' }
  }
  self.postMessage(response)
}
