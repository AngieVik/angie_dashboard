import { validateDocument } from './validateDocument'
import type { AngieDocument } from './types'

export function serializeDocument(document: AngieDocument): string {
  const result = validateDocument(document)
  if (!result.success) throw new Error(result.errors.map(error => error.message).join('\n'))
  return `${JSON.stringify(result.document, null, 2)}\n`
}
