import type { AngieDocument } from '../domain/document/types'
import type { ActiveDocumentRepository, DocumentSession } from './documentRepository'

// One writer, with the latest cumulative document replacing queued snapshots.
// Every caller resolves only after its changes are included in a completed write.
export function createAutosave(repository: ActiveDocumentRepository, report: (available: boolean, error?: unknown) => void) {
  type Job = { document: AngieDocument; session?: DocumentSession; resolve: ((saved: boolean) => void)[] }
  let pending: Job | undefined
  let running = false
  let tail = Promise.resolve(true)
  async function drain() {
    while (pending) {
      const job = pending
      pending = undefined
      let saved = false
      try { await repository.saveActive(job.document, job.session); saved = true; report(true) }
      catch (error) { report(false, error) }
      job.resolve.forEach(resolve => resolve(saved))
    }
    running = false
  }
  return {
    save(document: AngieDocument, session?: DocumentSession) {
      const copy = structuredClone(document)
      tail = new Promise<boolean>(resolve => {
        pending = { document: copy, session: session ? structuredClone(session) : undefined, resolve: [...(pending?.resolve ?? []), resolve] }
        if (!running) { running = true; void Promise.resolve().then(drain) }
      })
      return tail
    },
    flush: () => tail,
  }
}
