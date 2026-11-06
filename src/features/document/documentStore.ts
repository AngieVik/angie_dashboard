import { useSyncExternalStore } from 'react'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { documentNameError } from '../../domain/document/documentName'
import { latestDocumentTime } from '../../domain/document/documentTime'
import { captureUIBoard, openUIBoard, sameUIBoardContent } from '../../domain/document/uiBoardData'
import { serializeDocument } from '../../domain/document/serializeDocument'
import { checkDocumentBudget } from '../../domain/input/inputBudgets'
import type { DocumentCommand } from '../../domain/document/documentCommand'
import type { AngieDocument, DocumentModuleId, MapGpxReference, UIBoardData } from '../../domain/document/types'
import { createBrowserFilePlatform, isFileCancellation, loadVisibleDocument, suggestFilename, writeTextFile } from '../../platform/files/fileAccess'
import type { FilePlatform } from '../../platform/files/fileAccess'
import type { DocumentFile, SaveFileHandle } from '../../platform/files/fileHandleTypes'
import { RecoveryConflictError, UIBoardRecoveryRepository } from '../../storage/uiBoardRecovery'
import type { RecoverySnapshot, UIBoardRecovery } from '../../storage/uiBoardRecovery'
import { gpxResource, releaseGpxOriginals } from '../../storage/gpxResources'
import { resetNavigation } from '../../layout/navigationStorage'
import { resetMapViews } from '../map/mapNavigation'
import { releaseImage, releaseImages } from '../../storage/imageResources'
import { renameDocument } from './documentEdits'
import type { createDocumentReport } from './documentReport'
import type { ReportSelection } from './reportSections'
import { DEFAULT_REPORT_PAGE } from './reportPageOptions'
import type { ReportPageOptions } from './reportPageOptions'
import type { TimerRecord } from '../clock/timerTypes'
import { measureWork } from '../../platform/workMetrics'

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
  storageConflict: boolean
  replacing: boolean
  fileBusy: boolean
  documentReading: boolean
  fileDirty: boolean
  fileSavedAt: string | null
  downloadStartedAt: string | null
  fileMessage: string | null
  fileName: string | null
}
export interface GeneratedReport { report: ReturnType<typeof createDocumentReport> }
interface StoreContext { platform: FilePlatform; now?: () => Date }

const RECOVERY_DELAY_MS = 1000
const RECOVERY_MAX_WAIT_MS = 5000

