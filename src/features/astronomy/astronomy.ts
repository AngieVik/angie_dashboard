import { TZDate } from '@date-fns/tz'
import { getMoonIllumination, getTimes } from 'suncalc'
import { isCalendarDate } from '../calendar/calendarEvents'
import type { GeographicCoordinate } from '../coordinates/coordinateTypes'

export const SOLAR_EVENTS = ['sunrise', 'sunset', 'dawn', 'dusk', 'nauticalDawn', 'nauticalDusk', 'nightEnd', 'night'] as const
export type SolarEvent = typeof SOLAR_EVENTS[number]

export function zonedDateKey(instant: Date | number, timeZone: string): string {
  const date = new TZDate(Number(instant), timeZone)
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function zonedNoon(day: string, timeZone: string) {
  if (!isCalendarDate(day)) throw new Error('Fecha no válida.')
  const year = Number(day.slice(0, 4)), month = Number(day.slice(5, 7)), date = Number(day.slice(8, 10))
  const result = new TZDate(0, timeZone)
  result.setFullYear(year, month - 1, date)
  result.setHours(12, 0, 0, 0)
  return result
}

export function solarDay(day: string, point: GeographicCoordinate, timeZone: string) {
  const middle = zonedNoon(day, timeZone)
  const start = new TZDate(Number(middle), timeZone), end = new TZDate(Number(middle), timeZone)
  start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999)
  const offsets = new Set([start, middle, end].map(date => -date.getTimezoneOffset()))
  // Choose the solar cycle whose noon belongs to the selected civil date, including DST.
  // Its twilight can cross midnight; keep it attached to the same sunrise/sunset.
  const candidates = [...offsets].flatMap(offset => [-1, 0, 1].map(delta => getTimes(new Date(Number(middle) + delta * 86_400_000), point.latitude, point.longitude, 0, offset)))
  const cycle = candidates.filter(times => zonedDateKey(times.solarNoon, timeZone) === day)
    .sort((a, b) => Math.abs(Number(a.solarNoon) - Number(middle)) - Math.abs(Number(b.solarNoon) - Number(middle)))[0]
    ?? getTimes(middle, point.latitude, point.longitude, 0, -middle.getTimezoneOffset())
  const events = Object.fromEntries(SOLAR_EVENTS.map(name => [name, cycle[name] && Number.isFinite(Number(cycle[name])) ? cycle[name] : null])) as Record<SolarEvent, Date | null>
  return { events, alwaysUp: Boolean(cycle.alwaysUp), alwaysDown: Boolean(cycle.alwaysDown) }
}

const moonNames = ['Luna nueva', 'Creciente', 'Cuarto creciente', 'Gibosa creciente', 'Luna llena', 'Gibosa menguante', 'Cuarto menguante', 'Menguante'] as const
export function moonPhase(day: string, timeZone: string) {
  const illumination = getMoonIllumination(zonedNoon(day, timeZone))
  return { ...illumination, name: moonNames[Math.round(illumination.phase * 8) % 8] }
}

export function formatSolarTime(date: Date | null, timeZone: string, day?: string) {
  if (!date) return '—'
  const time = new Intl.DateTimeFormat('es-ES', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
  const offset = day ? Math.round((Date.parse(zonedDateKey(date, timeZone)) - Date.parse(day)) / 86_400_000) : 0
  return time + (offset ? ` (${offset > 0 ? '+' : ''}${offset})` : '')
}
