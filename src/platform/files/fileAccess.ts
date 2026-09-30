import { migrateDocument } from '../../domain/document/migrateDocument'
import { serializeDocument } from '../../domain/document/serializeDocument'
import type { AngieDocumentV1 } from '../../domain/document/types'

export interface SaveFileHandle {
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  createWritable(): Promise<{
    write(text: string): Promise<void>
    close(): Promise<void>
    abort(): Promise<void>
  }>
}

export interface FilePlatform {
  pickSave?: (suggestedName: string) => Promise<SaveFileHandle>
  download(text: string, filename: string): void
}

export interface FileAccessContext {
  platform: FilePlatform
  link?: { handle: SaveFileHandle; title: string }
  now?: () => Date
}

export type SaveOutcome =
  | { status: 'saved' | 'downloaded' | 'cancelled' }
  | { status: 'fallback'; message: string; download: () => Promise<SaveOutcome> }
  | { status: 'error'; message: string }

export type LoadOutcome =
  | { status: 'loaded'; document: AngieDocumentV1 }
  | { status: 'error'; message: string }

export type DocumentFile = Pick<File, 'text'>

export function suggestFilename(title: string, now = new Date()): string {
  // Include both ASCII and C1 control characters. Do not mutate the title.
  let base = [...title].filter(character => {
    const code = character.charCodeAt(0)
    return code > 31 && !(code >= 127 && code <= 159) && !'<>:"/\\|?*'.includes(character)
  }).join('').replace(/[ .]+$/, '')
  base = base.replace(/\.json$/i, '').replace(/[ .]+$/, '')
  if (!base || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(base)) {
    const pad = (value: number) => String(value).padStart(2, '0')
    base = `drp_${String(now.getFullYear()).padStart(4, '0')}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  }
  return `${base}.json`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido'
}

export async function saveVisibleDocument(document: AngieDocumentV1, context: FileAccessContext): Promise<SaveOutcome> {
  let text: string
  try {
    text = serializeDocument(document)
  } catch (error) {
    return { status: 'error', message: errorMessage(error) }
  }
  const title = document.document.title
  const filename = suggestFilename(title, context.now?.())
  const download = async (): Promise<SaveOutcome> => {
    try {
      context.platform.download(text, filename)
      return { status: 'downloaded' }
    } catch (error) {
      return { status: 'error', message: `No se pudo descargar el JSON: ${errorMessage(error)}` }
    }
  }
  if (!context.platform.pickSave) return download()

  let stream: Awaited<ReturnType<SaveFileHandle['createWritable']>> | undefined
  let picking = false
  try {
    let handle: SaveFileHandle
    if (context.link && context.link.title === title) {
      handle = context.link.handle
      if (await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
        throw new Error('No hay permiso para actualizar el archivo vinculado')
      }
    } else {
      // Call the picker directly from the user action, before awaiting anything.
      picking = true
      handle = await context.platform.pickSave(filename)
      picking = false
    }
    stream = await handle.createWritable()
    await stream.write(text)
    await stream.close()
    context.link = { handle, title }
    return { status: 'saved' }
  } catch (error) {
    if (stream) {
      try { await stream.abort() } catch { /* Preserve the original failure. */ }
    }
    // Only cancellation of a picker is silent; a cancelled write is an error.
    if (picking && typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') {
      return { status: 'cancelled' }
    }
    return {
      status: 'fallback',
      message: `No se pudo guardar el archivo: ${errorMessage(error)}`,
      download,
    }
  }
}

export async function loadVisibleDocument(file: DocumentFile): Promise<LoadOutcome> {
  try {
    const result = migrateDocument(JSON.parse(await file.text()))
    if (!result.success) return { status: 'error', message: result.errors.map(error => error.message).join('\n') }
    return { status: 'loaded', document: result.document }
  } catch (error) {
    return { status: 'error', message: `No se pudo leer el JSON: ${errorMessage(error)}` }
  }
}

export function createBrowserFilePlatform(): FilePlatform {
  const browser = window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName: string
      types: { description: string; accept: Record<string, string[]> }[]
    }) => Promise<SaveFileHandle>
  }
  return {
    pickSave: browser.showSaveFilePicker
      ? suggestedName => browser.showSaveFilePicker!({
        suggestedName,
        types: [{ description: 'Documento Angie Dashboard JSON', accept: { 'application/json': ['.json'] } }],
      })
      : undefined,
    download(text, filename) {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
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
