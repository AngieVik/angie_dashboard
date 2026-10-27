import type Dexie from 'dexie'
import { migrateDocument } from '../domain/document/migrateDocument'
import { serializeDocument } from '../domain/document/serializeDocument'
import type { AngieDocument, DocumentModuleId } from '../domain/document/types'
import { createDatabase } from './db'

export interface DocumentSession { openModules: DocumentModuleId[] }
export interface SessionPresence { documentId: string; seenAt: string; closed: boolean }
export interface RecoverableDocument { key: string; title: string; savedAt: string; documentId?: string; source?: 'device' | 'folder' }
export interface LocalDocument { document: AngieDocument; session: DocumentSession; savedAt?: string; revision?: number; resourceFolder?: string; resourceAccessId?: string; resourceVersion?: string }
export interface ActiveDocumentRepository {
  loadActive(): Promise<AngieDocument | null>
  saveActive(document: AngieDocument, session?: DocumentSession): Promise<void>
  clearActive(documentId?: string): Promise<void>
  loadActiveSession?(): Promise<DocumentSession>
  replaceActive?(document: AngieDocument, session: DocumentSession): Promise<void>
  listRecoverable?(): Promise<RecoverableDocument[]>
  loadRecoverable?(key: string): Promise<LocalDocument | null>
  readPresence?(): Promise<SessionPresence | null>
  rememberPresence?(presence: SessionPresence): Promise<void>
  prepareOpen?(documentId: string, revision?: number): Promise<void>
  recoverySource?: 'active' | 'previous'
  lastSavedAt?: string
  needsUpgrade?: boolean
}
interface LocalRecord { key: string; document: unknown; session?: unknown; revision?: number; savedAt?: string; capturedAt?: string }
const moduleIds = new Set(['board', 'elements', 'dotations', 'information', 'operations', 'coordinates', 'map', 'forecast', 'openMeteo', 'plan', 'clock', 'calculator', 'notebook', 'timeline', 'reports'])
export function normalizeSession(value: unknown): DocumentSession {
  const ids = value && typeof value === 'object' && 'openModules' in value ? value.openModules : []
  return { openModules: Array.isArray(ids) ? [...new Set(ids.filter((id): id is DocumentModuleId => typeof id === 'string' && moduleIds.has(id)))] : [] }
}
export class DocumentConflictError extends Error {
  constructor() { super('Este UIBoard cambió en otra pestaña. Conserva los cambios y abre su recuperación en rama antes de continuar.'); this.name = 'DocumentConflictError' }
}

export class DocumentRepository implements ActiveDocumentRepository {
  private expectedRevisions = new Map<string, number | null>()
  private session: DocumentSession = { openModules: [] }
  needsUpgrade = false
  recoverySource: 'active' | 'previous' = 'active'
  lastSavedAt?: string
  constructor(private readonly db: Dexie = createDatabase()) {}
  private async open() { if (!this.db.isOpen()) await this.db.open() }

  async loadActive(): Promise<AngieDocument | null> {
    await this.open()
    const table = this.db.table<LocalRecord, string>('documents')
    const loaded = await this.db.transaction('r', table, async () => {
      const [record, previous] = await Promise.all([table.get('active'), table.get('previous')])
      if (!record) return null
      let selected = record
      let result = migrateDocument(record.document)
      this.recoverySource = 'active'
      if (!result.success && previous) {
        const fallback = migrateDocument(previous.document)
        if (fallback.success) { result = fallback; selected = previous; this.recoverySource = 'previous' }
      }
      if (!result.success) throw new Error(result.errors.map(error => error.message).join('\n'))
      const board = await table.get('board:' + result.document.document.id)
      return { document: result.document, migrated: result.migrated, selected, board }
    })
    if (!loaded) return null
    const { document, migrated, selected, board } = loaded
    this.expectedRevisions.set(document.document.id, board ? board.revision ?? 0 : null)
    this.session = normalizeSession(selected.session)
    this.lastSavedAt = selected.savedAt
    this.needsUpgrade = migrated
    return document
  }
  async loadActiveSession(): Promise<DocumentSession> { return structuredClone(this.session) }

