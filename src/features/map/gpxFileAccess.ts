import type { GpxReadHandle } from '../../storage/gpxAccessRepository'
import { parseGpx } from './gpx'
import { checkFileBytes, INPUT_BUDGETS, InputBudgetError, budgetIssue } from '../../domain/input/inputBudgets'

export function pickGpxFiles(multiple: boolean): Promise<GpxReadHandle[]> | null {
  const browser = window as Window & {
    showOpenFilePicker?: (options: {
      multiple: boolean
      types: { description: string; accept: Record<string, string[]> }[]
    }) => Promise<GpxReadHandle[]>
  }
  // Invoke directly from the click, before awaiting storage or file reads.
  return browser.showOpenFilePicker ? browser.showOpenFilePicker({
    multiple, types: [{ description: 'Recorrido GPX', accept: { 'application/gpx+xml': ['.gpx'] } }],
  }) : null
}

export async function readGpxFile(file: File, expectedFingerprint?: string) {
  checkFileBytes(file.size, 'gpx')
  if (file.name.length > INPUT_BUDGETS.gpxNameCharacters) throw new InputBudgetError(budgetIssue('gpx.name', INPUT_BUDGETS.gpxNameCharacters, 'caracteres'))
  const bytes = await file.arrayBuffer()
  checkFileBytes(bytes.byteLength, 'gpx')
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const fingerprint = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('')
  if (expectedFingerprint && expectedFingerprint !== fingerprint) {
    throw new Error('El contenido no coincide con el GPX guardado. Selecciona su archivo original.')
  }
  return { fingerprint, data: parseGpx(new TextDecoder().decode(bytes)) }
}
