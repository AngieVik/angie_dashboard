import type { GeographicCoordinate } from '../coordinates/coordinateTypes'
import type { LoadedGpx } from './gpx'
import type { GpxSelection, GpxSelectionPacket, GpxSelectionResponse } from './gpxSelectionProtocol'
import { startWorkMetric } from '../../platform/workMetrics'

const POINTS_PER_MESSAGE = 1024

export async function selectClosestGpx(files: readonly LoadedGpx[], query: GeographicCoordinate, documentGeneration: number, signal: AbortSignal): Promise<GpxSelection | null> {
  signal.throwIfAborted()
  if (!files.some(file => file.visible)) return null
  const identity = { operationId: crypto.randomUUID(), documentGeneration }
  const finishMetric = startWorkMetric('gpx.selection')
  const worker = new Worker(new URL('./gpxSelection.worker.ts', import.meta.url), { type: 'module' })
  let maximumPostMs = 0
  let messageId = 0, failure: Error | undefined
  let pending: { resolve: (response: GpxSelectionResponse) => void; reject: (error: Error) => void } | undefined
  function fail(error: Error) {
    failure = error; worker.terminate(); pending?.reject(error); pending = undefined
  }
  const abort = () => fail(new DOMException('Selección GPX cancelada.', 'AbortError'))
  signal.addEventListener('abort', abort, { once: true })
  worker.onerror = event => { event.preventDefault(); fail(new Error('No se pudo seleccionar el GPX en segundo plano.')) }
  worker.onmessageerror = () => fail(new Error('No se pudo recibir la selección GPX.'))
  worker.onmessage = (event: MessageEvent<GpxSelectionResponse>) => {
    const result = event.data
    if (result.operationId !== identity.operationId || result.documentGeneration !== documentGeneration || result.messageId !== messageId) return
    const receiver = pending; pending = undefined
    if (result.ok) receiver?.resolve(result)
    else {
      const error = new Error(result.message)
      fail(error); receiver?.reject(error)
    }
  }
  function send(packet: GpxSelectionPacket) {
    signal.throwIfAborted()
    if (failure) throw failure
    return new Promise<GpxSelectionResponse>((resolve, reject) => {
      pending = { resolve, reject }
      try {
        const start = import.meta.env.DEV ? performance.now() : 0
        worker.postMessage({ ...identity, messageId: ++messageId, packet })
        if (import.meta.env.DEV) maximumPostMs = Math.max(maximumPostMs, performance.now() - start)
      }
      catch (error) { fail(error instanceof Error ? error : new Error('No se pudo enviar la geometría GPX.')) }
    })
  }
  try {
    for (const file of files) {
      if (!file.visible) continue
      await send({ type: 'start-file', fileId: file.id, query })
      let offset = 0
      for (let lineIndex = 0; lineIndex <= file.data.lines.length; lineIndex++) {
        const waypoint = lineIndex === file.data.lines.length
        const points = waypoint ? file.data.waypoints : file.data.lines[lineIndex]!
        for (let start = 0; start < points.length; start += POINTS_PER_MESSAGE) {
          // Each acknowledgement is a task boundary and bounds the clone and
          // message queue; never structured-clone the complete geometry on UI.
          await send({ type: 'points', lineIndex: waypoint ? null : lineIndex, points: points.slice(start, start + POINTS_PER_MESSAGE),
            displayLongitudes: file.data.displayLongitudes?.slice(offset + start, offset + Math.min(start + POINTS_PER_MESSAGE, points.length)) })
        }
        offset += points.length
      }
      await send({ type: 'end-file' })
    }
    const result = await send({ type: 'complete' })
    signal.throwIfAborted()
    return result.ok ? result.nearest ?? null : null
  } finally {
    finishMetric({ cancelled: signal.aborted, maximumPostMs })
    signal.removeEventListener('abort', abort); worker.terminate()
  }
}
