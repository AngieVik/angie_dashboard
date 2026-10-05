import { validateDocument } from './validateDocument'
import { validateDocumentV1 } from './validateDocumentV1'
import { validateDocumentV2 } from './validateDocumentV2'
import type { AngieDocumentV1 } from './v1Types'
import type { AngieDocumentV2, OperationalStatus as LegacyStatus } from './v2Types'
import type { AngieDocumentV3, OperationalStatus, MigrationFailureCode, MigrationResult, ValidationResult } from './types'

interface DocumentMigration {
  targetVersion: number
  validateSource: (input: unknown) => ValidationResult<unknown>
  migrate: (input: unknown) => unknown
}

function convertV1(input: unknown): AngieDocumentV2 {
  const { filters, ...source } = input as AngieDocumentV1
  void filters
  return {
    ...source,
    formatVersion: 2,
    board: { ...source.board, quickNotes: source.board.quickNotes.map(note => ({ ...note, width: 180, height: 80 })) },
    elements: source.elements.map(element => ({ ...element, visual: element.visual.type === 'emoji' ? { ...element.visual, scale: 1 } : element.visual })),
    notebook: source.notebook.map(block => ({ ...block, title: block.type === 'note' ? 'Nota' : 'Checklist' })),
    moduleLayouts: Object.fromEntries(Object.entries(source.moduleLayouts).map(([id, layout]) => [id, {
      ...layout, referenceSize: { width: 1600, height: 1000 },
    }])),
  }
}

const statusConversions: Record<LegacyStatus, OperationalStatus> = {
  Disponible: 'Disponible', Asignada: 'Activada', 'En camino': 'Aproximandose', 'En el lugar': 'Interviniendo',
  'En traslado': 'Trasladando', 'En destino': 'Transfiriendo', Operativa: 'Operativa', Inoperativa: 'Inoperativa',
}
function convertV2(input: unknown): AngieDocumentV3 {
  const source = input as AngieDocumentV2
  const timeline = source.timeline.map(entry => entry.type === 'manual' ? { ...entry, revisions: [] } : {
    ...entry, previousStatus: statusConversions[entry.previousStatus], nextStatus: statusConversions[entry.nextStatus], revisions: [],
  })
  return {
    ...source, formatVersion: 3,
    board: { ...source.board, quickNotes: source.board.quickNotes.map(note => ({ ...note, title: '', scale: 1 })) },
    timeline,
    elements: source.elements.map(element => {
      if (!element.isUnit) return { ...element, pinVisible: true }
      const latest = timeline.findLast(entry => entry.type === 'status-change' && entry.unitId.toLowerCase() === element.id.toLowerCase())
      return { ...element, pinVisible: true, operational: { ...element.operational,
        status: latest?.type === 'status-change' ? latest.nextStatus : null, currentEntryId: latest?.id ?? null } }
    }),
  }
}
// Validate every original and intermediate contract without retroactive rules.
const recognizedMigrations: ReadonlyMap<number, DocumentMigration> = new Map([
  [1, { targetVersion: 2, validateSource: validateDocumentV1, migrate: convertV1 }],
  [2, { targetVersion: 3, validateSource: validateDocumentV2, migrate: convertV2 }],
])
const currentVersion = 3

function reject(code: MigrationFailureCode, path: string, message: string): MigrationResult<never> {
  return { success: false, code, errors: [{ path, message: `${path} ${message}` }] }
}

function isEnvelope(input: unknown): input is { format: unknown; formatVersion?: unknown } {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    && Object.hasOwn(input, 'format') && 'format' in input
}

export function migrateDocument(input: unknown): MigrationResult<AngieDocumentV3> {
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
