import { useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { MapGpxReference } from '../../domain/document/types'
import type { DocumentStore } from '../document/documentStore'
import type { LoadedGpx } from './gpx'
import { GpxGeometryCache } from './gpxGeometryCache'
import { readGpxFile } from './gpxFileAccess'
import type { GpxAllowance } from './gpxBudget'

const caches = new WeakMap<DocumentStore, { generation: number; cache: GpxGeometryCache; unsubscribe: () => void }>()
function cacheFor(store: DocumentStore, generation: number) {
  let current = caches.get(store)
  if (current?.generation !== generation) {
    current?.unsubscribe(); current?.cache.dispose()
    const cache = new GpxGeometryCache()
    const unsubscribe = store.subscribe(() => {
      const snapshot = store.getSnapshot()
      if (snapshot.documentGeneration !== generation) cache.dispose()
      else if (snapshot.replacing || !snapshot.active) cache.cancelPending()
    })
    current = { generation, cache, unsubscribe }; caches.set(store, current)
  }
  return current.cache
}

export function gpxGeometryMemory(store: DocumentStore) {
  return caches.get(store)?.cache.memory() ?? { files: 0, points: 0, bytes: 0, consumers: 0 }
}

export function useGpxFiles(store: DocumentStore, generation: number, references: readonly MapGpxReference[]) {
  const cache = cacheFor(store, generation)
  const [consumer] = useState(() => ({}))
  const revision = useSyncExternalStore(cache.subscribe, cache.snapshot)
  useLayoutEffect(() => { cache.setNeeds(consumer, references) }, [cache, consumer, references])
  useLayoutEffect(() => () => cache.release(consumer), [cache, consumer])
  const files = useMemo(() => {
    void revision
    return references.flatMap(reference => { const data = cache.get(reference.fingerprint); return data ? [{ ...reference, data }] : [] })
  }, [cache, references, revision])
  const onFilesChange = useCallback((loaded: LoadedGpx[]) => {
    if (store.getSnapshot().documentGeneration !== generation || store.getSnapshot().replacing || !cache.hasConsumer(consumer)) return
    // Import can publish before React commits the newly added document references.
    const live = store.getSnapshot().document.map?.gpx ?? []
    const needed = live.filter(reference => references.some(item => item.id === reference.id) || loaded.some(item => item.id === reference.id))
    cache.setNeeds(consumer, needed)
    cache.publish(consumer, loaded)
  }, [cache, consumer, generation, references, store])
  const readGeometry = useCallback(async (reference: MapGpxReference, signal: AbortSignal, allowance: GpxAllowance) => {
    if (signal.aborted || store.getSnapshot().documentGeneration !== generation || store.getSnapshot().replacing) return null
    const file = await store.readGpx(reference)
    if (signal.aborted || store.getSnapshot().documentGeneration !== generation || store.getSnapshot().replacing) return null
    const result = file ? (await readGpxFile(file, reference.fingerprint, false, { documentGeneration: generation, signal, allowance, getCached: fingerprint => cache.get(fingerprint) })).data : null
    return signal.aborted || store.getSnapshot().documentGeneration !== generation || store.getSnapshot().replacing ? null : result
  }, [cache, generation, store])
  const loadGpx = useCallback((reference: MapGpxReference) => cache.load(consumer, reference, (signal, allowance) => readGeometry(reference, signal, allowance)), [cache, consumer, readGeometry])
  const withGpxFiles = useCallback(<T,>(needed: readonly MapGpxReference[], run: (files: LoadedGpx[]) => Promise<T>) => cache.withFiles(needed, readGeometry, run), [cache, readGeometry])
  const admitGpx = useCallback((loaded: Pick<LoadedGpx, 'fingerprint' | 'data'>[]) => cache.check(loaded), [cache])
  const withGpxAdmission = useCallback(<T,>(run: (allowance: GpxAllowance) => Promise<T>) => cache.withAdmission(run), [cache])
  const getGpxGeometry = useCallback((fingerprint: string) => cache.get(fingerprint), [cache])
  return { files, onFilesChange, loadGpx, admitGpx, withGpxFiles, withGpxAdmission, getGpxGeometry }
}
