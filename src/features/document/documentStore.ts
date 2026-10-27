import { useSyncExternalStore } from 'react'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { serializeDocument } from '../../domain/document/serializeDocument'
import type { AngieDocument, DocumentModuleId, MapGpxReference } from '../../domain/document/types'
import { createBrowserFilePlatform, loadVisibleDocument, suggestFilename } from '../../platform/files/fileAccess'
import type { DocumentFile, FileAccessContext, SaveFileHandle } from '../../platform/files/fileAccess'
import { DocumentRepository, DocumentConflictError, normalizeSession } from '../../storage/documentRepository'
import type { ActiveDocumentRepository, DocumentSession, LocalDocument, RecoverableDocument } from '../../storage/documentRepository'
import { createAutosave } from '../../storage/autosave'
import { createWorkspaceAutosave } from '../../storage/workspaceAutosave'
import { createBrowserWorkspaceFiles } from '../../platform/files/workspaceFiles'
import type { WorkspaceSaveResult } from '../../platform/files/workspaceFiles'
import { filterWorkspaceName, workspaceNameError } from '../../platform/files/workspaceNames'
import { createDocumentReport } from './documentReport'
import type { ReportSelection } from './documentReport'
import type { MapReportContent } from './mapReport'
import type { BoardReportContent, BoardReportRequest } from './boardReport'
import type { WeatherReportContent } from './weatherReport'
import type { TimerRecord } from '../clock/timerTypes'
import { createReportIssue, reportIssueKey } from './reportIssues'
import type { ReportIssue, ReportResourceAction } from './reportIssues'
import { DEFAULT_REPORT_PAGE, paginateReport } from './reportPagination'
import type { ReportPageOptions } from './reportPagination'
import { prepareReportTypography } from './reportTypography'

