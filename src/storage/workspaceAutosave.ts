import type { DocumentSave } from './documentSave'
import type { WorkspaceFiles, WorkspaceSaveResult } from '../platform/files/workspaceFiles'

// Coalesce edits per dashboard, but retain outgoing dashboards until written.
export function createWorkspaceAutosave(files: WorkspaceFiles, delayMs = 1000) {
  type Job = { save: DocumentSave; resolve: ((result: WorkspaceSaveResult) => void)[] }
  const pending = new Map<string, Job>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined

  async function drain() {
    while (pending.size) {
      const [id, job] = pending.entries().next().value!
      pending.delete(id)
      let result: WorkspaceSaveResult
      try { const snapshot = job.save.prepare(); result = await files.save(snapshot.document, snapshot) }
      catch { result = { status: 'error', message: 'No se pudo guardar en la carpeta de trabajo.' } }
      job.resolve.forEach(resolve => resolve(result))
    }
  }

  async function flush(): Promise<void> {
    clearTimeout(timer)
    clearTimeout(deadline)
    timer = undefined
    deadline = undefined
    if (!running) running = drain().finally(() => { running = undefined })
    await running
    if (pending.size) await flush()
  }

  return {
    schedule(save: DocumentSave) {
      const id = save.documentId
      const result = new Promise<WorkspaceSaveResult>(resolve => {
        pending.set(id, { save, resolve: [...(pending.get(id)?.resolve ?? []), resolve] })
      })
      if (!running) {
        clearTimeout(timer)
        timer = setTimeout(() => { void flush() }, delayMs)
        deadline ??= setTimeout(() => { void flush() }, 5000)
      }
      return result
    },
    flush,
  }
}
