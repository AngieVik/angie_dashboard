import type { UIBoardData, ValidationIssue, ValidationResult } from '../../domain/document/types'

export interface DocumentOperation { operationId: string; documentGeneration: number }
export interface DocumentWorkerRequest extends DocumentOperation { source: Blob | string }
export type DocumentWorkerResponse = DocumentOperation & (
  | { ok: true; result: ValidationResult<UIBoardData>; fingerprint: string }
  | { ok: false; message: string; issue?: ValidationIssue }
)
