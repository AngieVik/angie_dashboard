import Dexie from 'dexie'
import type { DexieOptions } from 'dexie'
import { parseCalendarEvent } from './calendarEvents'
import type { CalendarEvent } from './calendarEvents'

export interface CalendarStorage {
  loadEvents(): Promise<CalendarEvent[]>
  saveEvent(event: CalendarEvent): Promise<void>
  deleteEvent(id: string): Promise<void>
}
interface EventRecord { id: string; event: unknown; revision: number }
export class CalendarConflictError extends Error {
  constructor() { super('Este evento cambió en otra pestaña. Recarga la agenda antes de continuar.'); this.name = 'CalendarConflictError' }
}
export function createCalendarDatabase(name = 'angie-dashboard-calendar', options?: DexieOptions) {
  const db = new Dexie(name, options)
  db.version(1).stores({ events: 'id' })
  return db
}
function revision(record?: EventRecord): number | null {
  if (!record) return null
  if (!Number.isSafeInteger(record.revision) || record.revision < 1 || record.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Revisión de evento inválida.')
  return record.revision
}

export class CalendarRepository implements CalendarStorage {
  private revisions = new Map<string, number | null>()
  constructor(private readonly db: Dexie = createCalendarDatabase()) {}
  async loadEvents() {
    if (!this.db.isOpen()) await this.db.open()
    const records = await this.db.table<EventRecord, string>('events').toArray()
    const events = records.map(record => {
      const event = parseCalendarEvent(record.event)
      if (event.id !== record.id) throw new Error('Identificador de evento inválido.')
      revision(record)
      return event
    })
    this.revisions = new Map(records.map(record => [record.id, revision(record)]))
    return events
  }
  async saveEvent(event: CalendarEvent) {
    const copy = parseCalendarEvent(event), expected = this.revisions.get(event.id) ?? null
    if (!this.db.isOpen()) await this.db.open()
    const table = this.db.table<EventRecord, string>('events')
    const next = await this.db.transaction('rw', table, async () => {
      const current = await table.get(copy.id), actual = revision(current)
      if (expected !== actual) throw new CalendarConflictError()
      const nextRevision = (actual ?? 0) + 1
      await table.put({ id: copy.id, event: copy, revision: nextRevision })
      return nextRevision
    })
    this.revisions.set(copy.id, next)
  }
  async deleteEvent(id: string) {
    const expected = this.revisions.get(id) ?? null
    if (!this.db.isOpen()) await this.db.open()
    const table = this.db.table<EventRecord, string>('events')
    await this.db.transaction('rw', table, async () => {
      if (revision(await table.get(id)) !== expected) throw new CalendarConflictError()
      await table.delete(id)
    })
    this.revisions.delete(id)
  }
}
