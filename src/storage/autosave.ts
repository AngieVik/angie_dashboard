import type { AngieDocument } from '../domain/document/types'
import type { ActiveDocumentRepository } from './documentRepository'

// Ordered writes prevent an earlier, slower save from replacing a newer one.
export function createAutosave(repository: ActiveDocumentRepository, report: (available: boolean) => void) {
  let tail = Promise.resolve()
  return {
    save(document: AngieDocument) {
      const copy = structuredClone(document)
      tail = tail.then(async () => {
        try {
          await repository.saveActive(copy)
          report(true)
        } catch {
          report(false)
        }
      })
      return tail
    },
    flush: () => tail,
  }
}