  private async write(document: AngieDocument, session: DocumentSession | undefined, archive: boolean) {
    const copy: AngieDocument = JSON.parse(serializeDocument(document))
    const localSession = normalizeSession(session ?? this.session)
    await this.open()
    const table = this.db.table<LocalRecord, string>('documents')
    const id = copy.document.id, key = 'board:' + id, timestamp = new Date().toISOString()
    let nextRevision = 0
    await this.db.transaction('rw', table, async () => {
      const current = await table.get(key)
      const expected = this.expectedRevisions.get(id)
      const actual = current ? current.revision ?? 0 : null
      if (expected !== undefined && expected !== actual) throw new DocumentConflictError()
      if (expected === undefined && current && serializeDocument(migrateRecord(current)) !== serializeDocument(copy)) throw new DocumentConflictError()
      nextRevision = (actual ?? 0) + 1
      const active = await table.get('active')
      if (active) {
        const legacy = migrateDocument(active.document)
        if (legacy.success) {
          const legacyKey = 'board:' + legacy.document.document.id
          if (!await table.get(legacyKey)) await table.put({ ...active, key: legacyKey })
          await table.put({ ...active, key: 'previous' })
        } else await table.put({ ...active, key: 'damaged:' + crypto.randomUUID() })
      }
      if (current && migrateDocument(current.document).success && serializeDocument(migrateRecord(current)) !== serializeDocument(copy)) {
        await table.put({ ...current, key: 'previous:' + id })
        const snapshots = (await table.toArray()).filter(record => record.key.startsWith('snapshot:' + id + ':'))
          .sort((a, b) => (b.capturedAt ?? b.savedAt ?? '').localeCompare(a.capturedAt ?? a.savedAt ?? ''))
        if (archive || !snapshots.length || Date.parse(timestamp) - Date.parse(snapshots[0]!.capturedAt ?? snapshots[0]!.savedAt ?? '') >= 5 * 60 * 1000) {
          const snapshot = { ...current, key: `snapshot:${id}:${crypto.randomUUID()}`, capturedAt: timestamp }
          await table.put(snapshot)
          snapshots.unshift(snapshot)
          await table.bulkDelete(snapshots.slice(5).map(record => record.key))
        }
      } else if (current && !migrateDocument(current.document).success) {
        await table.put({ ...current, key: 'damaged:' + id + ':' + crypto.randomUUID() })
      }
      const record = { key, document: copy, session: localSession, revision: nextRevision, savedAt: timestamp }
      await table.put(record)
      await table.put({ ...record, key: 'active' })
    })
    this.expectedRevisions.set(id, nextRevision)
    this.session = localSession
    this.lastSavedAt = timestamp
    this.needsUpgrade = false
    this.recoverySource = 'active'
  }
  saveActive(document: AngieDocument, session?: DocumentSession): Promise<void> { return this.write(document, session, false) }
  replaceActive(document: AngieDocument, session: DocumentSession): Promise<void> { return this.write(document, session, true) }

