import type Dexie from 'dexie'
import { DocumentCompatibilityRequired, readPortableDocument } from '../domain/document/documentCompatibility'
import { validateWorkingDocument } from '../domain/document/validateDocument'
import type { AngieDocument } from '../domain/document/types'
import type { LocalRecord } from './documentCatalog'

export interface ResourceCleanupResult {
  inspectedRecords: number
  referencedResources: number
  protectedRecords: string[]
  removedImages: number
  removedGpx: number
}

const recordFields = new Set(['key', 'document', 'session', 'revision', 'savedAt', 'capturedAt'])

function isPresence(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const presence = value as Record<string, unknown>
  return Object.keys(presence).length === 3 && typeof presence.documentId === 'string' &&
    typeof presence.seenAt === 'string' && Number.isFinite(Date.parse(presence.seenAt)) && typeof presence.closed === 'boolean'
}

function references(record: LocalRecord): AngieDocument | null {
  // Unknown keys may belong to an older/newer contract. Never infer ownership
  // from their catalog entry or discard them as if they were session metadata.
  if (!/^(board:|snapshot:|archive:|previous:|damaged:)/.test(record.key) && record.key !== 'active' && record.key !== 'previous') return null
  try {
    const current = validateWorkingDocument(record.document)
    if (current.success) return current.document
    const legacy = readPortableDocument(record.document)
    return legacy.success ? legacy.document : null
  } catch (error) {
    if (error instanceof DocumentCompatibilityRequired) throw error
    return null
  }
}

// The catalog is a browsing index, not proof that every retained reference was
// identified. Inspect source records without rewriting them or reading blobs.
// The read and sweep share a write transaction with all resource writers; when
// called during explicit removal, the parent's record/catalog deletion is atomic too.
export function removeOrphanedResources(db: Dexie): Promise<ResourceCleanupResult> {
  return db.transaction('rw', ['documents', 'imageResources', 'gpxResources'], async () => {
    const used = new Set<string>()
    const result: ResourceCleanupResult = { inspectedRecords: 0, referencedResources: 0, protectedRecords: [], removedImages: 0, removedGpx: 0 }
    await db.table<LocalRecord, string>('documents').each(record => {
      result.inspectedRecords++
      if (typeof record.key !== 'string' || Object.keys(record).some(field => !recordFields.has(field))) {
        result.protectedRecords.push(String(record.key)); return
      }
      if (record.key === 'session-presence' && isPresence(record.document)) return
      const document = references(record)
      if (!document) { result.protectedRecords.push(record.key); return }
      const image = document.board.backgroundImage
      if (image && 'resourceId' in image) used.add('image:' + image.resourceId)
      for (const reference of document.map?.gpx ?? []) used.add('gpx:' + reference.fingerprint)
    })
    result.referencedResources = used.size
    // An unreadable record can refer to any original. No deletion is proven
    // safe until that record is understood or explicitly removed by the user.
    if (result.protectedRecords.length) return result
    for (const [tableName, prefix, pattern, count] of [
      ['imageResources', 'image:', /^sha256:[a-f0-9]{64}$/, 'removedImages'],
      ['gpxResources', 'gpx:', /^[a-f0-9]{64}$/, 'removedGpx'],
    ] as const) {
      const table = db.table(tableName)
      const keys = (await table.toCollection().primaryKeys()).filter((key): key is string =>
        typeof key === 'string' && pattern.test(key) && !used.has(prefix + key))
      // Only recognized identities in our resource tables qualify. Unknown
      // resource formats, handles, folders and independent stores stay intact.
      for (let offset = 0; offset < keys.length; offset += 100) await table.bulkDelete(keys.slice(offset, offset + 100))
      result[count] = keys.length
    }
    return result
  })
}
