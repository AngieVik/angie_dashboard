export interface CalendarEvent {
  id: string
  title: string
  startDate: string
  endDate: string
  time: string | null
  color: string
}
export type CalendarEventInput = Omit<CalendarEvent, 'id'>

export function calendarDateKey(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T12:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function createCalendarEvent(input: CalendarEventInput, id: string = crypto.randomUUID()): CalendarEvent {
  const title = input.title.trim()
  if (!title || title.length > 120) throw new Error('Escribe un título de hasta 120 caracteres.')
  if (!isCalendarDate(input.startDate) || !isCalendarDate(input.endDate)) throw new Error('Selecciona fechas válidas.')
  if (input.endDate < input.startDate) throw new Error('La fecha final debe ser igual o posterior a la inicial.')
  if (input.time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error('La hora no es válida.')
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) throw new Error('El color no es válido.')
  return { id, title, startDate: input.startDate, endDate: input.endDate, time: input.time, color: input.color }
}

export function parseCalendarEvent(value: unknown): CalendarEvent {
  if (!value || typeof value !== 'object') throw new Error('Evento guardado inválido.')
  const item = value as Record<string, unknown>
  if (Object.keys(item).length !== 6 || !['id', 'title', 'startDate', 'endDate', 'time', 'color'].every(key => key in item)
    || typeof item.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(item.id)
    || typeof item.title !== 'string' || typeof item.color !== 'string' || typeof item.startDate !== 'string' || typeof item.endDate !== 'string'
    || item.time !== null && typeof item.time !== 'string') throw new Error('Evento guardado inválido.')
  return createCalendarEvent(item as unknown as CalendarEventInput, item.id)
}

export function eventsOnDate(events: readonly CalendarEvent[], date: string) {
  return events.filter(event => event.startDate <= date && event.endDate >= date)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'es') || a.id.localeCompare(b.id))
}
