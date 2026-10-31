export interface DefaultLocation {
  name: string
  latitude: number
  longitude: number
  timeZone: string
}
export interface AppSettings { location: DefaultLocation | null }
export function emptySettings(): AppSettings { return { location: null } }

export function validateSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 1 || !('location' in value)) throw new Error('Configuración guardada inválida.')
  if (value.location === null) return emptySettings()
  const point = value.location
  if (!point || typeof point !== 'object' || Object.keys(point).length !== 4 || !('name' in point) || !('latitude' in point) || !('longitude' in point) || !('timeZone' in point)
    || typeof point.name !== 'string' || !point.name.trim() || point.name.trim().length > 160
    || typeof point.latitude !== 'number' || !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90
    || typeof point.longitude !== 'number' || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180
    || typeof point.timeZone !== 'string') throw new Error('La ubicación predeterminada no es válida.')
  try { new Intl.DateTimeFormat('es', { timeZone: point.timeZone }).format(new Date()) }
  catch { throw new Error('La zona horaria no es válida.') }
  return { location: { name: point.name.trim(), latitude: point.latitude, longitude: point.longitude, timeZone: point.timeZone } }
}
