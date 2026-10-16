import { useSyncExternalStore } from 'react'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { serializeDocument } from '../../domain/document/serializeDocument'
import type { AngieDocument, DocumentModuleId } from '../../domain/document/types'
import { createBrowserFilePlatform, loadVisibleDocument, saveVisibleDocument } from '../../platform/files/fileAccess'
import type { DocumentFile, FileAccessContext, SaveFileHandle, SaveOutcome } from '../../platform/files/fileAccess'
import { DocumentRepository, DocumentConflictError, normalizeSession } from '../../storage/documentRepository'
import type { ActiveDocumentRepository, DocumentSession, LocalDocument, RecoverableDocument } from '../../storage/documentRepository'
import { createAutosave } from '../../storage/autosave'
import { createWorkspaceAutosave } from '../../storage/workspaceAutosave'
import { createBrowserWorkspaceFiles } from '../../platform/files/workspaceFiles'
import type { WorkspaceSaveResult } from '../../platform/files/workspaceFiles'

export interface DocumentSnapshot {
  document: AngieDocument
  documentGeneration: number
  ready: boolean
  openModules: DocumentModuleId[]
  autosaveUnavailable: boolean
  autosaveSaving: boolean
  localSavedAt: string | null
  storageConflict: boolean
  recoveredPrevious: boolean
  recoveryPending: boolean
  replacementBlocked: boolean
  replacing: boolean
  recoverable: RecoverableDocument[]
  fileBusy: boolean
  fileDirty: boolean
  fileSavedAt: string | null
  downloadStartedAt: string | null
  fileMessage: string | null
  fileMessageRevision: number
  downloadFallback: (() => Promise<SaveOutcome>) | null
  workspaceStatus: 'unconfigured' | 'pending' | 'saving' | 'saved' | 'error'
  workspacePath: string | null
  workspaceSavedAt: string | null
  workspaceMessage: string | null
}
interface Replacement extends LocalDocument { handle?: SaveFileHandle; fileDirty: boolean }
export function createDocumentStore(repository: ActiveDocumentRepository, initialContext: FileAccessContext) {
  let state: DocumentSnapshot = {
    document: createEmptyDocument(), documentGeneration: 0, ready: false, openModules: [],
    autosaveUnavailable: false, autosaveSaving: false, localSavedAt: null, storageConflict: false, recoveredPrevious: false,
    recoveryPending: false, replacementBlocked: false, replacing: false, recoverable: [],
    fileBusy: false, fileDirty: false, fileSavedAt: null, downloadStartedAt: null,
    fileMessage: null, fileMessageRevision: 0, downloadFallback: null,
    workspaceStatus: 'unconfigured', workspacePath: null, workspaceSavedAt: null, workspaceMessage: null,
  }
  let revision = 0
  let localRevision = 0
  let fileOperation = 0
  let needsRecovery = true
  let recoveryCandidate: LocalDocument | null = null
  let pendingReplacement: Replacement | null = null
  let initialization: Promise<void> | undefined
  let recoveryOperation: Promise<void> | undefined
  let useOpenPicker = true
  let fileContext = { ...initialContext }
  const workspaceAutosave = initialContext.workspace ? createWorkspaceAutosave(initialContext.workspace) : undefined
  let lastQueuedWorkspace = ''
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
  function queueWorkspace(force = false): Promise<WorkspaceSaveResult> {
    if (!workspaceAutosave) return Promise.resolve({ status: 'unconfigured' })
    if (!state.ready || needsRecovery || state.recoveryPending || state.storageConflict || state.autosaveUnavailable) {
      const result = { status: 'error' as const, message: 'Resuelve la recuperación local antes de guardar en la carpeta.' }
      update({ workspaceStatus: 'error', workspaceMessage: result.message })
      return Promise.resolve(result)
    }
    const text = serializeDocument(state.document)
    if (!force && lastQueuedWorkspace === text) return Promise.resolve({ status: 'unconfigured' })
    lastQueuedWorkspace = text
    const captured = revision, generation = state.documentGeneration
    update({ workspaceStatus: 'saving', workspaceMessage: null })
    return workspaceAutosave.schedule(state.document).then(result => {
      if (generation !== state.documentGeneration || captured !== revision) return result
      if (result.status === 'saved') update({ workspaceStatus: 'saved', workspacePath: result.path,
        workspaceSavedAt: result.savedAt, workspaceMessage: null, fileDirty: false,
      })
      else if (result.status === 'error') update({ workspaceStatus: 'error', workspaceMessage: result.message, fileDirty: true })
      else update({ workspaceStatus: 'unconfigured', workspacePath: null, workspaceSavedAt: null, workspaceMessage: null })
      return result
    })
  }
  async function saveWorkspaceNow() {
    await autosave.flush()
    const result = queueWorkspace(true)
    await workspaceAutosave?.flush()
    return result
  }
  async function persist() {
    if (needsRecovery || state.recoveryPending || state.replacing) return false
    const captured = localRevision, generation = state.documentGeneration
    update({ autosaveSaving: true })
    const saved = await autosave.save(state.document, session())
    if (generation === state.documentGeneration) update({
      ...(saved ? { localSavedAt: now() } : {}),
      ...(captured === localRevision ? { autosaveSaving: false } : {}),
    })
    if (saved && generation === state.documentGeneration) void queueWorkspace()
    return saved
  }
  function resetFileContext() { fileContext = { platform: initialContext.platform, now: initialContext.now } }
  async function recover() {
    try {
      const recovered = await repository.loadActive()
      const recoveredSession = await repository.loadActiveSession?.() ?? { openModules: [] }
      needsRecovery = false
      if (recovered && localRevision > 0) {
        recoveryCandidate = { document: recovered, session: recoveredSession }
        update({ ready: true, recoveryPending: true, autosaveUnavailable: false })
      } else {
        if (recovered) update({ document: recovered, openModules: recoveredSession.openModules, documentGeneration: state.documentGeneration + 1, fileDirty: true })
        update({ ready: true, autosaveUnavailable: false, storageConflict: false, localSavedAt: repository.lastSavedAt ?? null, recoveredPrevious: repository.recoverySource === 'previous' })
        if (!recovered || repository.needsUpgrade) await persist()
        else void queueWorkspace()
      }
    } catch {
      needsRecovery = true
      update({ ready: true, autosaveSaving: false, autosaveUnavailable: true })
    }
  }
  function mutateDocument(mutate: (document: AngieDocument) => void) {
    if (state.replacing) throw new Error('Espera a que termine la sustitución del documento.')
    const candidate = structuredClone(state.document)
    mutate(candidate)
    candidate.document = { ...candidate.document, id: state.document.document.id, createdAt: state.document.document.createdAt, updatedAt: state.document.document.updatedAt }
    if (serializeDocument(candidate) === serializeDocument(state.document)) return
    const instant = now()
    candidate.document.updatedAt = instant < candidate.document.createdAt ? candidate.document.createdAt : instant
    serializeDocument(candidate)
    revision++; localRevision++
    update({ document: candidate, fileDirty: true,
      ...(workspaceAutosave ? { workspaceStatus: 'pending', workspaceMessage: null } : {}),
    })
    void persist()
  }
  function applyReplacement(candidate: Replacement, protectedLocally: boolean) {
    revision++; localRevision++; fileOperation++
    resetFileContext()
    if (candidate.handle) fileContext.link = { handle: candidate.handle, title: candidate.document.document.title }
    pendingReplacement = null
    lastQueuedWorkspace = ''
    update({ document: candidate.document, openModules: candidate.session.openModules, documentGeneration: state.documentGeneration + 1,
      fileBusy: false, replacing: false, replacementBlocked: false, fileMessage: null, downloadFallback: null,
      fileDirty: candidate.fileDirty, fileSavedAt: null, downloadStartedAt: null,
      autosaveSaving: false, ...(protectedLocally ? { localSavedAt: now(), autosaveUnavailable: false, storageConflict: false } : {}),
      workspaceStatus: 'unconfigured', workspacePath: null, workspaceSavedAt: null, workspaceMessage: null,
    })
    if (protectedLocally) void queueWorkspace()
  }
  async function replace(candidate: Replacement) {
    update({ fileBusy: true, replacing: true, fileMessage: null, downloadFallback: null })
    await autosave.flush()
    await workspaceAutosave?.flush()
    try {
      if (needsRecovery || state.recoveryPending || state.storageConflict || state.autosaveUnavailable) throw new Error('No se puede proteger el documento hasta resolver su recuperación local.')
      if (repository.replaceActive) await repository.replaceActive(candidate.document, candidate.session)
      else {
        await repository.saveActive(state.document, session())
        await repository.saveActive(candidate.document, candidate.session)
      }
      applyReplacement(candidate, true)
    } catch (error) {
      pendingReplacement = candidate
      update({ fileBusy: false, replacing: false, replacementBlocked: true, autosaveUnavailable: true,
        storageConflict: error instanceof DocumentConflictError || state.storageConflict,
        fileMessage: 'No se pudo proteger el documento anterior. Exporta el JSON o cancela antes de continuar.',
      })
    }
  }
  function applySaveOutcome(outcome: SaveOutcome, savedRevision: number) {
    if (outcome.status === 'fallback') update({ fileMessage: outcome.message,
      downloadFallback: () => saveVisibleDocument(state.document, { platform: { download: initialContext.platform.download }, now: initialContext.now }),
    })
    else if (outcome.status === 'error') update({ fileMessage: outcome.message, downloadFallback: null })
    else update({ fileMessage: null, downloadFallback: null,
      ...(outcome.status === 'saved' ? { fileSavedAt: now(), downloadStartedAt: null, fileDirty: revision !== savedRevision } : {}),
      ...(outcome.status === 'downloaded' ? { downloadStartedAt: now() } : {}),
    })
  }
  async function load(file: DocumentFile, handle?: SaveFileHandle) {
    const operation = ++fileOperation, initialRevision = revision
    update({ fileBusy: true, fileMessage: null, downloadFallback: null })
    const result = await loadVisibleDocument(file)
    if (operation !== fileOperation) return
    if (result.status === 'error') update({ fileBusy: false, fileMessage: result.message })
    else if (revision !== initialRevision) update({ fileBusy: false, fileMessage: 'El documento cambió durante la lectura. Vuelve a cargar el archivo para reemplazarlo.' })
    else await replace({ document: result.document, session: session(), handle, fileDirty: result.migrated })
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    initialize() { initialization ??= recover(); return initialization },
    mutateDocument,
    setTitle(title: string) { mutateDocument(document => { document.document.title = title }) },
    setOpenModules(ids: DocumentModuleId[]) {
      if (!state.ready || state.replacing) return
      const openModules = normalizeSession({ openModules: ids }).openModules
      if (JSON.stringify(openModules) === JSON.stringify(state.openModules)) return
      localRevision++
      update({ openModules })
      void persist()
    },
    async newDocument() {
      if (state.fileBusy) return
      if (!state.ready) await (initialization ??= recover())
      await replace({ document: createEmptyDocument(), session: session(), fileDirty: false })
    },
    async loadDocument(file: DocumentFile) { if (!state.fileBusy) await load(file) },
    hasOpenPicker: () => Boolean(initialContext.platform.pickOpen && useOpenPicker),
    async openDocument() {
      if (state.fileBusy || !initialContext.platform.pickOpen) return
      const initialRevision = revision
      update({ fileBusy: true, fileMessage: null })
      try {
        const selected = await initialContext.platform.pickOpen()
        if (initialRevision !== revision) { update({ fileBusy: false, fileMessage: 'El documento cambió durante la selección. Vuelve a cargar el archivo.' }); return }
        await load(selected.file, selected.handle)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) useOpenPicker = false
        update({ fileBusy: false, fileMessage: error instanceof DOMException && error.name === 'AbortError' ? null : 'No se pudo abrir el archivo. Puedes cargarlo desde el selector de archivos.' })
      }
    },
    async saveDocument(saveAs = false) {
      if (state.fileBusy) return
      const operation = ++fileOperation, savedRevision = revision
      update({ fileBusy: true, fileMessage: null, downloadFallback: null })
      if (!saveAs && workspaceAutosave && state.workspaceStatus !== 'unconfigured') {
        const result = await saveWorkspaceNow()
        if (operation !== fileOperation) return
        if (result.status !== 'unconfigured') {
          update({ fileBusy: false })
          return
        }
      }
      const outcome = await saveVisibleDocument(state.document, fileContext, saveAs)
      if (operation !== fileOperation) return
      update({ fileBusy: false })
      applySaveOutcome(outcome, savedRevision)
    },
    async downloadJson() {
      if (state.fileBusy) return
      const savedRevision = revision
      update({ fileBusy: true })
      const outcome = await saveVisibleDocument(state.document, { platform: { download: initialContext.platform.download }, now: initialContext.now })
      update({ fileBusy: false })
      applySaveOutcome(outcome, savedRevision)
    },
    async acceptDownloadFallback() {
      if (!state.downloadFallback || state.fileBusy) return
      const download = state.downloadFallback, savedRevision = revision
      update({ fileBusy: true })
      const outcome = await download()
      update({ fileBusy: false })
      applySaveOutcome(outcome, savedRevision)
    },
    retryAutosave() {
      if (recoveryOperation) return recoveryOperation
      recoveryOperation = (async () => {
        await autosave.flush()
        if (needsRecovery || state.storageConflict) await recover()
        else await persist()
      })().finally(() => { recoveryOperation = undefined })
      return recoveryOperation
    },
    async confirmRecovery(accept: boolean) {
      if (!state.recoveryPending || !recoveryCandidate || state.fileBusy) return
      if (accept) {
        const candidate = recoveryCandidate
        recoveryCandidate = null
        update({ recoveryPending: false, storageConflict: false })
        applyReplacement({ ...candidate, fileDirty: true }, true)
      } else {
        update({ recoveryPending: false, storageConflict: false })
        await replace({ document: state.document, session: session(), fileDirty: state.fileDirty })
        if (!state.replacementBlocked) recoveryCandidate = null
      }
    },
    cancelReplacement() { pendingReplacement = null; update({ replacementBlocked: false, fileMessage: null }) },
    discardReplacement() {
      if (!pendingReplacement || state.fileBusy) return
      const candidate = pendingReplacement
      applyReplacement(candidate, false)
      void persist()
    },
    async refreshRecoverable() {
      try { update({ recoverable: await repository.listRecoverable?.() ?? [] }) }
      catch { update({ fileMessage: 'No se pudieron consultar los documentos recuperables.' }) }
    },
    async restoreDocument(key: string) {
      if (state.fileBusy || !repository.loadRecoverable) return
      const initialRevision = revision
      update({ fileBusy: true })
      try {
        const candidate = await repository.loadRecoverable(key)
        if (!candidate) { update({ fileBusy: false, fileMessage: 'La copia ya no está disponible.' }); return }
        if (revision !== initialRevision) { update({ fileBusy: false, fileMessage: 'El documento cambió. Vuelve a seleccionar la copia.' }); return }
        await replace({ ...candidate, fileDirty: true })
      } catch { update({ fileBusy: false, fileMessage: 'No se pudo recuperar la copia. Se conserva el documento actual.' }) }
    },
    flushAutosave: () => autosave.flush(),
    saveWorkspaceNow,
    async flushWorkspaceSave() { await autosave.flush(); await workspaceAutosave?.flush() },
    connectWorkspaceAutosave() {
      if (!workspaceAutosave) return () => {}
      const flush = () => { void autosave.flush().then(() => workspaceAutosave.flush()) }
      const hidden = () => { if (document.visibilityState === 'hidden') flush() }
      const beforeUnload = (event: BeforeUnloadEvent) => {
        if (state.workspaceStatus === 'pending' || state.workspaceStatus === 'saving' || state.workspaceStatus === 'error') {
          flush(); event.preventDefault(); event.returnValue = ''
        }
      }
      document.addEventListener('visibilitychange', hidden)
      window.addEventListener('pagehide', flush)
      window.addEventListener('beforeunload', beforeUnload)
      return () => {
        document.removeEventListener('visibilitychange', hidden)
        window.removeEventListener('pagehide', flush)
        window.removeEventListener('beforeunload', beforeUnload)
      }
    },
  }
}
export type DocumentStore = ReturnType<typeof createDocumentStore>
let browserStore: DocumentStore | undefined
export function getDocumentStore(): DocumentStore {
  browserStore ??= createDocumentStore(new DocumentRepository(), { platform: createBrowserFilePlatform(), workspace: createBrowserWorkspaceFiles() })
  return browserStore
}
export function useDocumentStore(store: DocumentStore = getDocumentStore()) { return useSyncExternalStore(store.subscribe, store.getSnapshot) }
