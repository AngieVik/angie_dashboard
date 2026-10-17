import Dexie from 'dexie'
import type { DexieOptions } from 'dexie'
import type { TimerRecord } from './timerTypes'
import { MAX_TIMER_SECONDS } from './timerEngine'

export interface InternalTimerRepository {
  loadTimers(): Promise<TimerRecord[]>
  saveTimers(timers: TimerRecord[]): Promise<void>
}
interface LocalTimerRecord { key: string; timers: unknown; revision?: number }
export class TimerConflictError extends Error {
  constructor() { super('Los temporizadores cambiaron en otra pestaña. Recarga la lista guardada antes de continuar.'); this.name = 'TimerConflictError' }
}
function recordRevision(record: LocalTimerRecord | undefined): number | null {
  if (!record) return null
  const revision = record.revision ?? 0
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) throw new Error('Revisión interna de temporizadores inválida')
  return revision
}
export function createTimerDatabase(name = 'angie-dashboard-timers', options?: DexieOptions) {
  const db = new Dexie(name, options)
  db.version(1).stores({ timers: 'key' })
  return db
}
export class TimerRepository implements InternalTimerRepository {
  private expectedRevision: number | null = null
  constructor(private readonly db: Dexie = createTimerDatabase()) {}
  async loadTimers(): Promise<TimerRecord[]> {
    if (!this.db.isOpen()) await this.db.open()
    const record = await this.db.table<LocalTimerRecord, string>('timers').get('active')
    const timers = record ? validateTimers(record.timers) : []
    this.expectedRevision = recordRevision(record)
    return timers
  }
  async saveTimers(timers: TimerRecord[]): Promise<void> {
    const copy = structuredClone(validateTimers(timers))
    if (!this.db.isOpen()) await this.db.open()
    const table = this.db.table<LocalTimerRecord, string>('timers')
    let nextRevision = 0
    await this.db.transaction('rw', table, async () => {
      const current = await table.get('active')
      const actual = recordRevision(current)
      if (this.expectedRevision !== actual) throw new TimerConflictError()
      nextRevision = (actual ?? 0) + 1
      await table.put({ key: 'active', timers: copy, revision: nextRevision })
    })
    this.expectedRevision = nextRevision
  }
}

function validateTimers(value: unknown): TimerRecord[] {
  const invalid = () => { throw new Error('Datos internos de temporizadores inválidos') }
  if (!Array.isArray(value)) return invalid()
  const ids = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') return invalid()
    const allowed = ['id', 'kind', 'note', 'status', 'elapsedMs', 'startedAt', 'alertActive', ...(item.kind === 'tzero' ? [] : ['durationSeconds'])]
    if (Object.keys(item).length !== allowed.length || Object.keys(item).some(key => !allowed.includes(key))) return invalid()
    if (typeof item.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(item.id) || ids.has(item.id)) return invalid()
    ids.add(item.id)
    if (!['tzero', 'tminus', 'advisory'].includes(item.kind) || !['idle', 'running', 'paused', 'completed'].includes(item.status)) return invalid()
    if (typeof item.note !== 'string' || typeof item.alertActive !== 'boolean' || !Number.isFinite(item.elapsedMs) || item.elapsedMs < 0) return invalid()
    if (item.status === 'running' ? !Number.isFinite(item.startedAt) : item.startedAt !== null) return invalid()
    const limit = item.kind === 'tzero' ? MAX_TIMER_SECONDS : item.durationSeconds
    if (!Number.isInteger(limit) || limit < 0 || limit > MAX_TIMER_SECONDS || item.elapsedMs > limit * 1000) return invalid()
    if (limit === 0 && item.status !== 'idle') return invalid()
    if (item.alertActive && item.status !== 'completed') return invalid()
    if (item.kind === 'tzero' && (item.status === 'completed' || item.alertActive)) return invalid()
    if (item.status === 'completed' && item.elapsedMs !== limit * 1000) return invalid()
    if (item.status === 'idle' && item.elapsedMs !== 0) return invalid()
  }
  return value as TimerRecord[]
}
