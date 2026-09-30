import { validateDocument } from './validateDocument'
import type { AngieDocumentV1, MigrationFailureCode, MigrationResult, ValidationResult } from './types'

interface DocumentMigration {
  targetVersion: number
  validateSource: (input: unknown) => ValidationResult<unknown>
  migrate: (input: unknown) => unknown
}

// Register a step only when its source contract and conversion are approved.
// V1 is currently the sole recognized contract: there are no legacy steps.
const recognizedMigrations: ReadonlyMap<number, DocumentMigration> = new Map()
const currentVersion = 1

function reject(code: MigrationFailureCode, path: string, message: string): MigrationResult<never> {
  return { success: false, code, errors: [{ path, message: `${path} ${message}` }] }
}

function isEnvelope(input: unknown): input is { format: unknown; formatVersion?: unknown } {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    && Object.hasOwn(input, 'format') && 'format' in input
}

export function migrateDocument(input: unknown): MigrationResult<AngieDocumentV1> {
  if (!isEnvelope(input) || input.format !== 'angie-dashboard') {
    return reject('invalid-format', 'format', 'no identifica un documento Angie Dashboard')
  }
  if (!Number.isInteger(input.formatVersion)) {
    return reject('invalid-version', 'formatVersion', 'debe ser un entero que identifique una versión')
  }
  let version = input.formatVersion as number
  if (version > currentVersion) {
    return reject('future-version', 'formatVersion', 'pertenece a una versión futura no reconocida')
  }

  let candidate: unknown = input
  let migrated = false
  while (version < currentVersion) {
    const step = recognizedMigrations.get(version)
    if (!step) return reject('unsupported-old-version', 'formatVersion', 'es una versión antigua no compatible')
    const source = step.validateSource(candidate)
    if (!source.success) return { success: false, code: 'invalid-document', errors: source.errors }
    // A conversion receives a detached copy, never the imported original.
    try {
      candidate = step.migrate(structuredClone(source.document))
    } catch {
      return reject('invalid-document', '$', 'no se pudo migrar el documento')
    }
    if (step.targetVersion <= version || step.targetVersion > currentVersion
      || !isEnvelope(candidate) || candidate.format !== 'angie-dashboard'
      || candidate.formatVersion !== step.targetVersion) {
      return reject('invalid-document', 'formatVersion', 'no corresponde a la migración reconocida')
    }
    version = step.targetVersion
    migrated = true
  }

  const result = validateDocument(candidate)
  if (!result.success) return { success: false, code: 'invalid-document', errors: result.errors }
  return { success: true, document: structuredClone(result.document), migrated }
}
