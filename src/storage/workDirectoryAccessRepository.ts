import Dexie from 'dexie'
import type { Table } from 'dexie'

export interface WorkDirectoryHandle {
  readonly name: string
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
}

interface WorkDirectoryAccessRecord { key: string; handle: WorkDirectoryHandle; accessId?: string }
export interface WorkDirectoryAccess { handle: WorkDirectoryHandle; accessId: string }
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

export async function readWorkDirectoryAccess(): Promise<WorkDirectoryHandle | null> {
  return (await readWorkDirectoryConfiguration())?.handle ?? null
}

export async function readWorkDirectoryConfiguration(): Promise<WorkDirectoryAccess | null> {
  if (currentAccess) return currentAccess
  const record = await withAccessTable(table => table.get('work-directory'))
  return record ? { handle: record.handle, accessId: record.accessId ?? 'initial-work-directory' } : null
}

export async function rememberWorkDirectoryAccess(handle: WorkDirectoryHandle): Promise<void> {
  // Keep access usable in this opening even if IndexedDB cannot remember it.
  const access = { handle, accessId: crypto.randomUUID() }
  currentAccess = access
  await withAccessTable(table => table.put({ key: 'work-directory', ...access }))
}
