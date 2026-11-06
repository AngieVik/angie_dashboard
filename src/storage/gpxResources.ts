import { INPUT_BUDGETS } from '../domain/input/inputBudgets'

export interface GpxResource { fingerprint: string; blob: Blob }
// Session resources are independent of UIBoard files and local recovery.
const originals = new Map<string, GpxResource>()

export function retainGpx(resource: GpxResource) {
  if (originals.has(resource.fingerprint)) return
  if (originals.size >= INPUT_BUDGETS.gpxFiles || [...originals.values()].reduce((sum, item) => sum + item.blob.size, 0) + resource.blob.size > INPUT_BUDGETS.totalGpxBytes) {
    throw new Error('Se ha alcanzado el límite de GPX de esta sesión. Retira un recorrido antes de importar más.')
  }
  originals.set(resource.fingerprint, resource)
}

export function releaseGpxOriginals(fingerprints: Iterable<string>) {
  for (const fingerprint of fingerprints) originals.delete(fingerprint)
}

export function gpxResource(fingerprint: string) {
  const resource = originals.get(fingerprint)
  return resource ? { fingerprint: resource.fingerprint, blob: resource.blob } : undefined
}
