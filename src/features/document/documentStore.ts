import { useSyncExternalStore } from 'react'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { serializeDocument } from '../../domain/document/serializeDocument'
import type { AngieDocument } from '../../domain/document/types'
import { createBrowserFilePlatform, loadVisibleDocument, saveVisibleDocument } from '../../platform/files/fileAccess'
import type { DocumentFile, FileAccessContext, SaveOutcome } from '../../platform/files/fileAccess'
import { DocumentRepository } from '../../storage/documentRepository'
import type { ActiveDocumentRepository } from '../../storage/documentRepository'
import { createAutosave } from '../../storage/autosave'

export interface DocumentSnapshot {
  document: AngieDocument
  documentGeneration: number
  autosaveUnavailable: boolean
  recoveryPending: boolean
  fileBusy: boolean
  fileMessage: string | null
  downloadFallback: (() => Promise<SaveOutcome>) | null
}

export function createDocumentStore(repository: ActiveDocumentRepository, initialContext: FileAccessContext) {
  let state: DocumentSnapshot = {
    document: createEmptyDocument(), documentGeneration: 0, autosaveUnavailable: false, recoveryPending: false,
    fileBusy: false, fileMessage: null, downloadFallback: null,
  }
  let revision = 0
  let fileOperation = 0
  let needsRecovery = true
  let recoveryCandidate: AngieDocument | null = null
  let initialization: Promise<void> | undefined
  let recoveryOperation: Promise<void> | undefined
  let fileContext = { ...initialContext }
  const listeners = new Set<() => void>()
  function update(patch: Partial<DocumentSnapshot>) {
    state = { ...state, ...patch }
    listeners.forEach(listener => listener())
  }
  const autosave = createAutosave(repository, available => update({ autosaveUnavailable: !available }))
  const persist = () => !needsRecovery && !state.recoveryPending ? autosave.save(state.document) : Promise.resolve()
  function resetFileContext() {
    fileContext = { platform: initialContext.platform, now: initialContext.now }
  }
  async function recover() {
    try {
      const recovered = await repository.loadActive()
      needsRecovery = false
      if (recovered && revision > 0) {
        recoveryCandidate = recovered
        update({ recoveryPending: true, autosaveUnavailable: false })
      } else {
        if (recovered) update({ document: recovered, documentGeneration: state.documentGeneration + 1 })
        update({ autosaveUnavailable: false })
        await persist()
      }
    } catch {
      needsRecovery = true
      update({ autosaveUnavailable: true })
    }
  }
  function mutateDocument(mutate: (document: AngieDocument) => void) {
    const candidate = structuredClone(state.document)
    mutate(candidate)
    // A mutation cannot change document identity or creation time.
    candidate.document = {
      ...candidate.document,
      id: state.document.document.id,
      createdAt: state.document.document.createdAt,
      updatedAt: state.document.document.updatedAt,
    }
    if (serializeDocument(candidate) === serializeDocument(state.document)) return
    const now = new Date().toISOString()
    candidate.document.updatedAt = now < candidate.document.createdAt ? candidate.document.createdAt : now
    serializeDocument(candidate)
    revision++
    update({ document: candidate })
    void persist()
  }
  function applySaveOutcome(outcome: SaveOutcome) {
    if (outcome.status === 'fallback') update({
      fileMessage: outcome.message,
      downloadFallback: () => saveVisibleDocument(state.document, {
        platform: { download: initialContext.platform.download }, now: initialContext.now,
      }),
    })
    else if (outcome.status === 'error') update({ fileMessage: outcome.message, downloadFallback: null })
    else update({ fileMessage: null, downloadFallback: null })
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    initialize() { initialization ??= recover(); return initialization },
    mutateDocument,
    setTitle(title: string) { mutateDocument(document => { document.document.title = title }) },
    newDocument() {
      fileOperation++
      revision++
      resetFileContext()
      update({ document: createEmptyDocument(), documentGeneration: state.documentGeneration + 1, fileBusy: false, fileMessage: null, downloadFallback: null })
      void persist()
    },
    async loadDocument(file: DocumentFile) {
      if (state.fileBusy) return
      const operation = ++fileOperation
      const initialRevision = revision
      update({ fileBusy: true, fileMessage: null, downloadFallback: null })
      const result = await loadVisibleDocument(file)
      if (operation !== fileOperation) return
      if (result.status === 'error') update({ fileBusy: false, fileMessage: result.message })
      else if (revision !== initialRevision) update({
        fileBusy: false,
        fileMessage: 'El documento cambió durante la lectura. Vuelve a cargar el archivo para reemplazarlo.',
      })
      else {
        revision++
        resetFileContext()
        update({ document: result.document, documentGeneration: state.documentGeneration + 1, fileBusy: false })
        await persist()
      }
    },
    async saveDocument() {
      if (state.fileBusy) return
      const operation = ++fileOperation
      update({ fileBusy: true, fileMessage: null, downloadFallback: null })
      const outcome = await saveVisibleDocument(state.document, fileContext)
      if (operation !== fileOperation) return
      update({ fileBusy: false })
      applySaveOutcome(outcome)
    },
    async downloadJson() {
      if (state.fileBusy) return
      update({ fileBusy: true })
      // Use the latest in-memory document even if IndexedDB is unavailable.
      const outcome = await saveVisibleDocument(state.document, {
        platform: { download: initialContext.platform.download }, now: initialContext.now,
      })
      update({ fileBusy: false })
      applySaveOutcome(outcome)
    },
    async acceptDownloadFallback() {
      if (!state.downloadFallback || state.fileBusy) return
      const download = state.downloadFallback
      update({ fileBusy: true })
      const outcome = await download()
      update({ fileBusy: false })
      applySaveOutcome(outcome)
    },
    retryAutosave() {
      if (recoveryOperation) return recoveryOperation
      recoveryOperation = (async () => {
        if (needsRecovery) await recover()
        else await persist()
      })().finally(() => { recoveryOperation = undefined })
      return recoveryOperation
    },
    async confirmRecovery(accept: boolean) {
      if (!state.recoveryPending || !recoveryCandidate) return
      if (accept) {
        revision++
        resetFileContext()
        update({ document: recoveryCandidate, documentGeneration: state.documentGeneration + 1, fileMessage: null, downloadFallback: null })
      }
      recoveryCandidate = null
      update({ recoveryPending: false })
      await persist()
    },
    flushAutosave: () => autosave.flush(),
  }
}

export type DocumentStore = ReturnType<typeof createDocumentStore>
let browserStore: DocumentStore | undefined
export function getDocumentStore(): DocumentStore {
  browserStore ??= createDocumentStore(new DocumentRepository(), { platform: createBrowserFilePlatform() })
  return browserStore
}
export function useDocumentStore(store: DocumentStore = getDocumentStore()) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
