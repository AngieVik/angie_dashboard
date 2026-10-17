const AEMET_ORIGIN = 'https://www.aemet.es'
export const AEMET_MUNICIPALITIES_URL = AEMET_ORIGIN + '/es/eltiempo/prediccion/municipios'

export function parseForecastLocation(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || !['www.aemet.es', 'aemet.es'].includes(url.hostname) || url.username || url.password || url.port) return null
    const match = url.pathname.match(/^\/(?:es|ca|gl|va|eu|en|fr)\/eltiempo\/(?:prediccion\/municipios\/(?:mostrarwidget\/)?|widgets\/municipios\/)([a-z0-9-]+-id\d{5})\/?$/i)
    const municipality = match?.[1]
    return municipality ? AEMET_MUNICIPALITIES_URL + '/' + municipality.toLowerCase() : null
  } catch { return null }
}

export function readForecastLocation(navigationKey: string): string | null {
  try { return parseForecastLocation(localStorage.getItem('angie.forecast.' + navigationKey) ?? '') }
  catch { return null }
}

export function writeForecastLocation(navigationKey: string, location: string) {
  try { localStorage.setItem('angie.forecast.' + navigationKey, location) }
  catch { /* Forecast selection remains usable without local storage. */ }
}

export function clearForecastLocation(navigationKey: string) {
  try { localStorage.removeItem('angie.forecast.' + navigationKey) }
  catch { /* Local storage availability does not block module cleanup. */ }
}
