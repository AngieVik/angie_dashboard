import { validateDocument } from '../../domain/document/validateDocument'
import { checkFileBytes, checkTextBytes, InputBudgetError } from '../../domain/input/inputBudgets'
import type { DocumentWorkerRequest, DocumentWorkerResponse } from './documentWorkerProtocol'

self.onmessage = async (event: MessageEvent<DocumentWorkerRequest>) => {
  const { operationId, documentGeneration, source } = event.data
  const identity = { operationId, documentGeneration }
  let response: DocumentWorkerResponse
  try {
    if (typeof source !== 'string') checkFileBytes(source.size, 'json')
    const text = typeof source === 'string' ? source : await source.text()
    checkTextBytes(text, 'json')
    const result = validateDocument(JSON.parse(text))
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
    response = { ...identity, ok: true, result, fingerprint }
  } catch (error) {
    response = { ...identity, ok: false, message: error instanceof Error ? error.message : 'No se pudo leer el UIBoard.',
      ...(error instanceof InputBudgetError ? { issue: error.issue } : {}) }
  }
  self.postMessage(response)
}
