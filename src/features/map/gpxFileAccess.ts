import { analyzeGpx } from './gpxWorkerClient'
import type { GpxReadOptions } from './gpxWorkerClient'
import { checkFileBytes, INPUT_BUDGETS, InputBudgetError, budgetIssue } from '../../domain/input/inputBudgets'
import { retainGpx } from '../../storage/gpxResources'

export interface GpxReadHandle {
  readonly name: string
  getFile(): Promise<File>
}

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

export async function readGpxFile(file: File, expectedFingerprint?: string, retainOriginal = true, options: GpxReadOptions = { documentGeneration: 0 }) {
  checkFileBytes(file.size, 'gpx')
  if (file.name.length > INPUT_BUDGETS.gpxNameCharacters) throw new InputBudgetError(budgetIssue('gpx.name', INPUT_BUDGETS.gpxNameCharacters, 'caracteres'))
  const { fingerprint, data } = await analyzeGpx(file, expectedFingerprint, options)
  options.signal?.throwIfAborted()
  if (retainOriginal) retainGpx({ fingerprint, blob: file })
  return { fingerprint, data }
}
