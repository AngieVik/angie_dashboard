import type { AngieDocument } from '../domain/document/types'
import type { ActiveDocumentRepository, DocumentSession } from './documentRepository'
import { DocumentConflictError } from './documentRepository'

// One writer, with the latest cumulative document replacing queued snapshots.
// Every caller resolves only after its changes are included in a completed write.
export function createAutosave(repository: ActiveDocumentRepository, report: (available: boolean, error?: unknown) => void) {
  type Job = { document: AngieDocument; session?: DocumentSession; resolve: ((saved: boolean) => void)[] }
  const pending = new Map<string, Job>()
  const blocked = new Set<string>()
  let running: Promise<void> | undefined
  async function drain() {
    while (pending.size) {
      const [id, job] = pending.entries().next().value!
      pending.delete(id)
      let saved = false
      if (!blocked.has(id)) {
        try { await repository.saveActive(job.document, job.session); saved = true; report(true) }
        catch (error) { if (error instanceof DocumentConflictError) blocked.add(id); report(false, error) }
      }
      job.resolve.forEach(resolve => resolve(saved))
    }
  }
  async function flush(): Promise<void> {
    if (!running && pending.size) running = Promise.resolve().then(drain).finally(() => { running = undefined })
    await running
    if (pending.size) await flush()
  }
  return {
    save(document: AngieDocument, session?: DocumentSession) {
      const copy = structuredClone(document)
      const id = copy.document.id
      const result = new Promise<boolean>(resolve => {
        pending.set(id, { document: copy, session: session ? structuredClone(session) : undefined, resolve: [...(pending.get(id)?.resolve ?? []), resolve] })
      })
      void flush()
      return result
    },
    flush,
    resume() { blocked.clear() },
  }
}
