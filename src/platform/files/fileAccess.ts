import { migrateDocument } from '../../domain/document/migrateDocument'
import { validateEmbeddedImage } from './embeddedImage'
import type { AngieDocument } from '../../domain/document/types'
import type { WorkspaceFiles } from './workspaceFiles'

export interface SaveFileHandle {
  getFile?(): Promise<DocumentFile>
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>
  createWritable(): Promise<{
    write(text: string): Promise<void>
    close(): Promise<void>
    abort(): Promise<void>
  }>
}

export interface FilePlatform {
  pickOpen?: () => Promise<{ file: DocumentFile; handle: SaveFileHandle }>
  download(text: string, filename: string, mimeType?: string): void
}

export interface FileAccessContext {
  platform: FilePlatform
  now?: () => Date
  workspace?: WorkspaceFiles
}

export type LoadOutcome =
  | { status: 'loaded'; document: AngieDocument; migrated: boolean }
  | { status: 'error'; message: string }

export type DocumentFile = Pick<File, 'text'>

export function suggestFilename(title: string, now = new Date()): string {
  // Include both ASCII and C1 control characters. Do not mutate the title.
  let base = [...title].filter(character => {
    const code = character.charCodeAt(0)
    return code > 31 && !(code >= 127 && code <= 159) && !'<>:"/\\|?*'.includes(character)
  }).join('').replace(/[ .]+$/, '')
  base = base.replace(/\.json$/i, '').replace(/[ .]+$/, '')
  if (!base || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(base)) {
    const pad = (value: number) => String(value).padStart(2, '0')
    base = `drp_${String(now.getFullYear()).padStart(4, '0')}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  }
  return `${base}.json`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido'
}

export async function loadVisibleDocument(file: DocumentFile): Promise<LoadOutcome> {
  try {
    const result = migrateDocument(JSON.parse(await file.text()))
    if (!result.success) return { status: 'error', message: result.errors.map(error => error.message).join('\n') }
    if (result.document.board.backgroundImage) await validateEmbeddedImage(result.document.board.backgroundImage.dataUrl)
    return { status: 'loaded', document: result.document, migrated: result.migrated }
  } catch (error) {
    return { status: 'error', message: `No se pudo leer el JSON: ${errorMessage(error)}` }
  }
}

export function createBrowserFilePlatform(): FilePlatform {
  const browser = window as Window & {
    showOpenFilePicker?: (options: { multiple: false; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<(SaveFileHandle & { getFile(): Promise<File> })[]>
  }
  return {
    pickOpen: browser.showOpenFilePicker ? async () => {
      const [handle] = await browser.showOpenFilePicker!({ multiple: false, types: [{ description: 'Documento Angie Dashboard JSON', accept: { 'application/json': ['.json'] } }] })
      if (!handle) throw new DOMException('Cancelado', 'AbortError')
      return { file: await handle.getFile(), handle }
    } : undefined,
    download(text, filename, mimeType = 'application/json') {
      const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.append(anchor)
      try { anchor.click() } finally {
        anchor.remove()
        // Give the browser time to start consuming the Blob URL.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    },
  }
}
