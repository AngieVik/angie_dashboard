import type { MapGpxReference } from '../../domain/document/types'
import { checkGpxPointTotal, INPUT_BUDGETS } from '../../domain/input/inputBudgets'
import type { GpxData, LoadedGpx } from './gpx'
import { gpxGeometryBytes as geometryBytes, GPX_GEOMETRY_BYTES as GEOMETRY_BYTES } from './gpxBudget'
import type { GpxAllowance } from './gpxBudget'

export type WithGpxFiles = <T>(references: readonly MapGpxReference[], run: (files: LoadedGpx[]) => Promise<T>) => Promise<T>

export class GpxGeometryCache {
  private admission?: Promise<void>
  private consumers = new Map<object, Set<string>>()
  private entries = new Map<string, { data: GpxData; bytes: number }>()
  private pending = new Map<string, { promise: Promise<GpxData | null>; controller: AbortController }>()
  private listeners = new Set<() => void>()
  private revision = 0
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  snapshot = () => this.revision
  private changed() { this.revision++; for (const listener of this.listeners) listener() }
  private prune() {
    const needed = new Set([...this.consumers.values()].flatMap(items => [...items]))
    for (const [fingerprint, task] of this.pending) if (!needed.has(fingerprint)) {
      this.pending.delete(fingerprint); task.controller.abort()
    }
    let changed = false
    for (const fingerprint of this.entries.keys()) if (!needed.has(fingerprint)) { this.entries.delete(fingerprint); changed = true }
    if (changed) this.changed()
  }
  setNeeds(consumer: object, references: readonly Pick<MapGpxReference, 'fingerprint'>[]) {
    this.consumers.set(consumer, new Set(references.map(reference => reference.fingerprint)))
    this.prune()
  }
  release(consumer: object) { this.consumers.delete(consumer); this.prune() }
  cancelPending() {
    for (const task of this.pending.values()) task.controller.abort()
    this.pending.clear()
  }
  dispose() { this.cancelPending(); this.consumers.clear(); this.prune() }
  get(fingerprint: string) { return this.entries.get(fingerprint)?.data }
  hasConsumer(consumer: object) { return this.consumers.has(consumer) }
  // Imports and cold reads share this queue, across every mounted consumer.
  // The callback publishes before releasing its slot, so the next worker sees
  // the remaining aggregate allowance, never the previous file's full budget.
  async withAdmission<T>(run: (allowance: GpxAllowance) => Promise<T>): Promise<T> {
    const previous = this.admission
    let release!: () => void
    const slot = new Promise<void>(resolve => { release = resolve })
    this.admission = slot
    try {
      if (previous) await previous
      const memory = this.memory()
      return await run({ points: INPUT_BUDGETS.totalGpxPoints - memory.points, bytes: GEOMETRY_BYTES - memory.bytes,
        files: INPUT_BUDGETS.gpxFiles - memory.files,
        known: [...this.entries].map(([fingerprint, entry]) => ({ fingerprint, points: entry.data.pointCount, bytes: entry.bytes })) })
    } finally { release(); if (this.admission === slot) this.admission = undefined }
  }
  check(files: readonly Pick<LoadedGpx, 'fingerprint' | 'data'>[]) {
    const next = new Map(this.entries)
    for (const file of files) if (!next.has(file.fingerprint)) next.set(file.fingerprint, { data: file.data, bytes: geometryBytes(file.data) })
    checkGpxPointTotal([...next].map(([fingerprint, item]) => ({ fingerprint, data: item.data })))
    if (next.size > INPUT_BUDGETS.gpxFiles || [...next.values()].reduce((sum, item) => sum + item.bytes, 0) > GEOMETRY_BYTES) {
      throw new Error('Se ha alcanzado el presupuesto de geometrías GPX en memoria.')
    }
  }
  publish(consumer: object, files: readonly Pick<LoadedGpx, 'fingerprint' | 'data'>[]) {
    const needs = this.consumers.get(consumer)
    if (!needs) return
    const additions = new Map<string, { data: GpxData; bytes: number }>()
    for (const file of files) if (needs.has(file.fingerprint) && !this.entries.has(file.fingerprint)) additions.set(file.fingerprint, { data: file.data, bytes: geometryBytes(file.data) })
    if (!additions.size) return
    this.check([...additions].map(([fingerprint, item]) => ({ fingerprint, data: item.data })))
    this.entries = new Map([...this.entries, ...additions])
    this.changed()
  }
  async load(consumer: object, reference: MapGpxReference, read: (signal: AbortSignal, allowance: GpxAllowance) => Promise<GpxData | null>) {
    if (!this.consumers.get(consumer)?.has(reference.fingerprint)) return null
    const existing = this.get(reference.fingerprint)
    if (existing) return existing
    let pending = this.pending.get(reference.fingerprint)
    if (!pending) {
      const controller = new AbortController()
      pending = { controller, promise: this.withAdmission(async allowance => {
        if (controller.signal.aborted) return null
        const data = await read(controller.signal, allowance)
        if (data && !controller.signal.aborted) for (const [owner, needs] of this.consumers) {
          if (needs.has(reference.fingerprint)) { this.publish(owner, [{ fingerprint: reference.fingerprint, data }]); break }
        }
        return controller.signal.aborted ? null : data
      }) }
      this.pending.set(reference.fingerprint, pending)
    }
    try {
      const data = await pending.promise
      if (pending.controller.signal.aborted) return null
      if (data) this.publish(consumer, [{ fingerprint: reference.fingerprint, data }])
      return this.consumers.get(consumer)?.has(reference.fingerprint) ? this.get(reference.fingerprint) ?? null : null
    } finally { if (this.pending.get(reference.fingerprint) === pending) this.pending.delete(reference.fingerprint) }
  }
  async withFiles<T>(references: readonly MapGpxReference[], read: (reference: MapGpxReference, signal: AbortSignal, allowance: GpxAllowance) => Promise<GpxData | null>, run: (files: LoadedGpx[]) => Promise<T>) {
    const consumer = {}
    this.setNeeds(consumer, references)
    try {
      const files: LoadedGpx[] = []
      for (const reference of references) {
        try { const data = await this.load(consumer, reference, (signal, allowance) => read(reference, signal, allowance)); if (data) files.push({ ...reference, data }) }
        catch { /* Keep missing or over-budget resources explicit in the report. */ }
      }
      return await run(files)
    } finally { this.release(consumer) }
  }
  memory() {
    return { files: this.entries.size, points: [...this.entries.values()].reduce((sum, item) => sum + item.data.pointCount, 0),
      bytes: [...this.entries.values()].reduce((sum, item) => sum + item.bytes, 0), consumers: this.consumers.size }
  }
}
