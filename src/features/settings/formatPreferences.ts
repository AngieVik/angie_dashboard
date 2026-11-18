export const DATE_FORMATS = ['dmy', 'mdy', 'ymd'] as const
export const TIME_FORMATS = ['24h', '12h'] as const
export const UNIT_SYSTEMS = ['metric', 'imperial'] as const
export interface FormatPreferences {
  date: typeof DATE_FORMATS[number]
  time: typeof TIME_FORMATS[number]
  units: typeof UNIT_SYSTEMS[number]
}
export function defaultFormatPreferences(): FormatPreferences { return { date: 'dmy', time: '24h', units: 'metric' } }
export function validateFormatPreferences(value: unknown): FormatPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 3
    || !('date' in value) || !('time' in value) || !('units' in value)
    || !DATE_FORMATS.some(format => format === value.date) || !TIME_FORMATS.some(format => format === value.time)
    || !UNIT_SYSTEMS.some(units => units === value.units)) throw new Error('La configuración de formatos no es válida.')
  return { date: value.date, time: value.time, units: value.units } as FormatPreferences
}
