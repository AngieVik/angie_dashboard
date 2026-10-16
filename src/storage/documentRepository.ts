import type Dexie from 'dexie'
import { migrateDocument } from '../domain/document/migrateDocument'
import { serializeDocument } from '../domain/document/serializeDocument'
import type { AngieDocument, DocumentModuleId } from '../domain/document/types'
import { createDatabase } from './db'

export interface DocumentSession { openModules: DocumentModuleId[] }
export interface RecoverableDocument { key: string; title: string; savedAt: string }
export interface LocalDocument { document: AngieDocument; session: DocumentSession }
export interface ActiveDocumentRepository {
  loadActive(): Promise<AngieDocument | null>
  saveActive(document: AngieDocument, session?: DocumentSession): Promise<void>
  clearActive(): Promise<void>
  loadActiveSession?(): Promise<DocumentSession>
  replaceActive?(document: AngieDocument, session: DocumentSession): Promise<void>
  listRecoverable?(): Promise<RecoverableDocument[]>
  loadRecoverable?(key: string): Promise<LocalDocument | null>
  recoverySource?: 'active' | 'previous'
  lastSavedAt?: string
  needsUpgrade?: boolean
}
interface LocalRecord { key: string; document: unknown; session?: unknown; revision?: number; savedAt?: string }
const moduleIds = new Set(['board', 'elements', 'dotations', 'information', 'operations', 'coordinates', 'map', 'plan', 'clock', 'calculator', 'notebook', 'timeline'])
export function normalizeSession(value: unknown): DocumentSession {
  const ids = value && typeof value === 'object' && 'openModules' in value ? value.openModules : []
  return { openModules: Array.isArray(ids) ? [...new Set(ids.filter((id): id is DocumentModuleId => typeof id === 'string' && moduleIds.has(id)))] : [] }
}
export class DocumentConflictError extends Error {
  constructor() { super('El documento cambió en otra pestaña. Recupera su versión o conserva expresamente tus cambios antes de continuar.'); this.name = 'DocumentConflictError' }
}
export class DocumentRepository implements ActiveDocumentRepository {
  private expectedRevision: number | null | undefined
  private session: DocumentSession = { openModules: [] }
  needsUpgrade = false
  recoverySource: 'active' | 'previous' = 'active'
  lastSavedAt?: string
  constructor(private readonly db: Dexie = createDatabase()) {}
  private async open() { if (!this.db.isOpen()) await this.db.open() }
  async loadActive(): Promise<AngieDocument | null> {
    await this.open()
    const table = this.db.table<LocalRecord, string>('documents')
    const [record, previous] = await this.db.transaction('r', table, () => Promise.all([table.get('active'), table.get('previous')]))
    this.expectedRevision = record ? record.revision ?? 0 : null
    this.recoverySource = 'active'
    if (!record) { this.session = { openModules: [] }; return null }
    let result = migrateDocument(record.document)
    let selected = record
    if (!result.success && previous) {
      const fallback = migrateDocument(previous.document)
      if (fallback.success) { result = fallback; selected = previous; this.recoverySource = 'previous' }
    }
    if (!result.success) throw new Error(result.errors.map(error => error.message).join('\n'))
    this.needsUpgrade = result.migrated
    this.session = normalizeSession(selected.session)
    this.lastSavedAt = selected.savedAt && Number.isFinite(Date.parse(selected.savedAt)) ? selected.savedAt : undefined
    return result.document
  }
  async loadActiveSession(): Promise<DocumentSession> { return structuredClone(this.session) }
  private async write(document: AngieDocument, session: DocumentSession | undefined, archive: boolean) {
    const copy: AngieDocument = JSON.parse(serializeDocument(document))
    const localSession = normalizeSession(session ?? this.session)
    await this.open()
    const table = this.db.table<LocalRecord, string>('documents')
    let nextRevision = 0
    await this.db.transaction('rw', table, async () => {
      const current = await table.get('active')
      const actual = current ? current.revision ?? 0 : null
      if (this.expectedRevision !== undefined && this.expectedRevision !== actual) throw new DocumentConflictError()
      nextRevision = (actual ?? 0) + 1
      if (current) {
        if (migrateDocument(current.document).success) {
          await table.put({ ...current, key: 'previous' })
          if (archive) await table.put({ ...current, key: 'archive:' + crypto.randomUUID() })
        } else await table.put({ ...current, key: 'damaged' })
      }
      if (archive) {
        const archives = (await table.toArray()).filter(record => record.key.startsWith('archive:')).sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0))
        await table.bulkDelete(archives.slice(5).map(record => record.key))
      }
      await table.put({ key: 'active', document: copy, session: localSession, revision: nextRevision, savedAt: new Date().toISOString() })
    })
    this.needsUpgrade = false
    this.expectedRevision = nextRevision
    this.lastSavedAt = new Date().toISOString()
    this.session = localSession
    this.recoverySource = 'active'
  }
  saveActive(document: AngieDocument, session?: DocumentSession): Promise<void> { return this.write(document, session, false) }
  replaceActive(document: AngieDocument, session: DocumentSession = { openModules: [] }): Promise<void> { return this.write(document, session, true) }
  async listRecoverable(): Promise<RecoverableDocument[]> {
    await this.open()
    return (await this.db.table<LocalRecord, string>('documents').toArray())
      .filter(record => record.key === 'previous' || record.key.startsWith('archive:'))
      .sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0))
      .flatMap(record => {
        const result = migrateDocument(record.document)
        return result.success ? [{ key: record.key, title: result.document.document.title, savedAt: record.savedAt ?? result.document.document.updatedAt }] : []
      })
  }
  async loadRecoverable(key: string): Promise<LocalDocument | null> {
    if (key !== 'previous' && !key.startsWith('archive:')) return null
    await this.open()
    const record = await this.db.table<LocalRecord, string>('documents').get(key)
    if (!record) return null
    const result = migrateDocument(record.document)
    if (!result.success) throw new Error(result.errors.map(error => error.message).join('\n'))
    return { document: result.document, session: normalizeSession(record.session) }
  }
  async clearActive(): Promise<void> {
    await this.open()
    await this.db.table('documents').delete('active')
    this.expectedRevision = null
  }
}
