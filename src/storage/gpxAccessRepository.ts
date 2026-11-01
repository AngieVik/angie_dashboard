import Dexie from 'dexie'
import type { Table } from 'dexie'
import { gpxResource } from './gpxResources'
import type { GpxResource } from './gpxResources'
import { createDatabase } from './db'

export interface GpxReadHandle {
  readonly name: string
  queryPermission(options: { mode: 'read' }): Promise<PermissionState>
  getFile(): Promise<File>
}

interface GpxAccessRecord { fingerprint: string; handle: GpxReadHandle }

// Separate from document recovery: only authorized handles, never GPX contents.
async function withAccessTable<T>(action: (table: Table<GpxAccessRecord, string>) => Promise<T>): Promise<T> {
  const db = new Dexie('angie-dashboard-gpx-access')
  db.version(1).stores({ handles: 'fingerprint' })
  try {
    await db.open()
    return await action(db.table<GpxAccessRecord, string>('handles'))
  } finally { db.close() }
}

export async function rememberGpxAccess(fingerprint: string, handle: GpxReadHandle): Promise<boolean> {
  try {
    await withAccessTable(table => table.put({ fingerprint, handle }))
    return true
  } catch { return false }
}

export async function readGpxAccess(fingerprint: string): Promise<File | null> {
  const original = gpxResource(fingerprint)?.blob
  if (original) return original instanceof File ? original : new File([original], 'recorrido.gpx', { type: 'application/gpx+xml' })
  const db = createDatabase()
  try {
    await db.open()
    const resource = await db.table<GpxResource, string>('gpxResources').get(fingerprint)
    if (resource) return new File([resource.blob], 'recorrido.gpx', { type: 'application/gpx+xml' })
  } catch { /* Try the existing authorized handle when local storage is unavailable. */ }
  finally { db.close() }
  try {
    const record = await withAccessTable(table => table.get(fingerprint))
    if (!record || await record.handle.queryPermission({ mode: 'read' }) !== 'granted') return null
    return await record.handle.getFile()
  } catch { return null }
}
