import { checkFileBytes, INPUT_BUDGETS } from '../domain/input/inputBudgets'

export interface GpxResource { fingerprint: string; blob: Blob }
// This cache contains originals, never reconstructed geometry. Durability is confirmed by the repository.
const originals = new Map<string, GpxResource & { committed: boolean }>()

export async function registerGpx(blob: Blob, expectedFingerprint?: string, retain = true) {
  checkFileBytes(blob.size, 'gpx')
  const bytes = await blob.arrayBuffer()
  checkFileBytes(bytes.byteLength, 'gpx')
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const fingerprint = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('')
  if (expectedFingerprint !== undefined && fingerprint !== expectedFingerprint) {
    throw new Error('El contenido no coincide con el GPX guardado. Selecciona su archivo original.')
  }
  if (retain) retainGpx({ fingerprint, blob })
  return { fingerprint, bytes }
}

// Only uncommitted originals are pinned. A failed transaction must leave them available for retry.
export function retainGpx(resource: GpxResource) {
  if (originals.has(resource.fingerprint)) return
  const pending = [...originals.values()].filter(item => !item.committed)
  if (pending.length >= INPUT_BUDGETS.gpxFiles || pending.reduce((sum, item) => sum + item.blob.size, 0) + resource.blob.size > INPUT_BUDGETS.totalGpxBytes) {
    throw new Error('Se ha alcanzado el presupuesto de GPX pendientes de guardar. Guarda o retira los anteriores antes de importar más.')
  }
  let bytes = [...originals.values()].reduce((sum, item) => sum + item.blob.size, 0)
  for (const [fingerprint, item] of originals) {
    if (originals.size < INPUT_BUDGETS.gpxFiles && bytes + resource.blob.size <= INPUT_BUDGETS.totalGpxBytes) break
    if (item.committed) { originals.delete(fingerprint); bytes -= item.blob.size }
  }
  originals.set(resource.fingerprint, { ...resource, committed: false })
}

export function commitGpxOriginals(fingerprints: Iterable<string>) {
  for (const fingerprint of fingerprints) { const resource = originals.get(fingerprint); if (resource) resource.committed = true }
}

export function releaseGpxOriginals(fingerprints: Iterable<string>) {
  for (const fingerprint of fingerprints) originals.delete(fingerprint)
}

export function gpxOriginalMemory() {
  return { files: originals.size, bytes: [...originals.values()].reduce((sum, item) => sum + item.blob.size, 0) }
}

export function gpxResource(fingerprint: string) {
  const resource = originals.get(fingerprint)
  if (resource) { originals.delete(fingerprint); originals.set(fingerprint, resource) }
  return resource ? { fingerprint: resource.fingerprint, blob: resource.blob } : undefined
}

