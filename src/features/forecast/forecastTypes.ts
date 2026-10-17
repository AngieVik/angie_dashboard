export interface ForecastWarning { level: number; text: string; title: string; href: string; phenomenon: string | null }
export interface ForecastWarningDetails {
  sourceUrl: string
  date: string
  zone: string
  province: string
  items: { id: string; phenomenon: string; phenomenonName: string; level: number; levelName: string; value: string; probability: string; onset: string; expires: string; comment: string; certainty: string; certaintyName: string }[]
  retrievedAt: string
  resourceUpdatedAt: string | null
  stale: boolean
}
export interface ForecastCell {
  text: string
  title: string
  colSpan: number
  rowSpan: number
  titles: string[]
  images: { src: string; alt: string; title: string }[]
  warnings: ForecastWarning[]
  missing: boolean
}
export type ForecastField = 'estado_cielo' | 'temp' | 'sen_termica' | 'prob_prec' | 'humedad_rel' | 'dir_viento' | 'avisos'
export interface ForecastData {
  municipality: string
  sourceUrl: string
  attribution: string
  resourceUpdatedAt: string | null
  retrievedAt: string
  periodsTimeZone: string
  days: ForecastCell[]
  periods: ForecastCell[]
  rows: { id: ForecastField; label: string; title: string; cells: ForecastCell[] }[]
  stale: boolean
}
