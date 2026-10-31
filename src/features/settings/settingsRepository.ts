import Dexie from 'dexie'
import type { DexieOptions } from 'dexie'
import { emptySettings, validateSettings } from './appSettings'
import type { AppSettings } from './appSettings'

export interface SettingsSnapshot { settings: AppSettings; revision: number | null }
export interface SettingsStorage {
  load(): Promise<SettingsSnapshot>
  save(settings: AppSettings, expectedRevision: number | null): Promise<number>
}
interface SettingsRecord { key: string; settings: unknown; revision: number }
export class SettingsConflictError extends Error {
  constructor() { super('La configuración cambió en otra pestaña. Recárgala antes de guardar.'); this.name = 'SettingsConflictError' }
}
export function createSettingsDatabase(name = 'angie-dashboard-settings', options?: DexieOptions) {
  const db = new Dexie(name, options)
  db.version(1).stores({ settings: 'key' })
  return db
}
function recordRevision(record?: SettingsRecord): number | null {
  if (!record) return null
  if (!Number.isSafeInteger(record.revision) || record.revision < 1 || record.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Revisión de configuración inválida.')
  return record.revision
}
export class SettingsRepository implements SettingsStorage {
  constructor(private readonly db: Dexie = createSettingsDatabase()) {}
  async load() {
    if (!this.db.isOpen()) await this.db.open()
    const record = await this.db.table<SettingsRecord, string>('settings').get('active')
    return { settings: record ? validateSettings(record.settings) : emptySettings(), revision: recordRevision(record) }
  }
  async save(settings: AppSettings, expectedRevision: number | null) {
    const copy = validateSettings(settings)
    if (!this.db.isOpen()) await this.db.open()
    const table = this.db.table<SettingsRecord, string>('settings')
    return this.db.transaction('rw', table, async () => {
      const current = await table.get('active'), actual = recordRevision(current)
      if (actual !== expectedRevision) throw new SettingsConflictError()
      const revision = (actual ?? 0) + 1
      await table.put({ key: 'active', settings: copy, revision })
      return revision
    })
  }
}