export interface DocumentSnapshot {
  document: AngieDocument
  documentGeneration: number
  active: boolean
  ready: boolean
  openModules: DocumentModuleId[]
  autosaveUnavailable: boolean
  autosaveSaving: boolean
  localSavedAt: string | null
  storageConflict: boolean
  recoveredPrevious: boolean
  recoveryPending: boolean
  recoveryTitle: string | null
  recoverySeenAt: string | null
  replacementBlocked: boolean
  replacing: boolean
  recoverable: RecoverableDocument[]
  fileBusy: boolean
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
    autosaveUnavailable: false, autosaveSaving: false, localSavedAt: null, storageConflict: false, recoveredPrevious: false,
    recoveryPending: false, recoveryTitle: null, recoverySeenAt: null, replacementBlocked: false, replacing: false, recoverable: [],
    fileBusy: false, fileDirty: false, fileSavedAt: null, downloadStartedAt: null, fileMessage: null, fileMessageRevision: 0,
    workspaceStatus: 'unconfigured', workspacePath: null,
    workspaceSavedAt: null, workspaceMessage: null, workspacePermissionRequired: false,
  }
  let revision = 0, localRevision = 0
  let initialization: Promise<void> | undefined
  let recoveryCandidate: LocalDocument | null = null
  let folderPaused = false, lastQueuedWorkspace = ''
  let workLocally = false
  let presenceWrite = Promise.resolve()
  const listeners = new Set<() => void>()
  const now = () => (initialContext.now?.() ?? new Date()).toISOString()
  const session = (): DocumentSession => ({ openModules: state.openModules })
  function update(patch: Partial<DocumentSnapshot>) {
    state = { ...state, ...patch, fileMessageRevision: 'fileMessage' in patch ? state.fileMessageRevision + 1 : state.fileMessageRevision }
    listeners.forEach(listener => listener())
  }
  const autosave = createAutosave(repository, (available, error) => {
    const conflict = error instanceof DocumentConflictError
    update({ autosaveUnavailable: !available, storageConflict: available ? false : conflict || state.storageConflict })
  })
  const workspaceAutosave = initialContext.workspace ? createWorkspaceAutosave({ save: document => {
    if (workLocally) return Promise.resolve<WorkspaceSaveResult>({ status: 'unconfigured' })
    if (folderPaused || state.storageConflict) return Promise.resolve<WorkspaceSaveResult>({ status: 'error',
      message: state.workspaceMessage ?? 'El guardado en carpeta está pausado. Resuelve el aviso y pulsa Reintentar.', permissionRequired: state.workspacePermissionRequired })
    return initialContext.workspace!.save(document)
  } }) : undefined

  function rememberPresence() {
    if (!state.active || state.replacing || !repository.rememberPresence) return presenceWrite
    const presence = { documentId: state.document.document.id, seenAt: now(), closed: false }
    presenceWrite = presenceWrite.then(() => repository.rememberPresence!(presence)).catch(() => {})
    return presenceWrite
  }
  function applyWorkspaceResult(result: WorkspaceSaveResult, text: string) {
    if (result.status === 'saved') {
      if (result.resourcesPending) folderPaused = true
      update({ workspaceStatus: result.resourcesPending ? 'error' : text === serializeDocument(state.document) ? 'saved' : 'pending', workspacePath: result.path,
        workspaceSavedAt: result.savedAt, workspaceMessage: result.message ?? null, workspacePermissionRequired: false,
        fileDirty: Boolean(result.resourcesPending) || text !== serializeDocument(state.document), fileSavedAt: result.savedAt })
    } else if (result.status === 'error') {
      folderPaused = true; lastQueuedWorkspace = ''
      update({ workspaceStatus: 'error', workspaceMessage: result.message, workspacePermissionRequired: result.permissionRequired ?? false })
    } else update({ workspaceStatus: workLocally ? 'pending' : 'unconfigured', workspacePath: null, workspaceSavedAt: null,
      workspaceMessage: workLocally ? 'Guardado en carpeta pausado durante esta apertura. Puedes elegir o autorizar la carpeta cuando quieras.' : null,
      workspacePermissionRequired: workLocally })
  }
  function queueWorkspace(force = false): Promise<WorkspaceSaveResult> {
    if (!state.active || !workspaceAutosave) return Promise.resolve({ status: 'unconfigured' })
    if (workLocally && !force) {
      applyWorkspaceResult({ status: 'unconfigured' }, serializeDocument(state.document))
      return Promise.resolve({ status: 'unconfigured' })
    }
    if (state.storageConflict) return Promise.resolve({ status: 'error', message: 'Hay cambios en otra pestaña. Utiliza Guardar como para conservar los tuyos.' })
    if (folderPaused && !force) return Promise.resolve({ status: 'error', message: state.workspaceMessage ?? 'Guardado en carpeta pendiente.' })
    if (force) folderPaused = false
    const text = serializeDocument(state.document)
    if (!force && text === lastQueuedWorkspace) return Promise.resolve({ status: 'unconfigured' })
    lastQueuedWorkspace = text
    const generation = state.documentGeneration
    update({ workspaceStatus: 'saving' })
    return workspaceAutosave.schedule(state.document).then(result => {
      if (generation === state.documentGeneration) applyWorkspaceResult(result, text)
      return result
    })
  }
  async function saveWorkspaceNow() {
    workLocally = false
    if (!state.active) return { status: 'unconfigured' as const }
    const result = queueWorkspace(true)
    await Promise.all([autosave.flush(), workspaceAutosave?.flush()])
    return result
  }
  async function persist(whileReplacing = false) {
    if (!state.active || (state.replacing && !whileReplacing) || state.storageConflict) return false
    const captured = localRevision, generation = state.documentGeneration
    update({ autosaveSaving: true })
    // Folder timing must not depend on the speed or availability of IndexedDB.
    void queueWorkspace()
    const saved = await autosave.save(state.document, session())
    if (generation === state.documentGeneration) {
      update({ ...(saved ? { localSavedAt: now() } : {}), ...(captured === localRevision ? { autosaveSaving: false } : {}) })
    }
    return saved
  }
  async function recover() {
    const generation = state.documentGeneration
    try {
      const recovered = await repository.loadActive()
      const savedSession = await repository.loadActiveSession?.() ?? { openModules: [] }
      const presence = await repository.readPresence?.() ?? null
      if (generation !== state.documentGeneration || state.active || state.fileBusy) return
      const age = presence ? Date.parse(now()) - Date.parse(presence.seenAt) : Infinity
      const recent = recovered && presence && !presence.closed && presence.documentId === recovered.document.id && age >= 0 && age < 30 * 60 * 1000
      recoveryCandidate = recent ? { document: recovered, session: savedSession } : null
      update({ ready: true, recoveryPending: Boolean(recent), recoveryTitle: recent ? recovered.document.title : null,
        recoverySeenAt: recent ? presence.seenAt : null, autosaveUnavailable: false, fileMessage: null,
        recoveredPrevious: repository.recoverySource === 'previous' })
    } catch {
      if (generation === state.documentGeneration && !state.active && !state.fileBusy) update({ ready: true, autosaveUnavailable: true,
        fileMessage: 'No se pudo leer la recuperación de este dispositivo. Reintenta o abre un archivo desde su carpeta.' })
    }
  }
  function mutateDocument(mutate: (document: AngieDocument) => void) {
    if (!state.active || state.replacing || state.fileBusy) return
    const candidate = structuredClone(state.document)
    mutate(candidate)
    candidate.document = { ...candidate.document, id: state.document.document.id, createdAt: state.document.document.createdAt, updatedAt: state.document.document.updatedAt }
    if (serializeDocument(candidate) === serializeDocument(state.document)) return
    candidate.document.updatedAt = new Date(Math.max(Date.parse(now()), Date.parse(candidate.document.updatedAt))).toISOString()
    serializeDocument(candidate)
    revision++; localRevision++
    update({ document: candidate, fileDirty: true, ...(folderPaused || workLocally ? {} : { workspaceStatus: 'pending' as const }) })
    void persist()
  }
  function activate(candidate: Replacement, protectedLocally: boolean, result?: WorkspaceSaveResult) {
    revision++; localRevision++
    recoveryCandidate = null
    folderPaused = false; lastQueuedWorkspace = ''
    update({ active: true, document: candidate.document, openModules: candidate.session.openModules,
      documentGeneration: state.documentGeneration + 1, fileBusy: false, replacing: false, replacementBlocked: false,
      recoveryPending: false, recoveryTitle: null, recoverySeenAt: null, fileMessage: null, fileDirty: true,
      fileSavedAt: null, downloadStartedAt: null, autosaveSaving: false, autosaveUnavailable: !protectedLocally,
      storageConflict: false, localSavedAt: protectedLocally ? now() : null,
      workspaceStatus: 'unconfigured', workspacePath: null, workspaceSavedAt: null, workspaceMessage: null, workspacePermissionRequired: false })
    autosave.resume()
    if (result) applyWorkspaceResult(result, serializeDocument(candidate.document))
    else void queueWorkspace()
    void rememberPresence()
  }
  async function protectCurrent() {
    if (!state.active) return true
    await Promise.all([autosave.flush(), workspaceAutosave?.flush()])
    if (state.storageConflict) return false
    return !state.autosaveUnavailable || state.workspaceStatus === 'saved'
  }
  async function replace(candidate: Replacement, result?: WorkspaceSaveResult, carriesCurrent = false, adopt = false) {
    update({ fileBusy: true, replacing: true, fileMessage: null })
    try {
      if (!carriesCurrent && !await protectCurrent()) {
        update({ fileBusy: false, replacing: false, replacementBlocked: true })
        return false
      }
      let protectedLocally = true
      try {
        if (adopt) await repository.prepareOpen?.(candidate.document.document.id, candidate.revision)
        if (repository.replaceActive) await repository.replaceActive(candidate.document, candidate.session)
        else await repository.saveActive(candidate.document, candidate.session)
      } catch (error) {
        if (error instanceof DocumentConflictError) throw error
        protectedLocally = false
      }
      activate(candidate, protectedLocally, result)
      return true
    } catch (error) { update({ fileBusy: false, replacing: false, fileMessage: message(error) }); return false }
  }
  async function uniqueName(requested: string, id?: string, localOnly = false) {
    if (!requested.trim()) requested = ''
    const error = workspaceNameError(requested)
    if (error) throw new Error(error)
    const records = await repository.listRecoverable?.().catch(() => []) ?? []
    const occupied = new Set(records.filter(record => record.documentId !== id).map(record => record.title.toLowerCase()))
    if (requested && occupied.has(requested.toLowerCase())) throw new Error('Ya existe un guardado con ese nombre. Elige otro.')
    let name = requested
    if (!name) { let number = 1; do { name = `UIBoard_noname${number++}` } while (occupied.has(name.toLowerCase())) }
    if (localOnly || workLocally || !initialContext.workspace?.availableName) return name
    if (requested) return initialContext.workspace.availableName(name, id)
    while (true) {
      try { return await initialContext.workspace.availableName(name) }
      catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith('Ya existe una carpeta')) throw error
        const number = Number(name.replace('UIBoard_noname', '')) + 1
        name = `UIBoard_noname${number}`
        while (occupied.has(name.toLowerCase())) name = `UIBoard_noname${Number(name.replace('UIBoard_noname', '')) + 1}`
      }
    }
  }
  async function createBoard(title: string, source?: LocalDocument, localRecovery = false) {
    if (state.fileBusy) return false
    update({ fileBusy: true, replacing: true, fileMessage: null })
    try {
      const carriesCurrent = source && source.document.document.id === state.document.document.id && serializeDocument(source.document) === serializeDocument(state.document)
      if (carriesCurrent) await Promise.all([autosave.flush(), workspaceAutosave?.flush()])
      if (!carriesCurrent && !await protectCurrent()) { update({ replacementBlocked: true }); return false }
      let name: string
      try { name = await uniqueName(title) }
      catch (error) {
        if (!localRecovery || (error instanceof Error && error.message.startsWith('Ya existe'))) throw error
        name = await uniqueName(title, undefined, true)
      }
      const candidate = source ? structuredClone(source.document) : createEmptyDocument(name)
      if (source) candidate.document = { id: crypto.randomUUID(), title: name, createdAt: now(), updatedAt: now() }
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
    const base = [...filterWorkspaceName(candidate.document.document.title || 'UIBoard')].slice(0, 75).join('').trim().replace(/[ .]+$/, '') || 'UIBoard'
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
  async function load(file: DocumentFile, handle?: SaveFileHandle) {
    if (state.fileBusy) return false
    update({ fileBusy: true })
    const captured = revision
    const result = await loadVisibleDocument(file)
    if (result.status === 'error') { update({ fileBusy: false, fileMessage: result.message }); return false }
    if (captured !== revision) { update({ fileBusy: false, fileMessage: 'Hubo cambios durante la lectura. Vuelve a abrir el archivo.' }); return false }
    return replace({ document: result.document, session: { openModules: [] }, handle, fileDirty: result.migrated }, undefined, false, true)
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    initialize() { initialization ??= recover(); return initialization },
    isWorkingLocally: () => workLocally,
    continueLocally() {
      workLocally = true; folderPaused = false; lastQueuedWorkspace = ''
      if (state.active) applyWorkspaceResult({ status: 'unconfigured' }, serializeDocument(state.document))
    },
    mutateDocument,
    async setTitle(title: string) {
      if (!state.active || state.fileBusy) return false
      if (title.trim() && title === state.document.document.title && (workLocally || !initialContext.workspace || state.workspacePath?.endsWith('/' + title + '/dashboard.json'))) return true
      update({ fileBusy: true, replacing: true, fileMessage: null })
      try {
        const name = await uniqueName(title, state.document.document.id)
        await Promise.all([autosave.flush(), workspaceAutosave?.flush()])
        if (state.storageConflict) throw new DocumentConflictError()
        // Flush the current title before the directory transfer.
        if (!workLocally) {
          const saved = await saveWorkspaceNow()
          if (saved.status === 'error' || (saved.status === 'saved' && saved.resourcesPending)) {
            update({ fileMessage: saved.message ?? 'Hay recursos pendientes de guardar.' })
            return false
          }
        }
        const candidate = structuredClone(state.document)
        candidate.document.title = name
        candidate.document.updatedAt = new Date(Math.max(Date.parse(now()), Date.parse(candidate.document.updatedAt))).toISOString()
        const result = workLocally ? { status: 'unconfigured' as const } : await initialContext.workspace?.rename?.(state.document, name, candidate.document.updatedAt) ?? { status: 'unconfigured' as const }
        if (result.status === 'error') {
          if (result.path) update({ workspacePath: result.path, workspaceStatus: 'error', workspaceMessage: result.message })
          throw new Error(result.message)
        }
        revision++; localRevision++
        lastQueuedWorkspace = ''; folderPaused = false
        update({ document: candidate, fileDirty: true, fileMessage: result.status === 'saved' ? result.message ?? null : null })
        if (result.status === 'saved') {
          lastQueuedWorkspace = serializeDocument(candidate)
          applyWorkspaceResult(result, lastQueuedWorkspace)
        }
        await persist(true)
        return true
      } catch (error) { update({ fileMessage: message(error) }); return false }
      finally { update({ fileBusy: false, replacing: false }) }
    },
    setOpenModules(ids: DocumentModuleId[]) {
      if (!state.ready || !state.active || state.replacing) return
      const openModules = normalizeSession({ openModules: ids }).openModules
      if (JSON.stringify(openModules) === JSON.stringify(state.openModules)) return
      localRevision++; update({ openModules }); void persist()
    },
    newDocument(title = '') { return createBoard(title) },
    saveAs(title: string) { return state.active ? createBoard(title, { document: state.document, session: session() }) : Promise.resolve(false) },
    loadDocument(file: DocumentFile, handle?: SaveFileHandle) { return load(file, handle) },
    hasOpenPicker: () => Boolean(initialContext.platform.pickOpen),
    async pickDocument() {
      try { return await initialContext.platform.pickOpen?.() ?? null }
      catch (error) { if (!cancelled(error)) update({ fileMessage: message(error) }); return null }
    },
    async openDocument() {
      if (state.fileBusy || !initialContext.platform.pickOpen) return false
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
          openModules: [], fileDirty: false, fileSavedAt: null, downloadStartedAt: null, localSavedAt: null, autosaveSaving: false,
          autosaveUnavailable: false, storageConflict: false, recoveredPrevious: false, recoveryPending: false, recoveryTitle: null, recoverySeenAt: null,
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
        initialContext.platform.download(serializeDocument(state.document), suggestFilename(state.document.document.title, initialContext.now?.()))
        update({ downloadStartedAt: now(), fileMessage: 'Descarga JSON iniciada' })
      } catch (error) { update({ fileMessage: 'No se pudo descargar el JSON: ' + message(error) }) }
      finally { update({ fileBusy: false }) }
    },
    async generateReport(selection?: ReportSelection, mapReport?: MapReportContent, planReport?: MapReportContent, boardRequest?: BoardReportRequest, coordinateInput?: string, weatherReport?: WeatherReportContent, timerRecords?: readonly TimerRecord[] | null, pageOptions: ReportPageOptions = DEFAULT_REPORT_PAGE): Promise<GeneratedReport | null> {
      if (!state.active || state.replacing) return null
      const generation = state.documentGeneration
      const snapshot = structuredClone(state.document)
      const fields = selection ? structuredClone(selection) : undefined
      const generatedAt = initialContext.now?.() ?? new Date()
      const page = { ...pageOptions }
      const weatherSnapshot = fields?.weather?.length && weatherReport ? structuredClone(weatherReport) : undefined
      const timerSnapshot = fields?.timers?.length && timerRecords ? structuredClone(timerRecords) : undefined
      const boardOptions = boardRequest ? { page, frame: boardRequest.frame ? { ...boardRequest.frame } : undefined, resourceIds: [...boardRequest.resourceIds], layers: { ...boardRequest.layers },
        blockedImage: boardRequest.blockedImage ? structuredClone(boardRequest.blockedImage) : undefined, iconPixels: boardRequest.iconPixels ? new Map(boardRequest.iconPixels) : undefined, fontFamily: boardRequest.fontFamily, frameMissing: boardRequest.frameMissing }
        : fields?.board?.includes('image') ? { page, blockedImage: [createReportIssue('board', 'La representación no está disponible.')] } : undefined
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
      let report = await paginateReport(createDocumentReport(snapshot, generatedAt, fontStyles, fields, mapReport, planReport, boardReport, coordinateInput, weatherSnapshot, timerSnapshot, page), page)
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
          report = await paginateReport(createDocumentReport(snapshot, generatedAt, fontStyles, fields, mapReport, planReport, boardReport, coordinateInput, weatherSnapshot, timerSnapshot, page), page)
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
      await Promise.all([autosave.flush(), workspaceAutosave?.flush()])
      const [local, folder] = await Promise.allSettled([
        repository.listRecoverable?.() ?? Promise.resolve([]),
        initialContext.workspace?.listRecoverable?.() ?? Promise.resolve([]),
      ])
      const messages: string[] = []
      if (local.status === 'rejected') messages.push('No se pudieron leer las recuperaciones del dispositivo.')
      if (folder.status === 'rejected') messages.push('No se pudieron leer las recuperaciones de la carpeta. ' + message(folder.reason))
      update({ recoverable: [...(local.status === 'fulfilled' ? local.value : []), ...(folder.status === 'fulfilled' ? folder.value : [])]
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt)) })
      return messages.length ? messages.join(' ') : null
    },
    async restoreDocument(key: string, expected?: RecoverableDocument) {
      try {
        const candidate = key.startsWith('workspace:') ? await initialContext.workspace?.loadRecoverable?.(key) : await repository.loadRecoverable?.(key)
        if (!candidate) { update({ fileMessage: 'La recuperación ya no está disponible.' }); return false }
        if (expected && ((expected.documentId && candidate.document.document.id !== expected.documentId) || candidate.savedAt !== expected.savedAt)) throw new Error('La recuperación seleccionada cambió. Vuelve a abrir la lista y elige su versión.')
        return await recoverInBranch(candidate, !key.startsWith('workspace:'))
      } catch (error) { update({ fileMessage: message(error) }); return false }
    },
    async recoverCurrent() {
      if (!state.active || state.fileBusy) return false
      try { return await recoverInBranch({ document: structuredClone(state.document), session: structuredClone(session()) }, true) }
      catch (error) { update({ fileMessage: message(error) }); return false }
    },
    flushAutosave: () => autosave.flush(),
    async readWorkspaceGpx(reference: MapGpxReference) {
      const generation = state.documentGeneration
      try {
        const file = await initialContext.workspace?.readGpx?.(state.document, reference) ?? null
        return generation === state.documentGeneration ? file : null
      } catch { return null }
    },
    saveWorkspaceNow,
    async flushWorkspaceSave() { await Promise.all([autosave.flush(), workspaceAutosave?.flush()]) },
    connectWorkspaceAutosave() {
      const flush = () => { void Promise.all([autosave.flush(), workspaceAutosave?.flush()]) }
      const presence = () => { void rememberPresence() }
      const visibility = () => { presence(); if (document.visibilityState === 'hidden') flush() }
      const pagehide = () => { presence(); flush() }
      const beforeUnload = (event: BeforeUnloadEvent) => {
        if (state.active && (state.autosaveSaving || state.autosaveUnavailable || state.fileDirty || state.workspaceStatus === 'pending' || state.workspaceStatus === 'saving' || state.workspaceStatus === 'error')) {
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
  browserStore ??= createDocumentStore(new DocumentRepository(), { platform: createBrowserFilePlatform(), workspace: createBrowserWorkspaceFiles() })
  return browserStore
}
export function useDocumentStore(store: DocumentStore = getDocumentStore()) { return useSyncExternalStore(store.subscribe, store.getSnapshot) }
