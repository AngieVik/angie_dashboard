import { parseGpx } from './gpxParser'
import { prepareGpxDisplay } from './gpxDisplayGeometry'
import { packGpx, gpxTransferables } from './gpxTransfer'
import { GPX_GEOMETRY_BYTES, gpxGeometryBytes } from './gpxBudget'
import { checkFileBytes, INPUT_BUDGETS, InputBudgetError, budgetIssue } from '../../domain/input/inputBudgets'
import type { GpxWorkerRequest, GpxWorkerResponse } from './gpxWorkerProtocol'

// Each worker handles one file. Termination interrupts even synchronous XML parsing.
self.onmessage = async (event: MessageEvent<GpxWorkerRequest>) => {
  const { operationId, documentGeneration, file, expectedFingerprint, allowance } = event.data
  const identity = { operationId, documentGeneration }
  let response: GpxWorkerResponse
  try {
    checkFileBytes(file.size, 'gpx')
    if (file.name.length > INPUT_BUDGETS.gpxNameCharacters) throw new InputBudgetError(budgetIssue('gpx.name', INPUT_BUDGETS.gpxNameCharacters, 'caracteres'))
    const bytes = await file.arrayBuffer()
    checkFileBytes(bytes.byteLength, 'gpx')
    const hash = await crypto.subtle.digest('SHA-256', bytes)
    const fingerprint = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('')
    if (expectedFingerprint !== undefined && fingerprint !== expectedFingerprint) throw new Error('El contenido no coincide con el GPX guardado. Selecciona su archivo original.')
    const known = allowance?.known.find(item => item.fingerprint === fingerprint)
    // The original has been hashed and verified. Reuse admitted geometry rather
    // than temporarily doubling it when a loaded file is selected again.
    if (known) { self.postMessage({ ...identity, ok: true, fingerprint, cached: true }); return }
    if (allowance && allowance.files <= 0) throw new Error('Se ha alcanzado el presupuesto de geometrías GPX en memoria.')
    const data = parseGpx(new TextDecoder().decode(bytes), allowance?.points)
    if (gpxGeometryBytes(data) > (allowance?.bytes ?? GPX_GEOMETRY_BYTES)) throw new Error('Se ha alcanzado el presupuesto de geometrías GPX en memoria.')
    prepareGpxDisplay(data)
    response = { ...identity, ok: true, fingerprint, packed: packGpx(data) }
  } catch (error) {
    response = { ...identity, ok: false, message: error instanceof Error ? error.message : 'No se pudo analizar el GPX.',
      ...(error instanceof InputBudgetError ? { issue: error.issue } : {}) }
  }
  self.postMessage(response, { transfer: response.ok && !response.cached ? gpxTransferables(response.packed) : [] })
}
