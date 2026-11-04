import Dexie from 'dexie'
import { DocumentCompatibilityRequired, loadDocumentCompatibility, readPortableDocument } from '../domain/document/documentCompatibility'
import { serializeWorkingDocument as serializeDocument } from '../domain/document/serializeWorkingDocument'
import { validateWorkingDocument } from '../domain/document/validateDocument'
import { imageResource, registerImage, workingDocument } from './imageResources'
import type { ImageResource } from './imageResources'
import { gpxResource, registerGpx, commitGpxOriginals } from './gpxResources'
import type { GpxResource } from './gpxResources'
import { checkDocumentBudget, InputBudgetError } from '../domain/input/inputBudgets'
import type { AngieDocument, DocumentModuleId, MapGpxReference } from '../domain/document/types'
import { createDatabase } from './db'
import { DocumentSave } from './documentSave'
import type { PreparedDocumentSave } from './documentSave'
import { catalogRecord } from './documentCatalog'
import { catalogPage } from './catalogPage'
import type { CatalogEntry, LocalRecord, RecoveryQuery, RecoveryPage, RetainedRemoval, LibraryStorage } from './documentCatalog'
import { readStorageCapacity } from '../platform/storageCapacity'
import { removeOrphanedResources } from './resourceCleanup'
import type { ResourceCleanupResult } from './resourceCleanup'

