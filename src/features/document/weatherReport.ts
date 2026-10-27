import type { ForecastData, ForecastWarningDetails } from '../forecast/forecastTypes'
import type { CurrentWeather, WeatherPoint } from '../openMeteo/openMeteo'

export interface ForecastReportSnapshot {
  locationKey: string
  location: string
  data: ForecastData | null
  warningDetails: ForecastWarningDetails | null
  previous: boolean
}
export interface CurrentWeatherReportSnapshot { point: WeatherPoint; data: CurrentWeather | null; previous: boolean }
export interface WeatherReportContent { aemet?: ForecastReportSnapshot | null; openMeteo?: CurrentWeatherReportSnapshot | null }

export function formatWeatherDate(value: string, timeZone: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value || '—'
  try { return date.toLocaleString('es-ES', { timeZone, dateStyle: 'short', timeStyle: 'short' }) + ' · ' + timeZone }
  catch { return date.toLocaleString('es-ES', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' }) + ' · UTC' }
}

export function forecastReportRows(data: ForecastData) {
  const days = data.days.flatMap(day => Array.from({ length: day.colSpan }, () => day.text))
  const periods = data.periods.flatMap(period => Array.from({ length: period.colSpan }, () => period.text))
  return data.rows.flatMap(row => {
    let column = 0
    return row.cells.map(cell => {
      const first = column
      column += cell.colSpan
      const period = [...new Set(periods.slice(first, column).map((value, index) => [days[first + index], value && value + ' h'].filter(Boolean).join(' · ')))].join('\n')
      const values = [cell.text, ...cell.images.map(image => image.alt || image.title), ...cell.warnings.map(warning => warning.title || warning.text), cell.title, ...cell.titles]
      return { period, information: [...new Set([row.label, row.title].filter(Boolean))].join(' · '), value: cell.missing ? cell.title || '—' : [...new Set(values.filter(Boolean))].join('\n') || '—' }
    })
  })
}

export function currentWeatherReportRows(data: CurrentWeather) {
  const number = (value: number | null, unit: string, digits = 1) => value === null ? '—' : value.toLocaleString('es-ES', { maximumFractionDigits: digits }) + ' ' + unit
  const interval = data.interval % 60 === 0 ? `${data.interval / 60} min` : `${data.interval} s`
  return [
    { information: 'Temperatura · 2 m', value: number(data.temperature, '°C') },
    { information: 'Sensación térmica', value: number(data.apparentTemperature, '°C') },
    { information: 'Lluvia con chubascos · últimos ' + interval, value: number(data.rain, 'mm', 2) },
    { information: 'Humedad · 2 m', value: number(data.humidity, '%', 0) },
    { information: 'Viento · 10 m', value: number(data.windSpeed, 'km/h') },
    { information: 'Dirección del viento', value: number(data.windDirection, '°', 0) },
    { information: 'Rejilla del modelo', value: `${data.grid.latitude}, ${data.grid.longitude}` },
  ]
}
