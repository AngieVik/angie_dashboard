import Dexie from 'dexie'
import type { Table } from 'dexie'

export interface WorkDirectoryHandle {
  readonly name: string
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  getDirectoryHandle?(name: string, options?: { create?: boolean }): Promise<WorkDirectoryHandle>
  isSameEntry?(other: WorkDirectoryHandle): Promise<boolean>
  getFileHandle?(name: string, options?: { create?: boolean }): Promise<{
    getFile(): Promise<{ text(): Promise<string> }>
    createWritable(): Promise<{ write(text: string): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }>
  }>
  removeEntry?(name: string): Promise<void>
}

interface WorkDirectoryAccessRecord { key: string; handle: WorkDirectoryHandle; accessId?: string; isContainer?: boolean; expectedHash?: string }
export interface WorkDirectoryAccess { handle: WorkDirectoryHandle; accessId: string; isContainer?: boolean }
let currentAccess: WorkDirectoryAccess | undefined

// Device access stays separate from portable documents and their recovery.
async function withAccessTable<T>(action: (table: Table<WorkDirectoryAccessRecord, string>) => Promise<T>): Promise<T> {
  const db = new Dexie('angie-dashboard-work-directory-access')
  db.version(1).stores({ handles: 'key' })
  try {
    await db.open()
    return await action(db.table<WorkDirectoryAccessRecord, string>('handles'))
  } finally { db.close() }
}

export async function readWorkDirectoryConfiguration(): Promise<WorkDirectoryAccess | null> {
  if (currentAccess) return currentAccess
  const record = await withAccessTable(table => table.get('work-directory'))
  if (!record) return null
  currentAccess = { handle: record.handle, accessId: record.accessId ?? 'initial-work-directory', isContainer: record.isContainer }
  return currentAccess
}

export async function rememberWorkDirectoryAccess(handle: WorkDirectoryHandle, isContainer?: boolean): Promise<void> {
  // Keep access usable in this opening even if IndexedDB cannot remember it.
  const previous = await readWorkDirectoryConfiguration().catch(() => null)
  // Renewing the same access must retain its write/conflict history.
  const container = isContainer ?? handle.name.toLowerCase() !== 'angie_dashboard'
  const previousContainer = previous ? previous.isContainer ?? previous.handle.name.toLowerCase() !== 'angie_dashboard' : null
  let sameEntry = previous && previousContainer === container &&
    (previous.handle === handle || await previous.handle.isSameEntry?.(handle).catch(() => false))
  if (!sameEntry && previous) {
    try {
      const previousRoot = previousContainer
        ? await previous.handle.getDirectoryHandle?.('angie_dashboard') : previous.handle
      const root = container ? await handle.getDirectoryHandle?.('angie_dashboard') : handle
      if (previousRoot && root) sameEntry = await previousRoot.isSameEntry?.(root).catch(() => false)
    } catch { /* A different or unavailable root starts an independent access. */ }
  }
  const access = { handle, accessId: sameEntry && previous ? previous.accessId : crypto.randomUUID(),
    isContainer: container }
  currentAccess = access
  await withAccessTable(table => table.put({ key: 'work-directory', ...access }))
}

export async function readWorkspaceBaseline(accessId: string, documentId: string): Promise<string | null> {
  return withAccessTable(async table => (await table.get(`baseline:${accessId}:${documentId}`))?.expectedHash ?? null)
}

export async function rememberWorkspaceBaseline(handle: WorkDirectoryHandle, accessId: string, documentId: string, expectedHash: string): Promise<void> {
  await withAccessTable(table => table.put({ key: `baseline:${accessId}:${documentId}`, handle, accessId, expectedHash }))
}
