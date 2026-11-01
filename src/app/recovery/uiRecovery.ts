import type { AngieDocument } from '../../domain/document/types'
import { suggestFilename } from '../../platform/files/fileAccess'

// Rescue the current in-memory document without waiting for storage or validating
// it again. Valid data keeps the portable format; damaged data remains available
// for manual recovery instead of blocking the download.
export function createEmergencyCopy(document: AngieDocument) {
  return {
    text: JSON.stringify(document, null, 2) + '\n',
    filename: suggestFilename((document.document?.title || 'UIBoard') + '_recuperacion'),
  }
}

export function listenForUnexpectedErrors(target: EventTarget, report: (error: unknown) => void) {
  const rejection = (event: Event) => {
    const reason: unknown = (event as PromiseRejectionEvent).reason
    if (typeof reason === 'object' && reason !== null && 'name' in reason && reason.name === 'AbortError') return
    report(reason)
  }
  const error = (event: Event) => {
    const failure = event as ErrorEvent
    report(failure.error ?? failure.message)
  }
  target.addEventListener('unhandledrejection', rejection)
  target.addEventListener('error', error)
  return () => {
    target.removeEventListener('unhandledrejection', rejection)
    target.removeEventListener('error', error)
  }
}
