import { validateWorkingDocument } from './validateDocument'
import type { AngieDocument } from './types'
import { checkTextBytes } from '../input/inputBudgets'

export function serializeWorkingDocument(document: AngieDocument): string {
  const result = validateWorkingDocument(document)
  if (!result.success) throw new Error(result.errors.map(error => error.message).join('\n'))
  const text = `${JSON.stringify(result.document, null, 2)}\n`
  checkTextBytes(text, 'json')
  return text
}