export function createDocumentStore(repository: UIBoardRecovery, context: StoreContext) {
  let state: DocumentSnapshot = {
    document: createEmptyDocument(), documentGeneration: 0, active: false, ready: false, openModules: [],
    autosaveUnavailable: false, localStorageMessage: null, autosaveSaving: false, localSavedAt: null, storageConflict: false,
    replacing: false, fileBusy: false, documentReading: false, fileDirty: false, fileSavedAt: null,
    downloadStartedAt: null, fileMessage: null, fileName: null,
  }
  let data: UIBoardData | null = null
  let dataText = ''
  let revision = 0
  let fileHandle: SaveFileHandle | undefined
  let fileFingerprint: string | null = null
  let initialization: Promise<void> | undefined
  let pendingRead: AbortController | null = null
  let recoveryPending = false
  let recoverySave: Promise<boolean> | null = null
  let recoveryTimer: ReturnType<typeof setTimeout> | undefined
  let recoveryDeadline: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  // Pending quick-note text belongs to this session, never to the portable data.
  const quickNoteDrafts = new Map<string, string>()
  const now = () => (context.now?.() ?? new Date()).toISOString()

  function update(patch: Partial<DocumentSnapshot>) {
    if (patch.document) {
      if (patch.document.board.quickNotes !== state.document.board.quickNotes) {
        const notes = new Set(patch.document.board.quickNotes.map(note => note.id))
        for (const id of quickNoteDrafts.keys()) if (!notes.has(id)) quickNoteDrafts.delete(id)
      }
      const next = new Set(patch.document.map?.gpx.map(item => item.fingerprint) ?? [])
      releaseGpxOriginals((state.document.map?.gpx ?? []).filter(item => !next.has(item.fingerprint)).map(item => item.fingerprint))
      const previousImage = state.document.board.backgroundImage?.resourceId
      if (previousImage && previousImage !== patch.document.board.backgroundImage?.resourceId) releaseImage(previousImage)
    }
    state = { ...state, ...patch }
    listeners.forEach(listener => listener())
  }
  function cancelDocumentRead() {
    pendingRead?.abort(); pendingRead = null
    if (state.documentReading) update({ documentReading: false })
  }
  function clearRecoveryTimers() {
    clearTimeout(recoveryTimer); clearTimeout(recoveryDeadline)
    recoveryTimer = undefined; recoveryDeadline = undefined
  }
  function recoverySnapshot(): RecoverySnapshot {
    if (!data) throw new Error('No hay un UIBoard activo.')
    return { data, savedAt: now(), fileHandle, fileFingerprint, fileName: state.fileName, fileSavedAt: state.fileSavedAt, fileDirty: state.fileDirty }
  }
  function scheduleRecovery() {
    if (!state.active) return
    recoveryPending = true
    update({ autosaveSaving: true })
    clearTimeout(recoveryTimer)
    recoveryTimer = setTimeout(() => { void flushLocalSave() }, RECOVERY_DELAY_MS)
    recoveryDeadline ??= setTimeout(() => { void flushLocalSave() }, RECOVERY_MAX_WAIT_MS)
  }
  async function flushLocalSave(): Promise<boolean> {
    clearRecoveryTimers()
    if (recoverySave) {
      const saved = await recoverySave
      return recoveryPending && saved ? flushLocalSave() : saved
    }
    if (!state.active || !recoveryPending) return !state.autosaveUnavailable
    if (state.storageConflict) { update({ autosaveSaving: false }); return false }
    const snapshot = recoverySnapshot(), generation = state.documentGeneration
    recoveryPending = false
    const operation = repository.save(snapshot).then(() => {
      if (generation === state.documentGeneration) update({ localSavedAt: snapshot.savedAt, autosaveUnavailable: false, localStorageMessage: null })
      return true
    }).catch((error: unknown) => {
      if (generation === state.documentGeneration) {
        recoveryPending = true
        update({ autosaveUnavailable: true, storageConflict: error instanceof RecoveryConflictError,
          localStorageMessage: error instanceof RecoveryConflictError ? error.message : 'No se pudo actualizar la copia local. La copia anterior se conserva. Guarda el UIBoard en un archivo.' })
      }
      return false
    })
    recoverySave = operation
    const saved = await operation
    recoverySave = null
    if (generation === state.documentGeneration) update({ autosaveSaving: recoveryPending && saved })
    return saved
  }
  async function settleRecovery() {
    clearRecoveryTimers()
    if (recoverySave) await recoverySave
    recoveryPending = false
  }
  function activate(next: UIBoardData, access?: RecoverySnapshot) {
    // Fully prepare the candidate before releasing the active session.
    const document = openUIBoard(next)
    const canonical = captureUIBoard(document, next.openModules)
    const text = serializeDocument(canonical)
    cancelDocumentRead()
    resetNavigation()
    resetMapViews(); releaseImages()
    const previousGpx = state.document.map?.gpx.map(item => item.fingerprint) ?? []
    releaseGpxOriginals(previousGpx)
    quickNoteDrafts.clear()
    data = canonical; dataText = text; revision++
    fileHandle = access?.fileHandle; fileFingerprint = access?.fileFingerprint ?? null
    update({ document, openModules: [...canonical.openModules], documentGeneration: state.documentGeneration + 1,
      ready: true, active: true, replacing: false, fileBusy: false, documentReading: false,
      fileDirty: access?.fileDirty ?? true, fileSavedAt: access?.fileSavedAt ?? null, fileName: access?.fileName ?? null,
      fileMessage: null, downloadStartedAt: null, localSavedAt: access?.savedAt || null, autosaveSaving: false })
  }
  async function initialize() {
    update({ ready: false, fileBusy: true })
    try {
      const saved = await repository.load()
      if (saved) activate(saved.data, saved)
      else update({ ready: true, autosaveUnavailable: false, localStorageMessage: null })
    } catch (error) {
      update({ ready: true, autosaveUnavailable: true, localStorageMessage: message(error) })
    } finally { update({ fileBusy: false }) }
  }
  function commitDocument(document: AngieDocument) {
    const budget = measureWork('document.budget', () => checkDocumentBudget(document))
    if (budget) { update({ fileMessage: budget.message }); return false }
    const candidate = { ...document, document: { ...document.document, id: state.document.document.id,
      createdAt: state.document.document.createdAt, updatedAt: state.document.document.updatedAt } }
    if (candidate.document.title === state.document.document.title && candidate.elements === state.document.elements &&
      candidate.notebook === state.document.notebook && candidate.timeline === state.document.timeline && candidate.board.quickNotes === state.document.board.quickNotes) {
      update({ document: candidate }); return true
    }
    const captured = measureWork('document.capture', () => captureUIBoard(candidate, state.openModules, data ? { document: state.document, data } : undefined))
    if (data && sameUIBoardContent(captured, data)) { update({ document: candidate }); return true }
    candidate.document.updatedAt = latestDocumentTime(candidate.document.updatedAt, now())
    captured.document.updatedAt = candidate.document.updatedAt
    let text: string
    try { text = serializeDocument(captured) }
    catch (error) { update({ fileMessage: message(error) }); return false }
    data = captured; dataText = text; revision++
    cancelDocumentRead()
    update({ document: candidate, fileDirty: true, fileMessage: null })
    scheduleRecovery()
    return true
  }
  function applyDocumentCommand(command: DocumentCommand) {
    if (!state.ready || !state.active || state.replacing) return false
    return measureWork('document.edit', () => {
      const result = command(state.document)
      return !result.changed || commitDocument(result.document)
    })
  }
  async function saveDocument(saveAs = false): Promise<boolean> {
    if (!state.active || state.fileBusy || state.replacing || !data) return false
    cancelDocumentRead()
    const generation = state.documentGeneration, capturedRevision = revision, text = dataText
    update({ fileBusy: true, fileMessage: null })
    try {
      const filename = suggestFilename(data.document.title)
      // Picker or permission request starts directly inside the user's gesture.
      let target: SaveFileHandle
      if (saveAs || !fileHandle) {
        if (!context.platform.pickSave) {
          context.platform.download(text, filename)
          update({ downloadStartedAt: now(), fileMessage: 'Descarga iniciada' })
          return false // A download cannot confirm that a file was saved.
        }
        target = await context.platform.pickSave(filename)
      } else {
        target = fileHandle
        const permission = target.requestPermission ? await target.requestPermission({ mode: 'readwrite' }) : await target.queryPermission({ mode: 'readwrite' })
        if (permission !== 'granted') throw new Error('Autoriza el acceso al archivo o utiliza Guardar como.')
      }
      if (generation !== state.documentGeneration) return false
      const sameFile = target === fileHandle || Boolean(fileHandle && target.isSameEntry && await target.isSameEntry(fileHandle))
      const fingerprint = await writeTextFile(target, text, sameFile ? fileFingerprint : null)
      if (generation !== state.documentGeneration) return false
      fileHandle = target; fileFingerprint = fingerprint
      update({ fileSavedAt: now(), fileName: target.name ?? filename, fileDirty: capturedRevision !== revision, downloadStartedAt: null, fileMessage: 'Guardado' })
      scheduleRecovery()
      await flushLocalSave()
      return true // The file and the local copy have independent outcomes.
    } catch (error) {
      if (generation === state.documentGeneration && !isFileCancellation(error)) update({ fileMessage: message(error) })
      return false
    } finally { if (generation === state.documentGeneration) update({ fileBusy: false }) }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    initialize() { return initialization ??= initialize() },
    applyDocumentCommand,
    getQuickNoteDraft(id: string, generation: number) {
      return generation === state.documentGeneration ? quickNoteDrafts.get(id) : undefined
    },
    setQuickNoteDraft(id: string, text: string | null, generation: number) {
      if (!state.active || generation !== state.documentGeneration) return
      if (text === null) quickNoteDrafts.delete(id)
      else if (state.document.board.quickNotes.some(note => note.id === id)) quickNoteDrafts.set(id, text)
    },
    async setTitle(title: string) {
      const error = documentNameError(title)
      if (error) { update({ fileMessage: error }); return false }
      return applyDocumentCommand(document => renameDocument(document, title.trim()))
    },
    setOpenModules(ids: DocumentModuleId[], generation = state.documentGeneration) {
      if (!state.ready || !state.active || state.replacing || generation !== state.documentGeneration) return
      const openModules = [...new Set(ids)]
      if (openModules.length === state.openModules.length && openModules.every((id, index) => id === state.openModules[index])) return
      const next = captureUIBoard(state.document, openModules, data ? { document: state.document, data } : undefined)
      next.document.updatedAt = latestDocumentTime(state.document.document.updatedAt, now())
      let text: string
      try { text = serializeDocument(next) } catch (error) { update({ fileMessage: message(error) }); return }
      data = next; dataText = text; revision++
      cancelDocumentRead()
      update({ openModules: next.openModules, document: { ...state.document, document: next.document }, fileDirty: true })
      scheduleRecovery()
    },
    async newDocument(title: string) {
      if (!state.ready || state.fileBusy || state.replacing) return false
      const error = documentNameError(title)
      if (error) { update({ fileMessage: error }); return false }
      cancelDocumentRead(); update({ replacing: true, fileBusy: true })
      try {
        await settleRecovery()
        activate(captureUIBoard(createEmptyDocument(title.trim()), []))
        scheduleRecovery(); await flushLocalSave()
        return true
      } catch (error) { update({ fileMessage: message(error) }); scheduleRecovery(); return false }
      finally { update({ replacing: false, fileBusy: false }) }
    },
    saveDocument: () => saveDocument(),
    saveAs: () => saveDocument(true),
    async loadDocument(file: DocumentFile, handle?: SaveFileHandle) {
      if (!state.ready || state.fileBusy || state.replacing) return false
      cancelDocumentRead()
      const controller = new AbortController(), generation = state.documentGeneration, capturedRevision = revision
      let replacingThisRead = false
      pendingRead = controller
      update({ documentReading: true, fileMessage: null })
      try {
        // The picker may predate Save and continue. Read the selected handle afresh.
        const source = handle?.getFile ? await handle.getFile() : file
        if (controller.signal.aborted) return false
        const loaded = await loadVisibleDocument(source, { documentGeneration: generation, signal: controller.signal })
        if (controller.signal.aborted || generation !== state.documentGeneration || capturedRevision !== revision) return false
        if (loaded.status === 'cancelled') return false
        if (loaded.status === 'error') { update({ fileMessage: loaded.message }); return false }
        pendingRead = null; replacingThisRead = true
        update({ replacing: true, fileBusy: true })
        await settleRecovery()
        activate(loaded.data, { data: loaded.data, savedAt: '', fileHandle: handle,
          fileFingerprint: handle ? loaded.fingerprint : null, fileName: handle?.name ?? source.name ?? null, fileSavedAt: null, fileDirty: false })
        scheduleRecovery(); await flushLocalSave()
        return true
      } catch (error) {
        if (!controller.signal.aborted && generation === state.documentGeneration) {
          update({ fileMessage: message(error) })
          if (replacingThisRead) scheduleRecovery()
        }
        return false
      } finally {
        if (pendingRead === controller) { pendingRead = null; update({ documentReading: false }) }
        if (replacingThisRead && generation === state.documentGeneration) update({ documentReading: false, replacing: false, fileBusy: false })
      }
    },
    cancelDocumentRead,
    hasOpenPicker: () => Boolean(context.platform.pickOpen),
    async pickDocument() {
      if (state.fileBusy) return null
      cancelDocumentRead()
      try { return await context.platform.pickOpen?.() ?? null }
      catch (error) { if (!isFileCancellation(error)) update({ fileMessage: message(error) }); return null }
    },
    async closeDocument() {
      if (!state.active || state.fileBusy) return false
      cancelDocumentRead(); update({ replacing: true, fileBusy: true })
      try {
        await settleRecovery(); await repository.clear()
        resetNavigation(); resetMapViews(); releaseImages(); releaseGpxOriginals(state.document.map?.gpx.map(item => item.fingerprint) ?? [])
        quickNoteDrafts.clear()
        data = null; dataText = ''; fileHandle = undefined; fileFingerprint = null; revision++
        update({ document: createEmptyDocument(), active: false, documentGeneration: state.documentGeneration + 1, openModules: [],
          fileDirty: false, fileSavedAt: null, fileName: null, localSavedAt: null, fileMessage: null, downloadStartedAt: null,
          autosaveSaving: false, autosaveUnavailable: false, localStorageMessage: null, storageConflict: false })
        return true
      } catch (error) { update({ fileMessage: message(error) }); scheduleRecovery(); return false }
      finally { update({ replacing: false, fileBusy: false }) }
    },
    async retryAutosave() {
      if (!state.ready || state.fileBusy) return
      if (!state.active) { await initialize(); return }
      recoveryPending = true; await flushLocalSave()
    },
    flushLocalSave,
    async readGpx(reference: MapGpxReference) {
      const generation = state.documentGeneration
      try {
        const resource = gpxResource(reference.fingerprint)
        if (!resource || generation !== state.documentGeneration) return null
        return new File([resource.blob], reference.name, { type: 'application/gpx+xml' })
      } catch { return null }
    },
    async generateReport(selection?: ReportSelection, timerRecords?: readonly TimerRecord[] | null, pageOptions: ReportPageOptions = DEFAULT_REPORT_PAGE): Promise<GeneratedReport | null> {
      if (!state.active || state.replacing || !data) return null
      const generation = state.documentGeneration, snapshot = openUIBoard(data)
      const fields = selection ? structuredClone(selection) : undefined
      const timers = timerRecords ? structuredClone(timerRecords) : timerRecords
      const page = { ...pageOptions }, generatedAt = context.now?.() ?? new Date()
      const { createDocumentReport, paginateReport, prepareReportTypography } = await import('./reportEngine')
      const fontStyles = await prepareReportTypography()
      if (!state.active || state.replacing || generation !== state.documentGeneration) return null
      const report = await paginateReport(createDocumentReport(snapshot, generatedAt, fontStyles, fields, timers, page), page)
      return state.active && !state.replacing && generation === state.documentGeneration ? { report } : null
    },
    async saveGeneratedReport(report: GeneratedReport['report']) {
      if (!state.active || state.replacing) return false
      if (!context.platform.pickSave) { context.platform.download(report.html, report.filename, 'text/html'); return true }
      try {
        const handle = await context.platform.pickSave(report.filename, 'text/html')
        if (fileHandle && (handle === fileHandle || await handle.isSameEntry?.(fileHandle))) throw new Error('Elige un archivo HTML distinto del UIBoard.')
        await writeTextFile(handle, report.html)
        return true
      } catch (error) { if (isFileCancellation(error)) return false; throw error }
    },
    connectLocalAutosave() {
      const flush = () => { void flushLocalSave() }
      const visibility = () => { if (document.visibilityState === 'hidden') flush() }
      const beforeUnload = (event: BeforeUnloadEvent) => {
        if (state.active && (state.fileDirty || state.fileBusy || state.autosaveUnavailable || recoveryPending || recoverySave)) {
          flush(); event.preventDefault(); event.returnValue = ''
        }
      }
      document.addEventListener('visibilitychange', visibility)
      window.addEventListener('pagehide', flush)
      window.addEventListener('beforeunload', beforeUnload)
      return () => {
        document.removeEventListener('visibilitychange', visibility)
        window.removeEventListener('pagehide', flush)
        window.removeEventListener('beforeunload', beforeUnload)
      }
    },
  }
}

function message(error: unknown) { return error instanceof Error ? error.message : 'No se pudo completar la operación.' }
export type DocumentStore = ReturnType<typeof createDocumentStore>
let browserStore: DocumentStore | undefined
export function getDocumentStore(): DocumentStore {
  return browserStore ??= createDocumentStore(new UIBoardRecoveryRepository(), { platform: createBrowserFilePlatform() })
}
export function useDocumentStore(store: DocumentStore = getDocumentStore()) { return useSyncExternalStore(store.subscribe, store.getSnapshot) }
