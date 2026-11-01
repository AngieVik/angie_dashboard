import { checkFileBytes, InputBudgetError } from '../../domain/input/inputBudgets'
import type { SizedTextFile } from './readInputFile'
import type { DocumentOperation, DocumentWorkerResponse } from './documentWorkerProtocol'

export interface DocumentReadOptions {
  documentGeneration: number
  signal?: AbortSignal
  prepareVisible?: boolean
  retainText?: boolean
}

export async function analyzeDocument(source: SizedTextFile | string, options: DocumentReadOptions = { documentGeneration: 0 }) {
  const { signal } = options
  const abortError = () => new DOMException('Apertura cancelada.', 'AbortError')
  if (signal?.aborted) throw abortError()
  if (typeof source !== 'string') checkFileBytes(source.size, 'json')
  // Native File/Blob is cloned without reading its bytes on the UI thread.
  // Structural file adapters keep their existing contract; even their UTF-8
  // preflight, parsing and validation run exclusively inside the worker.
  return new Promise<Extract<DocumentWorkerResponse, { ok: true }>>((resolve, reject) => {
    const identity: DocumentOperation = { operationId: crypto.randomUUID(), documentGeneration: options.documentGeneration }
    let worker: Worker | undefined
    let settled = false
    function finish(error?: Error, response?: Extract<DocumentWorkerResponse, { ok: true }>) {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abort)
      worker?.terminate()
      if (error) reject(error)
      else if (response) resolve(response)
    }
    function abort() { finish(abortError()) }
    signal?.addEventListener('abort', abort, { once: true })
    try {
      worker = new Worker(new URL('./document.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<DocumentWorkerResponse>) => {
        const response = event.data
        if (settled || response.operationId !== identity.operationId || response.documentGeneration !== identity.documentGeneration) return
        if (signal?.aborted) { abort(); return }
        if (response.ok) finish(undefined, response)
        else finish(response.issue ? new InputBudgetError(response.issue) : new Error(response.message))
      }
      worker.onerror = event => { event.preventDefault(); finish(new Error('No se pudo analizar el JSON en segundo plano.')) }
      worker.onmessageerror = () => finish(new Error('No se pudo recibir el JSON analizado.'))
      const send = (value: Blob | string) => {
        if (!settled) worker!.postMessage({ ...identity, source: value, prepareVisible: options.prepareVisible, retainText: options.retainText })
      }
      if (typeof source === 'string' || source instanceof Blob) send(source)
      else void source.text().then(send).catch(error => finish(error instanceof Error ? error : new Error('No se pudo leer el JSON.')))
    } catch (error) { finish(error instanceof Error ? error : new Error('No se pudo iniciar el análisis JSON.')) }
  })
}
