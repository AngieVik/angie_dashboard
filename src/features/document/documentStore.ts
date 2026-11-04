import { useSyncExternalStore } from 'react'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { renameDocument } from './documentEdits'
import type { DocumentCommand } from '../../domain/document/documentCommand'
import { serializeWorkingDocument as serializeDocument } from '../../domain/document/serializeWorkingDocument'
import { serializeDocument as serializePortableDocument } from '../../domain/document/serializeDocument'
import { workingDocument, portableDocument, registerImage } from '../../storage/imageResources'
import { checkDocumentBudget, InputBudgetError } from '../../domain/input/inputBudgets'
import type { AngieDocument, DocumentModuleId, MapGpxReference } from '../../domain/document/types'
import { createBrowserFilePlatform, loadVisibleDocument, suggestFilename } from '../../platform/files/fileAccess'
import type { FileAccessContext } from '../../platform/files/fileAccess'
import type { DocumentFile, SaveFileHandle } from '../../platform/files/fileHandleTypes'
import type { VisibleDocumentPreparation } from '../../platform/files/documentWorkerProtocol'
import { DocumentRepository, DocumentConflictError, normalizeSession } from '../../storage/documentRepository'
import type { ActiveDocumentRepository, DocumentSession, LocalDocument, RecoverableDocument } from '../../storage/documentRepository'
import type { RecoveryQuery, RecoveryPage, RetainedRemoval } from '../../storage/documentCatalog'
import { readGpxAccess } from '../../storage/gpxAccessRepository'
import { registerGpx, releaseGpxOriginals } from '../../storage/gpxResources'
import { createAutosave } from '../../storage/autosave'
import { DocumentSave } from '../../storage/documentSave'
import type { PreparedDocumentSave } from '../../storage/documentSave'
import { createLazyBrowserWorkspaceFiles } from '../../platform/files/lazyWorkspaceFiles'
import type { WorkspaceSaveResult } from '../../platform/files/workspaceFiles'
import { filterWorkspaceName, workspaceNameError } from '../../platform/files/workspaceNames'
import type { createDocumentReport } from './documentReport'
import type { ReportSelection } from './reportSections'
import type { MapReportContent } from './mapReport'
import type { BoardReportContent, BoardReportRequest } from './boardReport'
import type { TimerRecord } from '../clock/timerTypes'
import { createReportIssue, reportIssueKey } from './reportIssues'
import type { ReportIssue, ReportResourceAction } from './reportIssues'
import { DEFAULT_REPORT_PAGE } from './reportPageOptions'
import type { ReportPageOptions } from './reportPageOptions'

export interface DocumentSnapshot {
  document: AngieDocument
  documentGeneration: number
  active: boolean
  ready: boolean
  openModules: DocumentModuleId[]
  autosaveUnavailable: boolean
  localStorageMessage: string | null
  autosaveSaving: boolean
  localSavedAt: string | null
  localGpxFingerprints: string[]
  storageConflict: boolean
  recoveredPrevious: boolean
  recoveryPending: boolean
  recoveryTitle: string | null
  recoverySeenAt: string | null
  replacementBlocked: boolean
  replacing: boolean
  fileBusy: boolean
  documentReading: boolean
  fileDirty: boolean
  fileSavedAt: string | null
  downloadStartedAt: string | null
  fileMessage: string | null
  fileMessageRevision: number
  workspaceStatus: 'unconfigured' | 'pending' | 'saving' | 'saved' | 'error'
  workspacePath: string | null
  workspaceSavedAt: string | null
  workspaceMessage: string | null
  workspacePermissionRequired: boolean
}
export interface GeneratedReport {
  document: AngieDocument
  report: ReturnType<typeof createDocumentReport>
  resolveResource: (issue: ReportIssue, action: ReportResourceAction) => Promise<GeneratedReport | null>
}
interface Replacement extends LocalDocument { handle?: SaveFileHandle; fileDirty: boolean }

