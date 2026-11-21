import Dexie from 'dexie'
import type { DexieOptions } from 'dexie'
import type { TimerRecord } from './timerTypes'
import { MAX_TIMER_SECONDS } from './timerEngine'
import { checkDocumentBudget, checkTextBytes } from '../../domain/input/inputBudgets'

export interface InternalTimerRepository {
  withLock<T>(operation: () => Promise<T>): Promise<T>
  loadTimers(): Promise<TimerRecord[]>
  saveTimers(timers: TimerRecord[]): Promise<void>
  exportRecoveryRecord(): Promise<string>
  resetCorruptTimers(timers: TimerRecord[]): Promise<void>
}
type TimerRevision = number | string
interface LocalTimerRecord { key: string; timers: unknown; revision?: TimerRevision }
interface RescuedTimerRecord { key: string; savedAt: string; record: LocalTimerRecord }
const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
export class TimerCorruptionError extends Error {
  constructor() { super('El registro guardado de temporizadores está dañado.'); this.name = 'TimerCorruptionError' }
}
export class TimerConflictError extends Error {
  constructor() { super('Los temporizadores cambiaron en otra pestaña. Recarga la lista guardada antes de continuar.'); this.name = 'TimerConflictError' }
}
function recordRevision(record: LocalTimerRecord | undefined): TimerRevision | null {
  if (!record) return null
  const revision = record.revision === undefined ? 0 : record.revision
  if (typeof revision === 'string') {
    if (!UUID_PATTERN.test(revision)) throw new TimerCorruptionError()
  } else if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) throw new TimerCorruptionError()
  return revision
}
function readRecord(record: LocalTimerRecord | undefined) {
  try { return { timers: record ? validateTimers(record.timers) : [], revision: recordRevision(record) } }
  catch { throw new TimerCorruptionError() }
}
function createTimerDatabase(name = 'angie-dashboard-timers', options?: DexieOptions) {
  const db = new Dexie(name, options)
  db.version(1).stores({ timers: 'key' })
  return db
}
export class TimerRepository implements InternalTimerRepository {
  private expectedRevision: TimerRevision | null = null
  constructor(private readonly db: Dexie = createTimerDatabase()) {}
  // The store holds this short lock across read, commit and audio initiation.
  // Do not fall back to uncoordinated execution: a revision check alone cannot
  // protect the interval between committing a timer and starting its alarm.
  withLock<T>(operation: () => Promise<T>): Promise<T> {
    if (typeof navigator === 'undefined' || !navigator.locks) return Promise.reject(new Error('Coordinación de temporizadores no disponible'))
    return navigator.locks.request(`${this.db.name}:execution`, operation)
  }
  async loadTimers(): Promise<TimerRecord[]> {
    if (!this.db.isOpen()) await this.db.open()
    const record = await this.db.table<LocalTimerRecord, string>('timers').get('active')
    const { timers, revision } = readRecord(record)
    this.expectedRevision = revision
    return timers
  }
  async saveTimers(timers: TimerRecord[]): Promise<void> {
    const copy = structuredClone(validateTimers(timers))
    if (!this.db.isOpen()) await this.db.open()
    const table = this.db.table<LocalTimerRecord, string>('timers')
    const nextRevision = crypto.randomUUID()
    await this.db.transaction('rw', table, async () => {
      const current = await table.get('active')
      const actual = readRecord(current).revision
      if (this.expectedRevision !== actual) throw new TimerConflictError()
      await table.put({ key: 'active', timers: copy, revision: nextRevision })
    })
    this.expectedRevision = nextRevision
  }
  async exportRecoveryRecord(): Promise<string> {
    const record = await this.db.table<LocalTimerRecord, string>('timers').get('active')
    if (!record) throw new Error('El registro de temporizadores ya no está disponible. Reintenta la carga.')
    const issue = checkDocumentBudget(record)
    if (issue) throw new Error('El registro no se puede descargar como JSON dentro de los límites de entrada. El rescate local sigue disponible al restablecer.')
    const text = JSON.stringify(record)
    checkTextBytes(text, 'json')
    return text
  }
  async resetCorruptTimers(timers: TimerRecord[]): Promise<void> {
    const copy = structuredClone(validateTimers(timers))
    const table = this.db.table<LocalTimerRecord, string>('timers')
    const revision = crypto.randomUUID()
    await this.db.transaction('rw', table, async () => {
      const record = await table.get('active')
      let corrupt = false
      try { readRecord(record) } catch (error) {
        if (!(error instanceof TimerCorruptionError)) throw error
        corrupt = true
      }
      // A different tab may have repaired/replaced the record since the notice.
      if (!record || !corrupt) throw new TimerConflictError()
      await this.db.table<RescuedTimerRecord, string>('timers').add({
        key: `rescued:${crypto.randomUUID()}`, savedAt: new Date().toISOString(), record,
      })
      // Fresh tokens avoid reusing a revision held by another tab before reset.
      await table.put({ key: 'active', timers: copy, revision })
    })
    this.expectedRevision = revision
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
