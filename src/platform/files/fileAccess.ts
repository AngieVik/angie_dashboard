import type { UIBoardData } from '../../domain/document/types'
import type { DocumentFile, SaveFileHandle } from './fileHandleTypes'
import { analyzeDocument } from './documentWorkerClient'
import type { DocumentReadOptions } from './documentWorkerClient'
import { checkFileBytes } from '../../domain/input/inputBudgets'

export interface FilePlatform {
  pickOpen?: () => Promise<{ file: DocumentFile; handle: SaveFileHandle }>
  pickSave?: (filename: string, mimeType?: string) => Promise<SaveFileHandle>
  download(text: string, filename: string, mimeType?: string): void
}

export type LoadOutcome =
  | { status: 'loaded'; data: UIBoardData; fingerprint: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

export function suggestFilename(title: string): string {
  let base = [...title].filter(character => {
    const code = character.charCodeAt(0)
    return code > 31 && !(code >= 127 && code <= 159) && !'<>:"/\\|?*'.includes(character)
  }).join('').replace(/[ .]+$/, '').replace(/(?:\.uiboard)?\.json$/i, '').replace(/[ .]+$/, '')
  if (!base || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(base)) base = 'UIBoard'
  return `${base}.uiboard.json`
}

export function isFileCancellation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

export async function textFingerprint(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function writeTextFile(handle: SaveFileHandle, text: string, expectedFingerprint?: string | null): Promise<string> {
  const stream = await handle.createWritable({ mode: 'exclusive' })
  try {
    if (expectedFingerprint) {
      const current = await handle.getFile?.()
      if (current) checkFileBytes(current.size, 'json')
      if (!current || await textFingerprint(await current.text()) !== expectedFingerprint) {
        throw new Error('El archivo ha cambiado fuera de Angie. Ábrelo de nuevo o guarda con otro nombre.')
      }
    }
    const fingerprint = await textFingerprint(text)
    await stream.write(text)
    await stream.close()
    return fingerprint
  } catch (error) {
    try { await stream.abort() } catch { /* Preserve the original write error. */ }
    throw error
  }
}

export async function loadVisibleDocument(file: DocumentFile, options: DocumentReadOptions): Promise<LoadOutcome> {
  try {
    const response = await analyzeDocument(file, options)
    if (!response.result.success) return { status: 'error', message: response.result.errors.map(error => error.message).join('\n') }
    return { status: 'loaded', data: response.result.document, fingerprint: response.fingerprint }
  } catch (error) {
    if (options.signal?.aborted || isFileCancellation(error)) return { status: 'cancelled' }
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo abrir el UIBoard.' }
  }
}

export function createBrowserFilePlatform(): FilePlatform {
  const browser = window as Window & {
    showOpenFilePicker?: (options: { multiple: false; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<(SaveFileHandle & { getFile(): Promise<File> })[]>
    showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<SaveFileHandle>
  }
  return {
    pickOpen: browser.showOpenFilePicker ? async () => {
      const [handle] = await browser.showOpenFilePicker!({ multiple: false, types: [{ description: 'UIBoard', accept: { 'application/json': ['.json'] } }] })
      if (!handle) throw new DOMException('Cancelado', 'AbortError')
      return { file: await handle.getFile(), handle }
    } : undefined,
    pickSave: browser.showSaveFilePicker ? (filename, mimeType = 'application/json') => browser.showSaveFilePicker!({
      suggestedName: filename,
      types: [{ description: mimeType === 'text/html' ? 'Informe HTML' : 'UIBoard', accept: { [mimeType]: [mimeType === 'text/html' ? '.html' : '.json'] } }],
    }) : undefined,
    download(text, filename, mimeType = 'application/json') {
      const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = filename
      document.body.append(anchor)
      try { anchor.click() } finally {
        anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    },
  }
}
