import type { GpxReadHandle } from '../../storage/gpxAccessRepository'
import { MAX_GPX_BYTES, parseGpx } from './gpx'

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
  if (file.size > MAX_GPX_BYTES) throw new Error('El archivo supera el límite de 10 MB.')
  const bytes = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const fingerprint = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('')
  if (expectedFingerprint && expectedFingerprint !== fingerprint) {
    throw new Error('El contenido no coincide con el GPX guardado. Selecciona su archivo original.')
  }
  return { fingerprint, data: parseGpx(new TextDecoder().decode(bytes)) }
}
