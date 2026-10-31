import { CalendarRepository } from './calendarRepository'
import type { CalendarStorage } from './calendarRepository'
import { calendarDateKey, isCalendarDate, parseCalendarEvent } from './calendarEvents'
import type { CalendarEvent } from './calendarEvents'

export function createCalendarStore(repository: CalendarStorage) {
  let state = { events: [] as CalendarEvent[], selectedDate: calendarDateKey(new Date()), ready: false, busy: false, error: null as string | null }
  let initialization: Promise<void> | undefined
  let pendingReload = false
  let channel: BroadcastChannel | undefined
  const listeners = new Set<() => void>()
  function update(patch: Partial<typeof state>) { state = { ...state, ...patch }; listeners.forEach(listener => listener()) }
  function message(error: unknown) { return error instanceof Error ? error.message : 'No se pudo acceder a la agenda.' }
  async function reload() {
    if (state.busy) { pendingReload = true; return }
    update({ busy: true })
    try { update({ events: await repository.loadEvents(), ready: true, error: null }) }
    catch (error) { update({ ready: true, error: message(error) }) }
    finally {
      update({ busy: false })
      if (pendingReload) { pendingReload = false; void reload() }
    }
  }
  async function write(action: () => Promise<CalendarEvent[]>) {
    if (!state.ready || state.busy || state.error) return false
    update({ busy: true })
    try { update({ events: await action(), error: null }); channel?.postMessage('changed'); return true }
    catch (error) { update({ error: message(error) }); return false }
    finally {
      update({ busy: false })
      if (pendingReload) { pendingReload = false; void reload() }
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    selectDate(selectedDate: string) {
      if (!isCalendarDate(selectedDate)) return false
      if (selectedDate !== state.selectedDate) update({ selectedDate })
      return true
    },
    initialize() { initialization ??= reload(); return initialization },
    reload,
    save(event: CalendarEvent) { return write(async () => {
      const copy = parseCalendarEvent(event)
      await repository.saveEvent(copy)
      return [...state.events.filter(current => current.id !== copy.id), copy]
    }) },
    remove(id: string) { return write(async () => { await repository.deleteEvent(id); return state.events.filter(event => event.id !== id) }) },
    connect() {
      const connection = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('angie-calendar')
      channel = connection
      const refresh = () => { void reload() }
      if (connection) connection.onmessage = refresh
      window.addEventListener('focus', refresh)
      return () => { window.removeEventListener('focus', refresh); connection?.close(); if (channel === connection) channel = undefined }
    },
  }
}
export type CalendarStore = ReturnType<typeof createCalendarStore>
let browserCalendar: CalendarStore | undefined
export function getCalendarStore() { browserCalendar ??= createCalendarStore(new CalendarRepository()); return browserCalendar }
