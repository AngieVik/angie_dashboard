import type { FormatPreferences } from '../features/settings/formatPreferences'

const METERS_PER_MILE = 1609.344
const METERS_PER_FOOT = 0.3048
const formatters = new Map<string, Intl.DateTimeFormat>()

export function formatDateKey(key: string, format: FormatPreferences['date']) {
  const [year, month, day] = key.split('-')
  if (!year || !month || !day) return key
  return format === 'ymd' ? key : format === 'mdy' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`
}

export function formatClockTime(time: string, format: FormatPreferences['time']) {
  if (format === '24h') return time
  const [hour, ...rest] = time.split(':')
  return `${String(Number(hour) % 12 || 12).padStart(2, '0')}:${rest.join(':')} ${Number(hour) < 12 ? 'AM' : 'PM'}`
}

export function formatInstant(value: string | number | Date, preferences: FormatPreferences, options: { timeZone?: string; date?: boolean; time?: boolean; seconds?: boolean } = {}) {
  const { timeZone, date = true, time = true, seconds = true } = options
  const key = JSON.stringify([timeZone, preferences.time, date, time, seconds])
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone,
      ...(date ? { year: 'numeric', month: '2-digit', day: '2-digit' } as const : {}),
      ...(time ? { hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } as const : {}), hourCycle: preferences.time === '12h' ? 'h12' : 'h23' } as const : {}) })
    formatters.set(key, formatter)
  }
  // Preserve leap seconds accepted by the document schema but not by Date.
  const leapSecond = typeof value === 'string' && value.slice(17, 19) === '60'
  const instant = new Date(leapSecond ? `${value.slice(0, 17)}59${value.slice(19)}` : value)
  const parts = formatter.formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ''
  const dateText = date ? formatDateKey(`${part('year')}-${part('month')}-${part('day')}`, preferences.date) : ''
  const timeText = time ? `${part('hour')}:${part('minute')}${seconds ? `:${leapSecond ? '60' : part('second')}` : ''}${preferences.time === '12h' ? ` ${part('dayPeriod').toUpperCase()}` : ''}` : ''
  return [dateText, timeText].filter(Boolean).join(', ')
}

export function formatDistance(meters: number, units: FormatPreferences['units'], maximumFractionDigits = 3, minimumFractionDigits = 0) {
  const value = distanceInUnits(meters, units)
  return value.toLocaleString('es-ES', { minimumFractionDigits, maximumFractionDigits }) + (units === 'metric' ? ' km' : ' mi')
}

export function formatElevation(meters: number, units: FormatPreferences['units']) {
  const value = elevationInUnits(meters, units)
  return value.toLocaleString('es-ES', { maximumFractionDigits: 1 }) + (units === 'metric' ? ' m' : ' ft')
}

export const distanceInUnits = (meters: number, units: FormatPreferences['units']) => meters / (units === 'metric' ? 1000 : METERS_PER_MILE)
export const elevationInUnits = (meters: number, units: FormatPreferences['units']) => units === 'metric' ? meters : meters / METERS_PER_FOOT
