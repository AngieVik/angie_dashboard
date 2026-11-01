import { InputBudgetError } from '../../domain/input/inputBudgets'
import { unpackGpx } from './gpxTransfer'
import type { GpxData } from './gpx'
import type { GpxAllowance } from './gpxBudget'
import type { GpxOperation, GpxWorkerResponse } from './gpxWorkerProtocol'

export interface GpxReadOptions {
  documentGeneration: number
  signal?: AbortSignal
  allowance?: GpxAllowance
  getCached?: (fingerprint: string) => GpxData | undefined
}

export function analyzeGpx(file: File, expectedFingerprint: string | undefined, options: GpxReadOptions) {
  return new Promise<{ fingerprint: string; data: GpxData }>((resolve, reject) => {
    const { signal } = options
    if (signal?.aborted) { reject(new DOMException('Importación cancelada.', 'AbortError')); return }
    const identity: GpxOperation = { operationId: crypto.randomUUID(), documentGeneration: options.documentGeneration }
    const worker = new Worker(new URL('./gpx.worker.ts', import.meta.url), { type: 'module' })
    let settled = false, receiving = false
    const decoding = new AbortController()
    function finish(error?: Error, result?: { fingerprint: string; data: GpxData }) {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      decoding.abort()
      if (error) reject(error)
      else if (result) resolve(result)
    }
    function abort() { finish(new DOMException('Importación cancelada.', 'AbortError')) }
    signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = (event: MessageEvent<GpxWorkerResponse>) => {
      const result = event.data
      if (settled || receiving || result.operationId !== identity.operationId || result.documentGeneration !== identity.documentGeneration) return
      if (signal?.aborted) { abort(); return }
      if (result.ok) {
        if (result.cached) {
          const data = options.getCached?.(result.fingerprint)
          if (data) finish(undefined, { fingerprint: result.fingerprint, data })
          else finish(new Error('El GPX ya no está disponible en memoria. Vuelve a seleccionarlo.'))
          return
        }
        receiving = true
        worker.terminate()
        void unpackGpx(result.packed, decoding.signal).then(data => finish(undefined, { fingerprint: result.fingerprint, data }), error => finish(error))
      }
      else finish(result.issue ? new InputBudgetError(result.issue) : new Error(result.message))
    }
    worker.onerror = event => { event.preventDefault(); finish(new Error('No se pudo analizar el GPX en segundo plano.')) }
    worker.onmessageerror = () => finish(new Error('No se pudo recibir el GPX analizado.'))
    try { worker.postMessage({ ...identity, file, expectedFingerprint, allowance: options.allowance }) }
    catch (error) { finish(error instanceof Error ? error : new Error('No se pudo iniciar el análisis GPX.')) }
  })
}
