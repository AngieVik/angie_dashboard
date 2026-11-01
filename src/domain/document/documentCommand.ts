import type { AngieDocument } from './types'

export interface DocumentCommandResult<T = void> {
  document: AngieDocument
  changed: boolean
  value: T
}
export type DocumentCommand = (document: AngieDocument) => DocumentCommandResult<unknown>

export function commandResult(previous: AngieDocument, document: AngieDocument): DocumentCommandResult
export function commandResult<T>(previous: AngieDocument, document: AngieDocument, value: T): DocumentCommandResult<T>
export function commandResult<T>(previous: AngieDocument, document: AngieDocument, value?: T) {
  return { document, changed: document !== previous, value }
}

// Compose against the preceding result; the store publishes only the final state.
export function applyDocumentCommands(document: AngieDocument, commands: readonly DocumentCommand[]) {
  const next = commands.reduce((current, command) => command(current).document, document)
  return commandResult(document, next)
}

// Shallow equality: nested branches must first reuse their previous references.
export function sameRecord(left: object | null | undefined, right: object | null | undefined): boolean {
  if (left === right) return true
  if (!left || !right) return false
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && Object.is(a[key], b[key]))
}
