export const DEFAULT_TIME_ZONE = 'Europe/Madrid'

export function isSupportedTimeZone(value: string) {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true }
  catch { return false }
}

let options: readonly { value: string; label: string }[] | undefined
export function timeZoneOptions(current?: string) {
  if (!options) {
    const common = [
      { value: DEFAULT_TIME_ZONE, label: 'Península y Baleares (Europe/Madrid)' },
      { value: 'Atlantic/Canary', label: 'Canarias (Atlantic/Canary)' },
      { value: 'UTC', label: 'UTC' },
    ]
    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [Intl.DateTimeFormat().resolvedOptions().timeZone]
    const known = new Set(common.map(zone => zone.value))
    options = [...common, ...zones.filter(value => !known.has(value)).map(value => ({ value, label: value.replaceAll('_', ' ') }))]
  }
  return current && !options.some(option => option.value === current)
    ? [...options, { value: current, label: current.replaceAll('_', ' ') }] : options
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>()
export function utcOffsetLabel(instant: Date | number, timeZone: string) {
  let formatter = offsetFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'longOffset' })
    offsetFormatters.set(timeZone, formatter)
  }
  const name = formatter.formatToParts(instant).find(part => part.type === 'timeZoneName')?.value
  return name === 'GMT' ? 'UTC+00:00' : name?.replace('GMT', 'UTC').replace('-', '−') ?? timeZone
}

export function timeZoneCity(timeZone: string) {
  return timeZone === 'Atlantic/Canary' ? 'Canarias' : timeZone.split('/').at(-1)?.replaceAll('_', ' ') ?? timeZone
}
