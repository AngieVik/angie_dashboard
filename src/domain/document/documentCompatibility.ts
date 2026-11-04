import { validateCurrentDocument } from './validateCurrentDocument'
import type { AngieDocumentV4, MigrationResult } from './types'

type MigrateDocument = typeof import('./migrateDocument').migrateDocument
let migrateLegacy: MigrateDocument | undefined
let loading: Promise<void> | undefined

// Control flow for a transaction that must roll back before loading code.
export class DocumentCompatibilityRequired extends Error {
  constructor() { super('Se necesita la compatibilidad documental histórica.'); this.name = 'DocumentCompatibilityRequired' }
}

export function loadDocumentCompatibility(): Promise<void> {
  loading ??= import('./migrateDocument').then(module => {
    migrateLegacy = module.migrateDocument
  }).catch(error => {
    loading = undefined
    throw new Error('No se pudo cargar la compatibilidad de documentos antiguos. Reintenta la operación.', { cause: error })
  })
  return loading
}

// Synchronous transactional reader: a cold historical version asks the owner
// to abort and load compatibility outside the transaction before retrying.
export function readPortableDocument(input: unknown): MigrationResult<AngieDocumentV4> {
  const current = validateCurrentDocument(input)
  if (current !== null) return current
  if (!migrateLegacy) throw new DocumentCompatibilityRequired()
  return migrateLegacy(input)
}