  async listRecoverable(): Promise<RecoverableDocument[]> {
    await this.open()
    const records = (await this.db.table<LocalRecord, string>('documents').toArray())
      .filter(record => /^(board:|previous:|snapshot:|archive:)/.test(record.key) || record.key === 'previous' || record.key === 'active')
      .flatMap(record => {
        const result = migrateDocument(record.document)
        return result.success ? [{ record, document: result.document, savedAt: record.savedAt ?? result.document.document.updatedAt }] : []
      }).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    const groups = new Map<string, typeof records>()
    for (const entry of records) {
      const id = entry.document.document.id
      const group = groups.get(id) ?? []
      group.push(entry); groups.set(id, group)
    }
    const recoverable: RecoverableDocument[] = []
    for (const [id, group] of groups) {
      const current = group.find(entry => entry.record.key === 'board:' + id) ?? group[0]!
      const versions = group.filter(entry => /^(snapshot:|archive:)/.test(entry.record.key))
      const candidates = versions.length ? versions : group.filter(entry => entry !== current)
      const selected = [current], contents = new Set([serializeDocument(current.document)])
      for (const entry of candidates) {
        const text = serializeDocument(entry.document)
        if (contents.has(text)) continue
        selected.push(entry); contents.add(text)
        if (selected.length === 6) break
      }
      for (const entry of selected) recoverable.push({ key: entry.record.key, title: entry.document.document.title,
        documentId: id, savedAt: entry.savedAt, source: 'device' })
    }
    return recoverable.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  }
  async loadRecoverable(key: string): Promise<LocalDocument | null> {
    if (!/^(board:|previous:|snapshot:|archive:)/.test(key) && key !== 'previous' && key !== 'active') return null
    await this.open()
    const record = await this.db.table<LocalRecord, string>('documents').get(key)
    if (!record) return null
    const result = migrateDocument(record.document)
    if (!result.success) throw new Error(result.errors.map(error => error.message).join('\n'))
    return { document: result.document, session: normalizeSession(record.session), savedAt: record.savedAt ?? result.document.document.updatedAt,
      revision: key.startsWith('board:') ? record.revision : undefined }
  }
  async prepareOpen(documentId: string, revision?: number): Promise<void> {
    await this.open()
    const record = await this.db.table<LocalRecord, string>('documents').get('board:' + documentId)
    const current = record ? record.revision ?? 0 : null
    if (revision !== undefined && current !== revision) throw new DocumentConflictError()
    this.expectedRevisions.set(documentId, current)
  }
  async readPresence(): Promise<SessionPresence | null> {
    await this.open()
    const value = (await this.db.table<LocalRecord, string>('documents').get('session-presence'))?.document
    if (!value || typeof value !== 'object' || !('documentId' in value) || typeof value.documentId !== 'string' ||
      !('seenAt' in value) || typeof value.seenAt !== 'string' || !Number.isFinite(Date.parse(value.seenAt)) ||
      !('closed' in value) || typeof value.closed !== 'boolean') return null
    return { documentId: value.documentId, seenAt: value.seenAt, closed: value.closed }
  }
  async rememberPresence(presence: SessionPresence): Promise<void> {
    await this.open()
    await this.db.table<LocalRecord, string>('documents').put({ key: 'session-presence', document: presence })
  }
  async clearActive(documentId?: string): Promise<void> {
    await this.open()
    const table = this.db.table<LocalRecord, string>('documents')
    await this.db.transaction('rw', table, async () => {
      const active = await table.get('active')
      const result = active ? migrateDocument(active.document) : null
      if (documentId && result?.success && result.document.document.id !== documentId) return
      const id = documentId ?? (result?.success ? result.document.document.id : undefined)
      if (active) {
        if (result?.success) {
          const key = 'board:' + result.document.document.id
          if (!await table.get(key)) await table.put({ ...active, key })
        } else {
          await table.put({ ...active, key: 'damaged:' + crypto.randomUUID() })
          const previous = await table.get('previous')
          const fallback = previous ? migrateDocument(previous.document) : null
          if (previous && fallback?.success && (!documentId || fallback.document.document.id === documentId)) {
            const key = 'board:' + fallback.document.document.id
            if (!await table.get(key)) await table.put({ ...previous, key })
          }
        }
      }
      await table.delete('active')
      const presence = (await table.get('session-presence'))?.document
      if (id && (!presence || typeof presence !== 'object' || !('documentId' in presence) || presence.documentId === id)) {
        await table.put({ key: 'session-presence', document: { documentId: id, seenAt: new Date().toISOString(), closed: true } })
      }
    })
    this.session = { openModules: [] }
  }
}

function migrateRecord(record: LocalRecord): AngieDocument {
  const result = migrateDocument(record.document)
  if (!result.success) throw new Error('La recuperación local no es válida. Se conserva para su recuperación.')
  return result.document
}
