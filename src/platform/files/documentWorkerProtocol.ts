import type { MigrationResult, AngieDocument } from '../../domain/document/types'
import type { PreparedDocumentSave } from '../../storage/documentSave'
import type { ImageResource } from '../../storage/imageResources'
import type { ValidationIssue } from '../../domain/document/types'

export interface DocumentOperation { operationId: string; documentGeneration: number }
export interface DocumentWorkerRequest extends DocumentOperation {
  source: Blob | string
  prepareVisible?: boolean
  retainText?: boolean
}
export interface VisibleDocumentPreparation {
  prepared: PreparedDocumentSave
  image?: ImageResource
}
export type DocumentWorkerResponse = DocumentOperation & (
  | { ok: true; result: MigrationResult<AngieDocument>; visible?: VisibleDocumentPreparation; sourceText?: string }
  | { ok: false; message: string; issue?: ValidationIssue }
)
