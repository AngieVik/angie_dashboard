import { validateDocument } from './validateDocument'
import type { UIBoardData } from './types'
import { checkTextBytes } from '../input/inputBudgets'
import { measureWork } from '../../platform/workMetrics'

export function serializeDocument(document: UIBoardData): string {
  const result = measureWork('document.validate', () => validateDocument(document))
  if (!result.success) throw new Error(result.errors.map(error => error.message).join('\n'))
  const text = measureWork('document.stringify', () => `${JSON.stringify(result.document, null, 2)}\n`)
  checkTextBytes(text, 'json')
  return text
}
