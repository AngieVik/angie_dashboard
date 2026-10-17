export interface WeatherPoint { latitude: number; longitude: number }
export interface CurrentWeather {
  temperature: number | null
  apparentTemperature: number | null
  rain: number | null
  humidity: number | null
  windSpeed: number | null
  windDirection: number | null
  validAt: string
  retrievedAt: string
  interval: number
  timeZone: string
  grid: WeatherPoint
}

const cache = new Map<string, { time: number; data: CurrentWeather }>()
export function weatherPointKey(point: WeatherPoint) { return `${point.latitude},${point.longitude}` }
function validPoint(value: unknown): value is WeatherPoint {
  if (!value || typeof value !== 'object' || !('latitude' in value) || !('longitude' in value)) return false
  return typeof value.latitude === 'number' && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 &&
    typeof value.longitude === 'number' && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180
}
export function readWeatherPoint(documentId: string): WeatherPoint | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('angie.openMeteo.' + documentId) ?? 'null')
    return validPoint(value) ? { latitude: value.latitude, longitude: value.longitude } : null
  } catch { return null }
}
export function writeWeatherPoint(documentId: string, point: WeatherPoint) {
  try { localStorage.setItem('angie.openMeteo.' + documentId, JSON.stringify(point)) }
  catch { /* The selected point remains usable without local storage. */ }
}
export function clearWeatherPoint(documentId: string) {
  try { localStorage.removeItem('angie.openMeteo.' + documentId) }
  catch { /* Local storage availability does not block module cleanup. */ }
}

function record(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null }
function parseWeather(value: unknown): CurrentWeather {
  const body = record(value), current = record(body?.current), units = record(body?.current_units)
  if (!body || !current || !units || !validPoint(body) || typeof current.time !== 'number' || !Number.isFinite(current.time) ||
    typeof current.interval !== 'number' || !Number.isInteger(current.interval) || current.interval <= 0 || typeof body.timezone !== 'string') {
    throw new Error('Open-Meteo ha devuelto datos incompletos.')
  }
  const read = (key: string, unit: string): number | null => {
    const number = current[key]
    if (number === null) return null
    if (typeof number !== 'number' || !Number.isFinite(number) || units[key] !== unit) throw new Error('Open-Meteo ha cambiado el formato o las unidades de los datos.')
    return number
  }
  const temperature = read('temperature_2m', '°C'), apparentTemperature = read('apparent_temperature', '°C')
  const rain = read('rain', 'mm'), showers = read('showers', 'mm'), humidity = read('relative_humidity_2m', '%')
  const windSpeed = read('wind_speed_10m', 'km/h'), windDirection = read('wind_direction_10m', '°')
  if ((rain !== null && rain < 0) || (showers !== null && showers < 0) || (humidity !== null && (humidity < 0 || humidity > 100)) ||
    (windSpeed !== null && windSpeed < 0) || (windDirection !== null && (windDirection < 0 || windDirection > 360))) throw new Error('Open-Meteo ha devuelto valores fuera de rango.')
  return { temperature, apparentTemperature, rain: rain === null || showers === null ? null : rain + showers, humidity, windSpeed, windDirection,
    validAt: new Date(current.time * 1000).toISOString(), retrievedAt: new Date().toISOString(), interval: current.interval,
    timeZone: body.timezone, grid: { latitude: body.latitude, longitude: body.longitude } }
}

export async function loadCurrentWeather(point: WeatherPoint, signal: AbortSignal): Promise<CurrentWeather> {
  const key = weatherPointKey(point), saved = cache.get(key)
  if (saved && Date.now() - saved.time < 5 * 60_000) return saved.data
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({ latitude: String(point.latitude), longitude: String(point.longitude),
    current: 'temperature_2m,apparent_temperature,rain,showers,relative_humidity_2m,wind_speed_10m,wind_direction_10m',
    temperature_unit: 'celsius', precipitation_unit: 'mm', wind_speed_unit: 'kmh', timezone: 'auto', timeformat: 'unixtime', cell_selection: 'nearest' }).toString()
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
  if (response.status === 429) throw new Error('Open-Meteo ha alcanzado su límite de consultas. Inténtalo más tarde.')
  if (!response.ok) throw new Error('Open-Meteo no está disponible en este momento.')
  const data = parseWeather(await response.json())
  cache.delete(key); cache.set(key, { time: Date.now(), data })
  if (cache.size > 16) cache.delete(cache.keys().next().value!)
  return data
}