export function createDocumentStore(repository: ActiveDocumentRepository, initialContext: FileAccessContext) {
  let state: DocumentSnapshot = {
    document: createEmptyDocument(), documentGeneration: 0, active: false, ready: false, openModules: [],
    autosaveUnavailable: false, localStorageMessage: null, autosaveSaving: false, localSavedAt: null, localGpxFingerprints: [], storageConflict: false, recoveredPrevious: false,
    recoveryPending: false, recoveryTitle: null, recoverySeenAt: null, replacementBlocked: false, replacing: false,
    fileBusy: false, documentReading: false, fileDirty: false, fileSavedAt: null, downloadStartedAt: null, fileMessage: null, fileMessageRevision: 0,
    workspaceStatus: 'unconfigured', workspacePath: null,
    workspaceSavedAt: null, workspaceMessage: null, workspacePermissionRequired: false,
  }
  let revision = 0, localRevision = 0
  let localSavedRevision = -1
  let documentSave: DocumentSave | undefined
  let initialization: Promise<void> | undefined
  let recoveryCandidate: LocalDocument | null = null
  let workLocally = false
  let presenceWrite = Promise.resolve()
  let pendingRead: { controller: AbortController; generation: number; revision: number } | null = null
  const listeners = new Set<() => void>()
  const now = () => (initialContext.now?.() ?? new Date()).toISOString()
  const session = (): DocumentSession => ({ openModules: state.openModules })
  function update(patch: Partial<DocumentSnapshot>) {
    if (pendingRead && (patch.replacing || (patch.documentGeneration !== undefined && patch.documentGeneration !== pendingRead.generation))) {
      pendingRead.controller.abort()
      pendingRead = null
      patch.documentReading = false
    }
    if (patch.document) {
      const next = new Set(patch.document.map?.gpx.map(reference => reference.fingerprint) ?? [])
      releaseGpxOriginals((state.document.map?.gpx ?? []).map(reference => reference.fingerprint).filter(fingerprint => !next.has(fingerprint)))
    }
    state = { ...state, ...patch, fileMessageRevision: 'fileMessage' in patch ? state.fileMessageRevision + 1 : state.fileMessageRevision }
    listeners.forEach(listener => listener())
  }
  const autosave = createAutosave(repository, (available, error, resources) => {
    const conflict = error instanceof DocumentConflictError
    const quota = error && typeof error === 'object' && 'name' in error && error.name === 'QuotaExceededError'
    update({ autosaveUnavailable: !available, storageConflict: available ? false : conflict || state.storageConflict,
      localStorageMessage: available ? null : quota ? 'No hay espacio disponible. Los guardados anteriores se conservan. Gestiona los documentos del dispositivo desde Recuperar UIBoard y reintenta.' : null,
      ...(resources?.documentId === state.document.document.id ? { localGpxFingerprints: resources.gpxFingerprints } : {}) })
  })
  function currentSave() { return documentSave ??= new DocumentSave(state.document) }

  function rememberPresence() {
    if (!state.active || state.replacing || !repository.rememberPresence) return presenceWrite
    const presence = { documentId: state.document.document.id, seenAt: now(), closed: false }
    presenceWrite = presenceWrite.then(() => repository.rememberPresence!(presence)).catch(() => {})
    return presenceWrite
  }
  function applyWorkspaceResult(result: WorkspaceSaveResult, savedRevision: number) {
    if (result.status === 'saved') {
      update({ workspaceStatus: result.resourcesPending ? 'error' : savedRevision === revision ? 'saved' : 'pending', workspacePath: result.path,
        workspaceSavedAt: result.savedAt, workspaceMessage: result.message ?? null, workspacePermissionRequired: false,
        fileDirty: Boolean(result.resourcesPending) || savedRevision !== revision, fileSavedAt: result.savedAt })
    } else if (result.status === 'error') {
      update({ workspaceStatus: 'error', workspaceMessage: result.message, workspacePermissionRequired: result.permissionRequired ?? false })
    } else update({ workspaceStatus: workLocally ? 'pending' : 'unconfigured', workspacePath: null, workspaceSavedAt: null,
      workspaceMessage: null, workspacePermissionRequired: false })
  }
  // Only explicit file actions call this; edits and lifecycle events save locally.
  async function saveWorkspaceNow(): Promise<WorkspaceSaveResult> {
    workLocally = false
    if (!state.active) return { status: 'unconfigured' as const }
    const captured = revision, generation = state.documentGeneration
    let result: WorkspaceSaveResult
    if (state.storageConflict) result = { status: 'error', message: 'Hay cambios en otra pestaña. Utiliza Guardar como para conservar los tuyos.' }
    else if (!initialContext.workspace) result = { status: 'unconfigured' }
    else {
      update({ workspaceStatus: 'saving' })
      try {
        const prepared = currentSave().prepare()
        result = await initialContext.workspace.save(prepared.document, prepared)
      } catch (error) { result = { status: 'error', message: message(error) } }
    }
    if (generation === state.documentGeneration) applyWorkspaceResult(result, captured)
    return result
  }
  async function persist(whileReplacing = false) {
    if (!state.active || (state.replacing && !whileReplacing) || state.storageConflict) return false
    const captured = localRevision, generation = state.documentGeneration
    update({ autosaveSaving: true })
    const saved = await autosave.save(currentSave(), session())
    if (generation === state.documentGeneration) {
      if (saved) localSavedRevision = Math.max(localSavedRevision, captured)
      if (captured === localRevision) update({ ...(saved ? { localSavedAt: now() } : {}), autosaveSaving: false })
    }
    return saved
  }
  async function recover() {
    const generation = state.documentGeneration
    try {
      const recovered = await repository.loadActive()
      const savedSession = await repository.loadActiveSession?.() ?? { openModules: [] }
      const presence = await repository.readPresence?.() ?? null
      if (generation !== state.documentGeneration || state.active || state.fileBusy || state.documentReading) return
      const age = presence ? Date.parse(now()) - Date.parse(presence.seenAt) : Infinity
      const recent = recovered && presence && !presence.closed && presence.documentId === recovered.document.id && age >= 0 && age < 30 * 60 * 1000
      recoveryCandidate = recent ? { document: recovered, session: savedSession } : null
      update({ ready: true, recoveryPending: Boolean(recent), recoveryTitle: recent ? recovered.document.title : null,
        recoverySeenAt: recent ? presence.seenAt : null, autosaveUnavailable: false, localStorageMessage: null, fileMessage: null,
        recoveredPrevious: repository.recoverySource === 'previous' })
      if (recoveryCandidate && age < 60 * 1000) await replace({ ...recoveryCandidate, fileDirty: true })
    } catch (error) {
      if (generation === state.documentGeneration && !state.active && !state.fileBusy && !state.documentReading) update({ ready: true, autosaveUnavailable: true,
        fileMessage: error instanceof InputBudgetError ? error.message : 'No se pudo leer la recuperación de este dispositivo. Reintenta o abre un archivo desde su carpeta.' })
    }
  }
  function applyDocumentCommand(command: DocumentCommand) {
    if (!state.active || state.replacing || state.fileBusy) return false
    const result = command(state.document)
    // The boolean returned by the store means accepted; changed belongs to the command.
    if (!result.changed) return true
    return commitDocument(result.document)
  }
  function commitDocument(document: AngieDocument) {
    const candidate = { ...document, document: { ...document.document,
      id: state.document.document.id, createdAt: state.document.document.createdAt,
      updatedAt: new Date(Math.max(Date.parse(now()), Date.parse(state.document.document.updatedAt))).toISOString() } }
    const budget = checkDocumentBudget(candidate)
    if (budget) { update({ fileMessage: budget.message }); return false }
    let text: string
    try { text = serializeDocument(candidate) }
    catch (error) {
      if (!(error instanceof InputBudgetError)) throw error
      update({ fileMessage: error.message }); return false
    }
    revision++; localRevision++
    documentSave = new DocumentSave(candidate, text)
    update({ document: candidate, fileDirty: true, ...(state.workspaceStatus === 'saved' ? { workspaceStatus: 'pending' as const } : {}) })
    void persist()
    return true
  }
  function activate(candidate: Replacement, protectedLocally: boolean, result?: WorkspaceSaveResult, gpxFingerprints: string[] = [], prepared?: PreparedDocumentSave) {
    revision++; localRevision++
    documentSave = prepared ? DocumentSave.fromPrepared(prepared) : new DocumentSave(candidate.document)
    localSavedRevision = protectedLocally ? localRevision : -1
    recoveryCandidate = null
    update({ active: true, document: candidate.document, openModules: candidate.session.openModules,
      documentGeneration: state.documentGeneration + 1, fileBusy: false, replacing: false, replacementBlocked: false,
      recoveryPending: false, recoveryTitle: null, recoverySeenAt: null, fileMessage: null, fileDirty: true,
      fileSavedAt: null, downloadStartedAt: null, autosaveSaving: false, autosaveUnavailable: !protectedLocally, localStorageMessage: null,
      storageConflict: false, localSavedAt: protectedLocally ? now() : null, localGpxFingerprints: gpxFingerprints,
      workspaceStatus: 'unconfigured', workspacePath: null, workspaceSavedAt: null, workspaceMessage: null, workspacePermissionRequired: false })
    autosave.resume()
    if (result) applyWorkspaceResult(result, revision)
    void rememberPresence()
  }
  async function protectCurrent() {
    if (!state.active) return true
    await autosave.flush()
    if (state.storageConflict) return false
    return localSavedRevision === localRevision || state.workspaceStatus === 'saved'
  }
  async function replace(candidate: Replacement, result?: WorkspaceSaveResult, carriesCurrent = false, adopt = false, visible?: VisibleDocumentPreparation) {
    const generation = state.documentGeneration
    const current = () => generation === state.documentGeneration
    update({ fileBusy: true, documentReading: false, replacing: true, fileMessage: null })
    try {
      if (visible?.image) await registerImage(visible.image.blob, visible.image.id)
      if (!current()) return false
      candidate = { ...candidate, document: await workingDocument(candidate.document) }
      if (!current()) return false
      const prepared = visible?.prepared
      if (prepared && prepared.document !== candidate.document) throw new Error('La instantánea no pertenece al documento que se abre.')
      if (!prepared) serializeDocument(candidate.document)
      if (!carriesCurrent && !await protectCurrent()) {
        if (current()) update({ fileBusy: false, replacing: false, replacementBlocked: true })
        return false
      }
      if (!current()) return false
      let protectedLocally = true
      let gpxFingerprints: string[] = []
      try {
        if (adopt) await repository.prepareOpen?.(candidate.document.document.id, candidate.revision)
        if (!current()) return false
        const resources = repository.replaceActive ? await repository.replaceActive(candidate.document, candidate.session, prepared)
          : await repository.saveActive(candidate.document, candidate.session, prepared)
        gpxFingerprints = resources?.gpxFingerprints ?? []
      } catch (error) {
        if (visible || error instanceof DocumentConflictError) throw error
        protectedLocally = false
      }
      if (!current()) return false
      activate(candidate, protectedLocally, result, gpxFingerprints, prepared)
      return true
    } catch (error) { if (current()) update({ fileBusy: false, replacing: false, fileMessage: message(error) }); return false }
  }
  async function uniqueName(requested: string, id?: string, localOnly = false) {
    if (!requested.trim()) requested = ''
    const error = workspaceNameError(requested)
    if (error) throw new Error(error)
    const records = repository.hasDocumentTitle ? [] : await repository.listRecoverable?.() ?? []
    const occupied = new Set(records.filter(record => record.documentId !== id).map(record => record.title.toLowerCase()))
    const exists = (title: string) => repository.hasDocumentTitle ? repository.hasDocumentTitle(title, id) : Promise.resolve(occupied.has(title.toLowerCase()))
    if (requested && await exists(requested)) throw new Error('Ya existe un guardado con ese nombre. Elige otro.')
    let name = requested
    if (!name) { let number = 1; do { name = `UIBoard_noname${number++}` } while (await exists(name)) }
    if (localOnly || workLocally || !initialContext.workspace?.availableName) return name
    if (requested) return initialContext.workspace.availableName(name, id)
    while (true) {
      try { return await initialContext.workspace.availableName(name) }
      catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith('Ya existe una carpeta')) throw error
        const number = Number(name.replace('UIBoard_noname', '')) + 1
        name = `UIBoard_noname${number}`
        while (await exists(name)) name = `UIBoard_noname${Number(name.replace('UIBoard_noname', '')) + 1}`
      }
    }
  }
  async function createBoard(title: string, source?: LocalDocument, localRecovery = false) {
    if (state.fileBusy) return false
    update({ fileBusy: true, replacing: true, fileMessage: null })
    try {
      const carriesCurrent = source?.document === state.document
      if (carriesCurrent) await autosave.flush()
      if (!carriesCurrent && !await protectCurrent()) { update({ replacementBlocked: true }); return false }
      let name: string
      try { name = await uniqueName(title) }
      catch (error) {
        if (!localRecovery || (error instanceof Error && error.message.startsWith('Ya existe'))) throw error
        name = await uniqueName(title, undefined, true)
      }
      const candidate = source ? structuredClone(source.document) : createEmptyDocument(name)
      if (source) candidate.document = { id: crypto.randomUUID(), title: name, createdAt: now(), updatedAt: now() }
      serializeDocument(candidate)
      const result = workLocally ? { status: 'unconfigured' as const } : await initialContext.workspace?.create?.(candidate, source?.document, source?.resourceFolder, source?.resourceAccessId, source?.resourceVersion, localRecovery) ?? { status: 'unconfigured' as const }
      if (result.status === 'error' && !localRecovery) { update({ fileMessage: result.message, workspacePermissionRequired: result.permissionRequired ?? false }); return false }
      if (result.status === 'saved' && result.resourcesPending && !localRecovery) {
        update({ fileMessage: 'La copia tiene recursos pendientes. El UIBoard anterior sigue abierto.' + (result.message ? ' ' + result.message : '') })
        return false
      }
      return await replace({ document: candidate, session: source?.session ?? { openModules: [] }, fileDirty: false }, result, Boolean(carriesCurrent))
    } catch (error) { update({ fileMessage: message(error) }); return false }
    finally { update({ fileBusy: false, replacing: false }) }
  }
  async function recoverInBranch(candidate: LocalDocument, localRecovery: boolean) {
    const original = filterWorkspaceName(candidate.document.document.title || 'UIBoard').replace(/(?:_recuperado(?:_\d+)?)+$/i, '')
    const base = [...original].slice(0, 75).join('').trim().replace(/[ .]+$/, '') || 'UIBoard'
    const stem = base + '_recuperado'
    let title = stem, number = 1
    while (true) {
      try { title = await uniqueName(title); break }
      catch (error) {
        if (error instanceof Error && error.message.startsWith('Ya existe')) { title = stem + '_' + number++; continue }
        if (!localRecovery) throw error
        title = await uniqueName(title, undefined, true); break
      }
    }
    return createBoard(title, candidate, localRecovery)
  }
  function cancelDocumentRead() {
    if (!pendingRead) return
    pendingRead.controller.abort()
    pendingRead = null
    update({ documentReading: false })
  }
  async function load(file: DocumentFile, handle?: SaveFileHandle) {
    if (state.fileBusy) return false
    cancelDocumentRead()
    const operation = { controller: new AbortController(), generation: state.documentGeneration, revision }
    pendingRead = operation
    update({ documentReading: true, fileMessage: null })
    const result = await loadVisibleDocument(file, { documentGeneration: operation.generation, signal: operation.controller.signal })
    if (pendingRead !== operation || operation.generation !== state.documentGeneration || operation.controller.signal.aborted) return false
    pendingRead = null
    if (result.status === 'cancelled') { update({ documentReading: false }); return false }
    if (result.status === 'error') { update({ documentReading: false, fileMessage: result.message }); return false }
    if (state.fileBusy) { update({ documentReading: false, fileMessage: 'Hay otra operación en curso. Vuelve a abrir el archivo.' }); return false }
    if (operation.revision !== revision) { update({ documentReading: false, fileMessage: 'Hubo cambios durante la lectura. Vuelve a abrir el archivo.' }); return false }
    return replace({ document: result.document, session: { openModules: [] }, handle, fileDirty: result.migrated }, undefined, false, true, result.visible)
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    initialize() { initialization ??= recover(); return initialization },
    isWorkingLocally: () => workLocally,
    continueLocally() {
      workLocally = true
      if (state.active) applyWorkspaceResult({ status: 'unconfigured' }, revision)
    },
    applyDocumentCommand,
    async setTitle(title: string) {
      if (!state.active || state.fileBusy) return false
      if (title.trim() && title === state.document.document.title && (workLocally || !initialContext.workspace || state.workspacePath?.endsWith('/' + title + '/dashboard.json'))) return true
      update({ fileBusy: true, replacing: true, fileMessage: null })
      try {
        const name = await uniqueName(title, state.document.document.id)
        await autosave.flush()
        if (state.storageConflict) throw new DocumentConflictError()
        // Flush the current title before the directory transfer.
        if (!workLocally) {
          const saved = await saveWorkspaceNow()
          if (saved.status === 'error' || (saved.status === 'saved' && saved.resourcesPending)) {
            update({ fileMessage: saved.message ?? 'Hay recursos pendientes de guardar.' })
            return false
          }
        }
        const renamed = renameDocument(state.document, name).document
        const candidate = { ...renamed, document: { ...renamed.document,
          updatedAt: new Date(Math.max(Date.parse(now()), Date.parse(renamed.document.updatedAt))).toISOString() } }
        const text = serializeDocument(candidate)
        const result = workLocally ? { status: 'unconfigured' as const } : await initialContext.workspace?.rename?.(state.document, name, candidate.document.updatedAt) ?? { status: 'unconfigured' as const }
        if (result.status === 'error') {
          if (result.path) update({ workspacePath: result.path, workspaceStatus: 'error', workspaceMessage: result.message })
          throw new Error(result.message)
        }
        revision++; localRevision++
        documentSave = new DocumentSave(candidate, text)
        update({ document: candidate, fileDirty: true, fileMessage: result.status === 'saved' ? result.message ?? null : null })
        if (result.status === 'saved') {
          applyWorkspaceResult(result, revision)
        }
        await persist(true)
        return true
      } catch (error) { update({ fileMessage: message(error) }); return false }
      finally { update({ fileBusy: false, replacing: false }) }
    },
    setOpenModules(ids: DocumentModuleId[]) {
      if (!state.ready || !state.active || state.replacing) return
      const openModules = normalizeSession({ openModules: ids }).openModules
      if (openModules.length === state.openModules.length && openModules.every((id, index) => id === state.openModules[index])) return
      localRevision++; update({ openModules }); void persist()
    },
    newDocument(title = '') { return createBoard(title) },
    saveAs(title: string) { return state.active ? createBoard(title, { document: state.document, session: session() }) : Promise.resolve(false) },
    loadDocument(file: DocumentFile, handle?: SaveFileHandle) { return load(file, handle) },
    cancelDocumentRead,
    hasOpenPicker: () => Boolean(initialContext.platform.pickOpen),
    async pickDocument() {
      cancelDocumentRead()
      try { return await initialContext.platform.pickOpen?.() ?? null }
      catch (error) { if (!cancelled(error)) update({ fileMessage: message(error) }); return null }
    },
    async openDocument() {
      if (state.fileBusy || !initialContext.platform.pickOpen) return false
      cancelDocumentRead()
      try {
        const selected = await initialContext.platform.pickOpen()
        return await load(selected.file, selected.handle)
      } catch (error) { if (!cancelled(error)) update({ fileMessage: message(error) }); return false }
    },
    async saveDocument() {
      if (!state.active || state.fileBusy) return false
      const pending = state.fileDirty || state.workspaceStatus !== 'saved'
      update({ fileBusy: true, fileMessage: null })
      try {
        const [, result] = await Promise.all([persist(), saveWorkspaceNow()])
        if (result.status === 'unconfigured') update({ fileMessage: 'Selecciona una carpeta de trabajo para guardar.', workspacePermissionRequired: true })
        if (result.status === 'saved' && !result.resourcesPending) update({ fileMessage: pending ? 'Guardado' : 'Sin cambios pendientes' })
        if (result.status === 'error' && state.workspaceMessage !== result.message) update({ fileMessage: result.message })
        return result.status === 'saved' && !result.resourcesPending
      } catch (error) {
        update({ fileMessage: message(error) })
        return false
      } finally { update({ fileBusy: false }) }
    },
    async closeDocument(allowPending = false) {
      if (!state.active || state.fileBusy) return false
      update({ fileBusy: true, replacing: true })
      try {
        if (!await protectCurrent()) { update({ replacementBlocked: true }); return false }
        if (!allowPending && state.workspaceStatus !== 'saved') return false
        await presenceWrite
        await repository.clearActive(state.document.document.id)
        recoveryCandidate = null
        update({ active: false, document: createEmptyDocument(), documentGeneration: state.documentGeneration + 1,
          openModules: [], fileDirty: false, fileSavedAt: null, downloadStartedAt: null, localSavedAt: null, localGpxFingerprints: [], autosaveSaving: false,
          autosaveUnavailable: false, localStorageMessage: null, storageConflict: false, recoveredPrevious: false, recoveryPending: false, recoveryTitle: null, recoverySeenAt: null,
          workspaceStatus: 'unconfigured', workspacePath: null,
          workspaceSavedAt: null, workspaceMessage: null, workspacePermissionRequired: false, fileMessage: null })
        return true
      } catch (error) { update({ fileMessage: 'No se pudo cerrar el UIBoard. ' + message(error) }); return false
      } finally { update({ fileBusy: false, replacing: false }) }
    },
    async downloadJson() {
      if (!state.active || state.fileBusy) return
      update({ fileBusy: true })
      try {
        initialContext.platform.download(serializePortableDocument(await portableDocument(state.document)), suggestFilename(state.document.document.title, initialContext.now?.()))
        update({ downloadStartedAt: now(), fileMessage: 'Descarga JSON iniciada' })
      } catch (error) { update({ fileMessage: 'No se pudo descargar el JSON: ' + message(error) }) }
      finally { update({ fileBusy: false }) }
    },
    async generateReport(selection?: ReportSelection, mapReport?: MapReportContent, planReport?: MapReportContent, boardRequest?: BoardReportRequest, coordinateInput?: string, timerRecords?: readonly TimerRecord[] | null, pageOptions: ReportPageOptions = DEFAULT_REPORT_PAGE): Promise<GeneratedReport | null> {
      if (!state.active || state.replacing) return null
      const generation = state.documentGeneration
      const snapshot = structuredClone(state.document)
      const fields = selection ? structuredClone(selection) : undefined
      const generatedAt = initialContext.now?.() ?? new Date()
      const page = { ...pageOptions }
      const timerSnapshot = fields?.timers?.length && timerRecords ? structuredClone(timerRecords) : undefined
      const boardOptions = boardRequest ? { page, frame: boardRequest.frame ? { ...boardRequest.frame } : undefined, resourceIds: [...boardRequest.resourceIds], layers: { ...boardRequest.layers },
        blockedImage: boardRequest.blockedImage ? structuredClone(boardRequest.blockedImage) : undefined, iconPixels: boardRequest.iconPixels ? new Map(boardRequest.iconPixels) : undefined, fontFamily: boardRequest.fontFamily, frameMissing: boardRequest.frameMissing }
        : fields?.board?.includes('image') ? { page, blockedImage: [createReportIssue('board', 'La representación no está disponible.')] } : undefined
      const { createDocumentReport, paginateReport, prepareReportTypography } = await import('./reportEngine')
      if (!state.active || state.replacing || state.documentGeneration !== generation) return null
      const fontStyles = await prepareReportTypography()
      if (!state.active || state.replacing || state.documentGeneration !== generation) return null
      let boardReport: BoardReportContent | undefined
      if (fields?.board?.length) {
        try { boardReport = await import('./boardReport').then(module => module.createBoardReport(snapshot, fields.board!, boardOptions)) }
        catch (error) {
          boardReport = { documentId: snapshot.document.id, notes: fields.board.includes('notes') ? snapshot.board.quickNotes.map(({ title, text }) => ({ title, text })) : [],
            issues: fields.board.includes('image') ? [createReportIssue('board', error)] : [] }
        }
      }
      if (!state.active || state.replacing || state.documentGeneration !== generation) return null
      let report = await paginateReport(createDocumentReport(snapshot, generatedAt, fontStyles, fields, mapReport, planReport, boardReport, coordinateInput, timerSnapshot, page), page)
      if (!state.active || state.replacing || state.documentGeneration !== generation) return null
      let resolving = false
      function result(): GeneratedReport { return { document: snapshot, report, resolveResource } }
      async function resolveResource(issue: ReportIssue, action: ReportResourceAction): Promise<GeneratedReport | null> {
        if (resolving || !state.active || state.replacing || state.documentGeneration !== generation) return null
        if (!report.issues.some(item => !item.omitted && reportIssueKey(item) === reportIssueKey(issue))) return null
        resolving = true
        try {
          if (issue.section === 'board') {
            if (boardReport?.recovery) boardReport = await boardReport.recovery.apply(issue, action)
            else if (action === 'omit') boardReport = { ...boardReport, documentId: snapshot.document.id, notes: boardReport?.notes ?? snapshot.board.quickNotes.map(({ title, text }) => ({ title, text })),
              omittedImage: true, omittedSection: issue.resourceId === 'section', issues: [...(boardReport?.issues ?? []).filter(item => reportIssueKey(item) !== reportIssueKey(issue)), { ...issue, omitted: true }] }
            else throw new Error('Preparación no disponible. Actualiza el informe.')
          } else {
            const previous = issue.section === 'map' ? mapReport : planReport
            let next: MapReportContent
            if (previous?.recovery) next = await previous.recovery.apply(issue, action)
            else if (action === 'omit') next = { ...previous, documentId: snapshot.document.id, markers: previous?.markers ?? [], gpx: previous?.gpx ?? [], resources: previous?.resources ?? [],
              omittedImage: true, omittedSection: issue.resourceId === 'section', issues: [...(previous?.issues ?? []).filter(item => reportIssueKey(item) !== reportIssueKey(issue)), { ...issue, omitted: true }] }
            else throw new Error('Preparación no disponible. Actualiza el informe.')
            if (issue.section === 'map') mapReport = next; else planReport = next
          }
          if (!state.active || state.replacing || state.documentGeneration !== generation) return null
          report = await paginateReport(createDocumentReport(snapshot, generatedAt, fontStyles, fields, mapReport, planReport, boardReport, coordinateInput, timerSnapshot, page), page)
          if (!state.active || state.replacing || state.documentGeneration !== generation) return null
          return result()
        } finally { resolving = false }
      }
      return result()
    },
    async saveGeneratedReport(document: AngieDocument, report: { filename: string; html: string }) {
      if (!state.active || state.document.document.id !== document.document.id) return { status: 'error' as const, message: 'El informe pertenece a otro UIBoard.' }
      return await initialContext.workspace?.saveReport?.(state.document, report) ?? { status: 'unconfigured' as const }
    },
    downloadReport(report: { html: string; filename: string }) { initialContext.platform.download(report.html, report.filename, 'text/html') },
    async retryAutosave() {
      if (!state.active) { await recover(); return }
      if (state.storageConflict) { update({ fileMessage: 'Hay cambios en otra pestaña. Utiliza Guardar como para conservar los tuyos.' }); return }
      autosave.resume(); await persist()
    },
    async confirmRecovery(accept: boolean) {
      if (!recoveryCandidate || !state.recoveryPending || state.fileBusy) return false
      const candidate = recoveryCandidate
      if (accept) return replace({ ...candidate, fileDirty: true })
      update({ fileBusy: true, replacing: true, fileMessage: null })
      try {
        await presenceWrite
        await repository.clearActive(candidate.document.document.id)
        recoveryCandidate = null
        update({ recoveryPending: false, recoveryTitle: null, recoverySeenAt: null })
        return true
      } catch (error) { update({ fileMessage: 'No se pudo cerrar la sesión anterior. ' + message(error) }); return false }
      finally { update({ fileBusy: false, replacing: false }) }
    },
    cancelReplacement() { update({ replacementBlocked: false, fileMessage: null }) },
    async refreshRecoverable() {
      await autosave.flush()
      initialContext.workspace?.invalidateRecoveryCatalog?.()
      return null
    },
    async listRecoveryPage(query: RecoveryQuery = {}, source: 'device' | 'folder' | 'all' = 'device'): Promise<RecoveryPage> {
      if (source === 'folder') return initialContext.workspace?.listRecoveryPage?.(query) ?? { entries: [] }
      if (source === 'all') {
        const limit = Math.max(1, Math.min(100, Math.floor(query.limit ?? 10) || 10))
        const [local, folder] = await Promise.allSettled([
          repository.listRecoveryPage?.({ ...query, limit }) ?? Promise.resolve(repository.listRecoverable?.() ?? []).then(entries => ({ entries: entries.slice(0, limit) as RecoveryPage['entries'] } as RecoveryPage)),
          initialContext.workspace?.listRecoveryPage?.({ ...query, limit }) ?? Promise.resolve({ entries: [] } as RecoveryPage),
        ])
        const entries = [...(local.status === 'fulfilled' ? local.value.entries : []), ...(folder.status === 'fulfilled' ? folder.value.entries : [])]
          .sort((a, b) => a.savedAt !== b.savedAt ? a.savedAt < b.savedAt ? 1 : -1 : a.key < b.key ? 1 : a.key > b.key ? -1 : 0)
        const last = entries[Math.min(entries.length, limit) - 1]
        const more = entries.length > limit || local.status === 'fulfilled' && !!local.value.nextCursor || folder.status === 'fulfilled' && !!folder.value.nextCursor
        const warning = [local, folder].filter(result => result.status === 'rejected').map(result => message((result as PromiseRejectedResult).reason)).join(' ')
        return { entries: entries.slice(0, limit), ...(more && last ? { nextCursor: [last.savedAt, last.key] as [string, string] } : {}), ...(warning ? { warning } : {}) }
      }
      if (repository.listRecoveryPage) return repository.listRecoveryPage(query)
      return { entries: (await repository.listRecoverable?.() ?? []).slice(0, query.limit ?? 10) as RecoveryPage['entries'] }
    },
    measureStorage: () => repository.measureStorage?.(),
    async removeRetained(request: RetainedRemoval) {
      if (state.fileBusy) throw new Error('Espera a que termine la operación actual.')
      if (!repository.removeRetained) throw new Error('La gestión local no está disponible.')
      if (state.active && request.documentId === state.document.document.id) throw new Error('Cierra el UIBoard antes de eliminarlo.')
      update({ fileBusy: true })
      try { await autosave.flush(); await repository.removeRetained(request) }
      finally { update({ fileBusy: false }) }
    },
    async restoreDocument(key: string, expected?: RecoverableDocument) {
      if (state.fileBusy) return false
      cancelDocumentRead()
      try {
        const candidate = key.startsWith('workspace:') ? await initialContext.workspace?.loadRecoverable?.(key) : await repository.loadRecoverable?.(key)
        if (!candidate) { update({ fileMessage: 'La recuperación ya no está disponible.' }); return false }
        if (expected && ((expected.documentId && candidate.document.document.id !== expected.documentId) || candidate.savedAt !== expected.savedAt ||
          (expected.revision !== undefined && candidate.revision !== undefined && expected.revision !== candidate.revision))) throw new Error('La recuperación seleccionada cambió. Vuelve a abrir la lista y elige su versión.')
        return await recoverInBranch(candidate, !key.startsWith('workspace:'))
      } catch (error) { update({ fileMessage: message(error) }); return false }
    },
    async openRecentDocument() {
      if (!state.ready || state.fileBusy) return false
      cancelDocumentRead()
      update({ fileBusy: true, fileMessage: null })
      try {
        await autosave.flush()
        const presence = await repository.readPresence?.()
        let latest: RecoverableDocument | undefined
        if (repository.listRecoveryPage) {
          if (presence?.documentId) latest = (await repository.listRecoveryPage({ documentId: presence.documentId, kind: 'board', limit: 1 })).entries[0]
            ?? (await repository.listRecoveryPage({ documentId: presence.documentId, limit: 1 })).entries[0]
          latest ??= (await repository.listRecoveryPage({ kind: 'board', limit: 1 })).entries[0]
            ?? (await repository.listRecoveryPage({ limit: 1 })).entries[0]
        } else {
          const records = await repository.listRecoverable?.() ?? []
          latest = records.find(copy => copy.documentId === presence?.documentId && copy.key.startsWith('board:'))
            ?? records.find(copy => copy.documentId === presence?.documentId)
            ?? records.find(copy => copy.key.startsWith('board:')) ?? records[0]
        }
        const candidate = latest ? await repository.loadRecoverable?.(latest.key) : null
        if (!candidate) { update({ fileMessage: 'No hay un UIBoard reciente disponible en este dispositivo.' }); return false }
        return await replace({ ...candidate, fileDirty: true }, undefined, false, true)
      } catch (error) { update({ fileMessage: message(error) }); return false }
      finally { update({ fileBusy: false }) }
    },
    async recoverCurrent() {
      if (!state.active || state.fileBusy) return false
      try { return await recoverInBranch({ document: state.document, session: session() }, true) }
      catch (error) { update({ fileMessage: message(error) }); return false }
    },
    flushAutosave: () => autosave.flush(),
    protectGpxResources: () => persist(),
    async readGpx(reference: MapGpxReference) {
      const generation = state.documentGeneration
      const document = state.document
      const current = () => generation === state.documentGeneration && state.document.map?.gpx.some(item => item.id === reference.id && item.fingerprint === reference.fingerprint)
      const sources = [() => repository.readGpx?.(reference), () => initialContext.workspace?.readGpx?.(document, reference), () => readGpxAccess(reference.fingerprint)]
      for (const [index, source] of sources.entries()) {
        try {
          const file = await source()
          if (!current()) return null
          if (!file) continue
          await registerGpx(file, reference.fingerprint, index > 0)
          if (!current()) {
            if (!state.document.map?.gpx.some(item => item.fingerprint === reference.fingerprint)) releaseGpxOriginals([reference.fingerprint])
            return null
          }
          // External originals join the normal document transaction; a cache hit alone is never protection.
          if (index > 0) void persist()
          return file
        } catch { /* Keep the reference and try the next existing access path. */ }
      }
      return null
    },
    async flushLocalSave() { await autosave.flush() },
    connectLocalAutosave() {
      const flush = () => { void autosave.flush() }
      const presence = () => { void rememberPresence() }
      const visibility = () => { presence(); if (document.visibilityState === 'hidden') flush() }
      const pagehide = () => { presence(); flush() }
      const beforeUnload = (event: BeforeUnloadEvent) => {
        if (state.active && (state.autosaveSaving || state.autosaveUnavailable || state.storageConflict || state.workspaceStatus === 'saving')) {
          flush(); event.preventDefault(); event.returnValue = ''
        }
      }
      const heartbeat = setInterval(() => { if (document.visibilityState === 'visible') presence() }, 15000)
      document.addEventListener('visibilitychange', visibility)
      window.addEventListener('pagehide', pagehide)
      window.addEventListener('beforeunload', beforeUnload)
      return () => { clearInterval(heartbeat); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pagehide); window.removeEventListener('beforeunload', beforeUnload) }
    },
  }
}
function message(error: unknown) { return error instanceof Error ? error.message : 'No se pudo completar la operación. Reintenta o revisa los permisos de carpeta.' }
function cancelled(error: unknown) { return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError' }
export type DocumentStore = ReturnType<typeof createDocumentStore>
let browserStore: DocumentStore | undefined
export function getDocumentStore(): DocumentStore {
  browserStore ??= createDocumentStore(new DocumentRepository(), { platform: createBrowserFilePlatform(), workspace: createLazyBrowserWorkspaceFiles() })
  return browserStore
}
export function useDocumentStore(store: DocumentStore = getDocumentStore()) { return useSyncExternalStore(store.subscribe, store.getSnapshot) }
