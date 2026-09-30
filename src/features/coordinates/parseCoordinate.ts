import type { Coordinate, CoordinateParseResult } from './coordinateTypes'
import { toGeographic } from './convertCoordinate'

const numeric = '(\\d+(?:[.,]\\d+)?)'
const signed = '([+-]?\\d+(?:[.,]\\d+)?)'
const ddPattern = new RegExp(`^${signed}\\s*(?:[, .]\\s*|\\s+)${signed}$`)
const dmsPattern = new RegExp(`^(\\d+)\\s*°\\s*(\\d+)\\s*'\\s*${numeric}\\s*"\\s*([NS])\\s+(\\d+)\\s*°\\s*(\\d+)\\s*'\\s*${numeric}\\s*"\\s*([EW])$`)
const dmmPattern = new RegExp(`^(\\d+)\\s*°\\s*${numeric}\\s*'\\s*([NS])\\s+(\\d+)\\s*°\\s*${numeric}\\s*'\\s*([EW])$`)
const utmPattern = new RegExp(`^(\\d+)\\s*([A-Za-z])(?:\\s+|\\s*[, .]\\s*)${numeric}(?:\\s+|\\s*[, .]\\s*)${numeric}$`)
const number = (text: string) => Number(text.replace(',', '.'))
const normalizeNumber = (text: string) => text.replace(',', '.')

export function parseCoordinate(input: string): CoordinateParseResult {
  const text = input.trim()
  let coordinate: Coordinate, normalizedInput: string
  try {
    // Scan complete numeric tokens before matching separators. Regex backtracking
    // must never split a lone decimal (37.12) into two ordinates (37, 12).
    const tokens = text.match(new RegExp(signed, 'g')) ?? []
    const dd = tokens.length === 2 ? ddPattern.exec(text) : null
    const utm = tokens.length === 3 ? utmPattern.exec(text) : null
    const dms = dmsPattern.exec(text), dmm = dmmPattern.exec(text)
    if (dd) {
      coordinate = { format: 'DD', latitude: number(dd[1]!), longitude: number(dd[2]!) }
      normalizedInput = `${normalizeNumber(dd[1]!)}, ${normalizeNumber(dd[2]!)}`
    } else if (dms || dmm) {
      const match = (dms ?? dmm)!
      const latitudeDegrees = number(match[1]!), latitudeMinutes = number(match[2]!)
      const latitudeSeconds = dms ? number(match[3]!) : 0
      const latHemisphere = match[dms ? 4 : 3]!
      const longitudeDegrees = number(match[dms ? 5 : 4]!), longitudeMinutes = number(match[dms ? 6 : 5]!)
      const longitudeSeconds = dms ? number(match[7]!) : 0
      const lonHemisphere = match[dms ? 8 : 6]!
      for (const [part, degrees, minutes, seconds, limit] of [
        ['Latitud', latitudeDegrees, latitudeMinutes, latitudeSeconds, 90],
        ['Longitud', longitudeDegrees, longitudeMinutes, longitudeSeconds, 180],
      ] as const) {
        if (minutes >= 60 || seconds >= 60) throw new Error(`${part}: minutos y segundos deben ser menores que 60.`)
        if (degrees > limit || (degrees === limit && (minutes !== 0 || seconds !== 0))) throw new Error(`${part}: fuera de rango.`)
      }
      coordinate = {
        format: dms ? 'DMS' : 'DMM',
        latitude: (latitudeDegrees + latitudeMinutes / 60 + latitudeSeconds / 3600) * (latHemisphere === 'S' ? -1 : 1),
        longitude: (longitudeDegrees + longitudeMinutes / 60 + longitudeSeconds / 3600) * (lonHemisphere === 'W' ? -1 : 1),
      }
      normalizedInput = dms ? `${match[1]}°${match[2]}'${normalizeNumber(match[3]!)}"${match[4]} ${match[5]}°${match[6]}'${normalizeNumber(match[7]!)}"${match[8]}` :
        `${match[1]}°${normalizeNumber(match[2]!)}'${match[3]} ${match[4]}°${normalizeNumber(match[5]!)}'${match[6]}`
    } else if (utm) {
      coordinate = { format: 'UTM', zone: number(utm[1]!), band: utm[2]!, easting: number(utm[3]!), northing: number(utm[4]!) }
      normalizedInput = `${utm[1]}${utm[2]} ${normalizeNumber(utm[3]!)} ${normalizeNumber(utm[4]!)}`
    } else {
      throw new Error(/^[\s\d]+[A-Za-z]/.test(text) ? 'Estructura UTM: indica huso, banda, Este y Norte.' :
        text.includes('°') ? 'No se reconocen los grados, minutos, segundos o hemisferios.' : 'No se reconoce la latitud y longitud. Usa DD, DMS, DMM o UTM.')
    }
    toGeographic(coordinate)
    return { ok: true, coordinate, normalizedInput }
  } catch (error) {
    return { ok: false, input, error: error instanceof Error ? error.message : 'No se reconoce la coordenada.' }
  }
}
