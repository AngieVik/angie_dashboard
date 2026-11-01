import { migrateDocument } from '../../domain/document/migrateDocument'
import { serializeWorkingDocument } from '../../domain/document/serializeWorkingDocument'
import { checkDocumentBudget, checkTextBytes, InputBudgetError } from '../../domain/input/inputBudgets'
import { imageResource, workingDocument } from '../../storage/imageResources'
import { validateEmbeddedImage } from './embeddedImage'
import { readJsonText } from './readInputFile'
import type { DocumentWorkerRequest, DocumentWorkerResponse, VisibleDocumentPreparation } from './documentWorkerProtocol'

// One operation per worker: termination also interrupts synchronous parsing/AJV.
self.onmessage = async (event: MessageEvent<DocumentWorkerRequest>) => {
  const { operationId, documentGeneration, source, prepareVisible, retainText } = event.data
  const identity = { operationId, documentGeneration }
  let response: DocumentWorkerResponse
  try {
    const text = typeof source === 'string' ? source : await readJsonText(source)
    if (typeof source === 'string') checkTextBytes(text, 'json')
    const input: unknown = JSON.parse(text)
    const budget = checkDocumentBudget(input)
    if (budget) throw new InputBudgetError(budget)
    const result = migrateDocument(input)
    let visible: VisibleDocumentPreparation | undefined
    if (prepareVisible && result.success) {
      const image = result.document.board.backgroundImage
      if (image) await validateEmbeddedImage(image.dataUrl)
      const document = await workingDocument(result.document)
      const background = document.board.backgroundImage
      visible = { prepared: { document, text: serializeWorkingDocument(document) },
        ...(background && 'resourceId' in background ? { image: imageResource(background.resourceId) } : {}) }
      // Only the compact working document crosses back; no duplicate base64 image.
      response = { ...identity, ok: true, result: { ...result, document }, visible }
      self.postMessage(response)
      return
    }
    response = { ...identity, ok: true, result, ...(retainText ? { sourceText: text } : {}) }
  } catch (error) {
    response = { ...identity, ok: false, message: error instanceof Error ? error.message : 'No se pudo analizar el JSON.',
      ...(error instanceof InputBudgetError ? { issue: error.issue } : {}) }
  }
  self.postMessage(response)
}
