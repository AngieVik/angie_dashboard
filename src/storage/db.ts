import Dexie from 'dexie'
import type { DexieOptions } from 'dexie'

export function createDatabase(name = 'angie-dashboard', options?: DexieOptions): Dexie {
  const db = new Dexie(name, options)
  db.version(1).stores({ documents: 'key' })
  return db
}
