import type { Transaction } from 'dexie'

export interface LocalRecord { key: string; document: unknown; session?: unknown; revision?: number; savedAt?: string; capturedAt?: string }
export type CatalogKind = 'board' | 'snapshot' | 'archive' | 'previous' | 'active' | 'damaged'
export interface CatalogEntry {
  key: string; documentId: string; title: string; titleKey: string; kind: CatalogKind
  createdAt: string; updatedAt: string; savedAt: string; capturedAt?: string; revision?: number
  resourceIds: string[]; referencesComplete: boolean; listed: number; source: 'device' | 'folder'
}
export type RecoveryCursor = [string, string]
export interface RecoveryQuery { cursor?: RecoveryCursor; limit?: number; search?: string; fromDay?: string; toDay?: string; documentId?: string; kind?: CatalogKind }
export interface RecoveryPage { entries: CatalogEntry[]; nextCursor?: RecoveryCursor; warning?: string }
export interface RetainedRemoval { key?: string; documentId?: string; expectedRevision?: number; expectedSavedAt?: string }
export interface LibraryStorage { documents: number; versions: number; usage?: number; quota?: number; available?: number; estimateError?: string }

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
const date = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))) ?? '1970-01-01T00:00:00.000Z'
const dayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
export const recoveryDay = (value: string) => dayFormatter.format(new Date(value))

// Extract headers and references only. Validation, migration and original-byte
// verification belong to opening a selected record, never to browsing metadata.
export function catalogRecord(record: LocalRecord): CatalogEntry | null {
  const prefix = record.key.split(':')[0]
  if (!['board', 'snapshot', 'archive', 'previous', 'active', 'damaged'].includes(prefix!)) return null
  const document = object(record.document), header = object(document.document)
  const image = object(object(document.board).backgroundImage), map = object(document.map)
  const gpx = Array.isArray(map.gpx) ? map.gpx : []
  const resourceIds = new Set<string>()
  if (typeof image.resourceId === 'string') resourceIds.add('image:' + image.resourceId)
  for (const item of gpx) if (typeof object(item).fingerprint === 'string') resourceIds.add('gpx:' + object(item).fingerprint)
  return {
    key: record.key, kind: prefix as CatalogKind,
    documentId: typeof header.id === 'string' ? header.id : 'unidentified:' + record.key,
    title: typeof header.title === 'string' ? header.title.slice(0, 256) : 'Registro sin identificar',
    titleKey: typeof header.title === 'string' ? header.title.toLocaleLowerCase('es').slice(0, 256) : '',
    createdAt: date(header.createdAt), updatedAt: date(header.updatedAt, record.savedAt),
    savedAt: date(record.savedAt, header.updatedAt, header.createdAt), capturedAt: record.capturedAt, revision: record.revision,
    resourceIds: [...resourceIds], referencesComplete: document.format === 'angie-dashboard' && [1, 2, 3, 4].includes(document.formatVersion as number) &&
      typeof header.id === 'string' && !!document.board &&
      (!object(document.board).backgroundImage || typeof image.resourceId === 'string' || typeof image.dataUrl === 'string') &&
      (map.gpx === undefined || Array.isArray(map.gpx) && gpx.every(item => typeof object(item).fingerprint === 'string')),
    listed: 1, source: 'device',
  }
}

export async function indexLegacyDocuments(transaction: Transaction) {
  const documents = transaction.table<LocalRecord, string>('documents')
  const catalog = transaction.table<CatalogEntry, string>('documentCatalog')
  let last: string | undefined
  // Bound memory during the one-time schema upgrade; no originals are read and
  // no historical document is rewritten. Upgrade failure rolls back everything.
  while (true) {
    const records = await (last === undefined ? documents.orderBy(':id') : documents.where(':id').above(last)).limit(25).toArray()
    if (!records.length) break
    await catalog.bulkPut(records.flatMap(record => { const entry = catalogRecord(record); return entry ? [entry] : [] }))
    last = records.at(-1)!.key
  }
}