export interface DocumentSession { openModules: DocumentModuleId[] }
export interface SessionPresence { documentId: string; seenAt: string; closed: boolean }
export interface RecoverableDocument { key: string; title: string; savedAt: string; documentId?: string; source?: 'device' | 'folder'; revision?: number; kind?: string; resourceIds?: string[] }
export interface LocalDocument { document: AngieDocument; session: DocumentSession; savedAt?: string; revision?: number; resourceFolder?: string; resourceAccessId?: string; resourceVersion?: string }
export interface LocalResourceStatus { documentId: string; gpxFingerprints: string[] }
export interface ActiveDocumentRepository {
  loadActive(): Promise<AngieDocument | null>
  saveActive(document: AngieDocument, session?: DocumentSession, prepared?: PreparedDocumentSave): Promise<LocalResourceStatus | void>
  clearActive(documentId?: string): Promise<void>
  loadActiveSession?(): Promise<DocumentSession>
  replaceActive?(document: AngieDocument, session: DocumentSession, prepared?: PreparedDocumentSave): Promise<LocalResourceStatus | void>
  readGpx?(reference: MapGpxReference): Promise<File | null>
  listRecoverable?(): Promise<RecoverableDocument[]>
  listRecoveryPage?(query?: RecoveryQuery): Promise<RecoveryPage>
  hasDocumentTitle?(title: string, excludingId?: string): Promise<boolean>
  measureStorage?(): Promise<LibraryStorage>
  removeRetained?(request: RetainedRemoval): Promise<ResourceCleanupResult | void>
  loadRecoverable?(key: string): Promise<LocalDocument | null>
  readPresence?(): Promise<SessionPresence | null>
  rememberPresence?(presence: SessionPresence): Promise<void>
  prepareOpen?(documentId: string, revision?: number): Promise<void>
  recoverySource?: 'active' | 'previous'
  lastSavedAt?: string
  needsUpgrade?: boolean
}
const moduleIds = new Set(['board', 'elements', 'dotations', 'information', 'operations', 'coordinates', 'map', 'plan', 'clock', 'calendar', 'calculator', 'notebook', 'timeline', 'reports'])
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

  // Both legacy portable records and referenced working records enter through this gate.
  // waitFor keeps IndexedDB alive while checking a blob's digest or importing legacy bytes.
  private async readDocument(input: unknown) {
    const image = (input as AngieDocument | null)?.board?.backgroundImage
    const referenced = image && typeof image === 'object' && 'resourceId' in image
    const result = referenced ? validateWorkingDocument(input) : readPortableDocument(input)
    if (!result.success) return result
    if (referenced) {
      const resource = await this.db.table<ImageResource, string>('imageResources').get(image.resourceId)
      if (!resource) throw new Error('Falta la imagen original de la recuperación. Se conserva el registro.')
      await Dexie.waitFor(registerImage(resource.blob, image.resourceId))
    }
    return { ...result, document: await Dexie.waitFor(workingDocument(result.document)),
      migrated: 'migrated' in result && result.migrated === true }
  }
  private async storeResources(document: AngieDocument) {
    const image = document.board.backgroundImage
    if (image && 'resourceId' in image) {
      const resource = imageResource(image.resourceId)
      const table = this.db.table<ImageResource, string>('imageResources')
      const existing = await table.get(resource.id)
      if (existing) await Dexie.waitFor(registerImage(existing.blob, resource.id))
      else await table.add(resource)
    }
    const table = this.db.table<GpxResource, string>('gpxResources')
    const protectedGpx = new Set<string>()
    for (const reference of document.map?.gpx ?? []) {
      if (protectedGpx.has(reference.fingerprint)) continue
      const existing = await table.get(reference.fingerprint)
      const resource = existing ?? gpxResource(reference.fingerprint)
      // Historical documents may have only references. Keep them recoverable and report the gap.
      if (!resource) continue
      await Dexie.waitFor(registerGpx(resource.blob, reference.fingerprint, false))
      if (!existing) await table.add(resource)
      protectedGpx.add(reference.fingerprint)
    }
    return [...protectedGpx]
  }
  private async transaction<T>(mode: 'r' | 'rw', action: () => Promise<T>): Promise<T> {
    const run = () => this.db.transaction(mode, ['documents', 'documentCatalog', 'imageResources', 'gpxResources'], action)
    try { return await run() }
    catch (error) {
      if (!(error instanceof DocumentCompatibilityRequired)) throw error
      // The first transaction has aborted, including any record/catalog deletion.
      // Reload records and recheck revisions in a fresh atomic transaction.
      await loadDocumentCompatibility()
      return run()
    }
  }

  private async putRecord(record: LocalRecord) {
    await this.db.table<LocalRecord, string>('documents').put(record)
    const entry = catalogRecord(record)
    if (!entry) return
    const catalog = this.db.table<CatalogEntry, string>('documentCatalog')
    await catalog.put(entry)
  }

  private async deleteRecords(keys: string[]) {
    await this.db.table('documents').bulkDelete(keys)
    await this.db.table('documentCatalog').bulkDelete(keys)
  }

  async readGpx(reference: MapGpxReference): Promise<File | null> {
    await this.open()
    const resource = await this.db.table<GpxResource, string>('gpxResources').get(reference.fingerprint)
    if (!resource) return null
    await registerGpx(resource.blob, reference.fingerprint, false)
    return new File([resource.blob], reference.name, { type: 'application/gpx+xml', lastModified: reference.lastModified })
  }

  async loadActive(): Promise<AngieDocument | null> {
    await this.open()
    const table = this.db.table<LocalRecord, string>('documents')
    const loaded = await this.transaction('r', async () => {
      const [record, previous] = await Promise.all([table.get('active'), table.get('previous')])
      if (!record) return null
      const budget = checkDocumentBudget(record.document)
      if (budget) throw new InputBudgetError(budget)
      let selected = record
      let result
      try { result = await this.readDocument(record.document) }
      catch (error) {
        if (error instanceof DocumentCompatibilityRequired) throw error
        result = { success: false as const, errors: [{ path: 'board.backgroundImage', message: 'No se pudo leer el original de la imagen.' }] }
      }
      this.recoverySource = 'active'
      if (!result.success && previous) {
        const fallback = await this.readDocument(previous.document)
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

  private async write(document: AngieDocument, session: DocumentSession | undefined, archive: boolean, prepared?: PreparedDocumentSave) {
    if (prepared && prepared.document !== document) throw new Error('La instantánea no pertenece al documento que se guarda.')
    const snapshot = prepared ?? new DocumentSave(document).prepare()
    const copy = await workingDocument(snapshot.document)
    const text = copy === snapshot.document ? snapshot.text : serializeDocument(copy)
    const localSession = normalizeSession(session ?? this.session)
    await this.open()
    const table = this.db.table<LocalRecord, string>('documents')
    const id = copy.document.id, key = 'board:' + id, timestamp = new Date().toISOString()
    let nextRevision = 0
    let gpxFingerprints: string[] = []
    await this.transaction('rw', async () => {
      const current = await table.get(key)
      const expected = this.expectedRevisions.get(id)
      const actual = current ? current.revision ?? 0 : null
      if (expected !== undefined && expected !== actual) throw new DocumentConflictError()
      const migrated = current ? await this.readDocument(current.document) : null
      const currentText = migrated?.success ? serializeDocument(migrated.document) : null
      if (expected === undefined && current) {
        if (!migrated?.success) throw new Error('La recuperación local no es válida. Se conserva para su recuperación.')
        if (currentText !== text) throw new DocumentConflictError()
      }
      gpxFingerprints = await this.storeResources(copy)
      nextRevision = (actual ?? 0) + 1
      const active = await table.get('active')
      if (active) {
        const legacy = await this.readDocument(active.document)
        if (legacy.success) {
          await this.storeResources(legacy.document)
          const localActive = { ...active, document: legacy.document }
          const legacyKey = 'board:' + legacy.document.document.id
          if (!await table.get(legacyKey)) await this.putRecord({ ...localActive, key: legacyKey })
          await this.putRecord({ ...localActive, key: 'previous' })
        } else await this.putRecord({ ...active, key: 'damaged:' + crypto.randomUUID() })
      }
      if (current && migrated?.success && currentText !== text) {
        await this.storeResources(migrated.document)
        const localCurrent = { ...current, document: migrated.document }
        await this.putRecord({ ...localCurrent, key: 'previous:' + id })
        const snapshots: Pick<LocalRecord, 'key' | 'capturedAt' | 'savedAt'>[] = []
        // Pruning reads catalog metadata for this UIBoard, never version bodies.
        await this.db.table<CatalogEntry, string>('documentCatalog').where('[documentId+kind]').equals([id, 'snapshot']).each(({ key, capturedAt, savedAt }) => {
          snapshots.push({ key, capturedAt, savedAt })
        })
        snapshots.sort((a, b) => (b.capturedAt ?? b.savedAt ?? '').localeCompare(a.capturedAt ?? a.savedAt ?? ''))
        if (archive || !snapshots.length || Date.parse(timestamp) - Date.parse(snapshots[0]!.capturedAt ?? snapshots[0]!.savedAt ?? '') >= 5 * 60 * 1000) {
          const snapshot = { ...localCurrent, key: `snapshot:${id}:${crypto.randomUUID()}`, capturedAt: timestamp }
          await this.putRecord(snapshot)
          snapshots.unshift({ key: snapshot.key, capturedAt: timestamp })
          await this.deleteRecords(snapshots.slice(5).map(record => record.key))
        }
      } else if (current && !migrated?.success) {
        await this.putRecord({ ...current, key: 'damaged:' + id + ':' + crypto.randomUUID() })
      }
      const record = { key, document: copy, session: localSession, revision: nextRevision, savedAt: timestamp }
      await this.putRecord(record)
      await this.putRecord({ ...record, key: 'active' })
    })
    commitGpxOriginals(gpxFingerprints)
    this.expectedRevisions.set(id, nextRevision)
    this.session = localSession
    this.lastSavedAt = timestamp
    this.needsUpgrade = false
    this.recoverySource = 'active'
    return { documentId: id, gpxFingerprints }
  }
  saveActive(document: AngieDocument, session?: DocumentSession, prepared?: PreparedDocumentSave) { return this.write(document, session, false, prepared) }
  replaceActive(document: AngieDocument, session: DocumentSession, prepared?: PreparedDocumentSave) { return this.write(document, session, true, prepared) }

  async listRecoveryPage(query: RecoveryQuery = {}): Promise<RecoveryPage> {
    await this.open()
    return catalogPage(this.db.table<CatalogEntry, string>('documentCatalog'), query)
  }

  // Compatibility for older consumers: a bounded first page, never all payloads.
  async listRecoverable(): Promise<RecoverableDocument[]> { return (await this.listRecoveryPage({ limit: 100 })).entries }

  async hasDocumentTitle(title: string, excludingId?: string): Promise<boolean> {
    await this.open()
    return !!await this.db.table<CatalogEntry, string>('documentCatalog').where('titleKey')
      .equals(title.toLocaleLowerCase('es')).filter(entry => entry.documentId !== excludingId).first()
  }

  async measureStorage(): Promise<LibraryStorage> {
    await this.open()
    const catalog = this.db.table<CatalogEntry, string>('documentCatalog')
    const [identities, versions] = await Promise.all([catalog.orderBy('documentId').uniqueKeys(),
      catalog.where('[listed+savedAt+key]').between([1, Dexie.minKey, Dexie.minKey], [1, Dexie.maxKey, Dexie.maxKey]).count()])
    return { documents: identities.filter(id => typeof id === 'string' && !id.startsWith('unidentified:')).length, versions, ...await readStorageCapacity() }
  }

  async removeRetained(request: RetainedRemoval): Promise<ResourceCleanupResult> {
    if (!!request.key === !!request.documentId) throw new Error('Selecciona una versión o un documento.')
    await this.open()
    const cleanup = await this.transaction('rw', async () => {
      const catalog = this.db.table<CatalogEntry, string>('documentCatalog')
      const entries = request.key ? [await catalog.get(request.key)].filter((entry): entry is CatalogEntry => !!entry)
        : await catalog.where('documentId').equals(request.documentId!).toArray()
      if (!entries.length) throw new Error('La selección ya no está disponible. Actualiza la biblioteca.')
      const active = await catalog.get('active')
      if (entries.some(entry => entry.key === 'active' || entry.documentId === active?.documentId)) throw new Error('Cierra el UIBoard activo antes de eliminar sus guardados.')
      if (request.key && entries[0]!.kind === 'board') throw new Error('El guardado actual se elimina junto con su documento.')
      const selected = request.key ? entries[0] : entries.find(entry => entry.kind === 'board')
      if (selected && ((request.expectedRevision !== undefined && selected.revision !== request.expectedRevision) ||
        (request.expectedSavedAt !== undefined && selected.savedAt !== request.expectedSavedAt))) throw new DocumentConflictError()
      await this.deleteRecords(entries.map(entry => entry.key))
      return removeOrphanedResources(this.db)
    })
    if (request.documentId) this.expectedRevisions.delete(request.documentId)
    return cleanup
  }

  async loadRecoverable(key: string): Promise<LocalDocument | null> {
    if (!/^(board:|previous:|snapshot:|archive:|damaged:)/.test(key) && key !== 'previous' && key !== 'active') return null
    await this.open()
    return this.transaction('r', async () => {
      const record = await this.db.table<LocalRecord, string>('documents').get(key)
      if (!record) return null
      const result = await this.readDocument(record.document)
      if (!result.success) throw new Error(result.errors.map(error => error.message).join('\n'))
      return { document: result.document, session: normalizeSession(record.session), savedAt: record.savedAt ?? result.document.document.updatedAt,
        revision: key.startsWith('board:') ? record.revision : undefined }
    })
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
    await this.transaction('rw', async () => {
      const active = await table.get('active')
      const result = active ? await this.readDocument(active.document) : null
      if (documentId && result?.success && result.document.document.id !== documentId) return
      const id = documentId ?? (result?.success ? result.document.document.id : undefined)
      if (active) {
        if (result?.success) {
          const key = 'board:' + result.document.document.id
          if (!await table.get(key)) await this.putRecord({ ...active, key })
        } else {
          await this.putRecord({ ...active, key: 'damaged:' + crypto.randomUUID() })
          const previous = await table.get('previous')
          const fallback = previous ? await this.readDocument(previous.document) : null
          if (previous && fallback?.success && (!documentId || fallback.document.document.id === documentId)) {
            const key = 'board:' + fallback.document.document.id
            if (!await table.get(key)) await this.putRecord({ ...previous, key })
          }
        }
      }
      await this.deleteRecords(['active'])
      const presence = (await table.get('session-presence'))?.document
      if (id && (!presence || typeof presence !== 'object' || !('documentId' in presence) || presence.documentId === id)) {
        await this.putRecord({ key: 'session-presence', document: { documentId: id, seenAt: new Date().toISOString(), closed: true } })
      }
    })
    this.session = { openModules: [] }
  }
}
