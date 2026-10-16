import type { AngieDocument } from '../domain/document/types'
import type { WorkspaceFiles, WorkspaceSaveResult } from '../platform/files/workspaceFiles'

// Coalesce edits per dashboard, but retain outgoing dashboards until written.
export function createWorkspaceAutosave(files: WorkspaceFiles, delayMs = 750) {
  type Job = { document: AngieDocument; resolve: ((result: WorkspaceSaveResult) => void)[] }
  const pending = new Map<string, Job>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined

  async function drain() {
    while (pending.size) {
      const [id, job] = pending.entries().next().value!
      pending.delete(id)
      let result: WorkspaceSaveResult
      try { result = await files.save(job.document) }
      catch { result = { status: 'error', message: 'No se pudo guardar en la carpeta de trabajo. Se conserva el autoguardado local.' } }
      job.resolve.forEach(resolve => resolve(result))
    }
  }

  async function flush(): Promise<void> {
    clearTimeout(timer)
    timer = undefined
    if (!running) running = drain().finally(() => { running = undefined })
    await running
    if (pending.size) await flush()
  }

  return {
    schedule(document: AngieDocument) {
      const copy = structuredClone(document)
      const id = copy.document.id
      const result = new Promise<WorkspaceSaveResult>(resolve => {
        pending.set(id, { document: copy, resolve: [...(pending.get(id)?.resolve ?? []), resolve] })
      })
      if (!running) {
        clearTimeout(timer)
        timer = setTimeout(() => { void flush() }, delayMs)
      }
      return result
    },
    flush,
  }
}
