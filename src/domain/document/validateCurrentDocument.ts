import { validateDocument } from './validateDocument'
import { checkDocumentBudget } from '../input/inputBudgets'
import type { AngieDocumentV4, MigrationFailureCode, MigrationResult } from './types'

export const CURRENT_DOCUMENT_VERSION = 4

export function rejectDocumentMigration(code: MigrationFailureCode, path: string, message: string): MigrationResult<never> {
  return { success: false, code, errors: [{ path, message: `${path} ${message}` }] }
}

export function isDocumentEnvelope(input: unknown): input is { format: unknown; formatVersion?: unknown } {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    && Object.hasOwn(input, 'format') && 'format' in input
}

// null means the envelope requires historical validation/conversion. V4 and
// envelope failures use this same gate in the UI and the synchronous worker API.
export function validateCurrentDocument(input: unknown): MigrationResult<AngieDocumentV4> | null {
  const budget = checkDocumentBudget(input)
  if (budget) return { success: false, code: 'invalid-document', errors: [budget] }
  if (!isDocumentEnvelope(input) || input.format !== 'angie-dashboard') {
    return rejectDocumentMigration('invalid-format', 'format', 'no identifica un documento Angie Dashboard')
  }
  if (!Number.isInteger(input.formatVersion)) {
    return rejectDocumentMigration('invalid-version', 'formatVersion', 'debe ser un entero que identifique una versión')
  }
  const version = input.formatVersion as number
  if (version > CURRENT_DOCUMENT_VERSION) {
    return rejectDocumentMigration('future-version', 'formatVersion', 'pertenece a una versión futura no reconocida')
  }
  if (version < 1) {
    return rejectDocumentMigration('unsupported-old-version', 'formatVersion', 'es una versión antigua no compatible')
  }
  if (version < CURRENT_DOCUMENT_VERSION) return null
  const result = validateDocument(input)
  if (!result.success) return { success: false, code: 'invalid-document', errors: result.errors }
  return { success: true, document: structuredClone(result.document), migrated: false }
}
