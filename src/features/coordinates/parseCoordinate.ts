import type { Coordinate, CoordinateParseResult } from './coordinateTypes'
import { toGeographic } from './convertCoordinate'
import { INPUT_BUDGETS, budgetIssue } from '../../domain/input/inputBudgets'

const numeric = '(\\d+(?:[.,]\\d+)?)'
const dmsPattern = new RegExp(`^(\\d+)\\s*°\\s*(\\d+)\\s*'\\s*${numeric}\\s*"\\s*([NS])\\s+(\\d+)\\s*°\\s*(\\d+)\\s*'\\s*${numeric}\\s*"\\s*([EW])$`)
const dmmPattern = new RegExp(`^(\\d+)\\s*°\\s*${numeric}\\s*'\\s*([NS])\\s+(\\d+)\\s*°\\s*${numeric}\\s*'\\s*([EW])$`)
const number = (text: string) => Number(text.replace(',', '.'))
const normalizeNumber = (text: string) => text.replace(',', '.')

export const MAX_COORDINATE_INPUT_LENGTH = INPUT_BUDGETS.coordinateCharacters
export const COORDINATE_INPUT_LENGTH_ERROR = budgetIssue('Coordenadas', MAX_COORDINATE_INPUT_LENGTH, 'caracteres').message

function scanSeparatedCoordinate(text: string, utm = false): string[] | null {
  let position = 0
  const read = (pattern: RegExp) => {
    pattern.lastIndex = position
    const match = pattern.exec(text)
    if (!match) return null
    position = pattern.lastIndex
    return match[0]
  }
  const whitespace = () => {
    while (position < text.length && /\s/.test(text[position]!)) position++
  }
  const separator = () => {
    const start = position
    whitespace()
    if (text[position] === ',' || text[position] === '.') {
      position++
      whitespace()
      return true
    }
    return position > start
  }
  const parts: string[] = []
  if (utm) {
    const zone = read(/\d+/y)
    if (zone === null) return null
    whitespace()
    const band = read(/[A-Za-z]/y)
    if (band === null || !separator()) return null
    parts.push(zone, band)
  }
  // Consume each complete number once: never split a decimal into two ordinates
  // or redistribute whitespace between overlapping separator alternatives.
  const numericPattern = utm ? /\d+(?:[.,]\d+)?/y : /[+-]?\d+(?:[.,]\d+)?/y
  const first = read(numericPattern)
  if (first === null || !separator()) return null
  const second = read(numericPattern)
  if (second === null || position !== text.length) return null
  return [...parts, first, second]
}

export function parseCoordinate(input: string): CoordinateParseResult {
  if (input.length > MAX_COORDINATE_INPUT_LENGTH) return { ok: false, input, error: COORDINATE_INPUT_LENGTH_ERROR }
  const text = input.trim()
  let coordinate: Coordinate, normalizedInput: string
  try {
    const dd = scanSeparatedCoordinate(text)
    const utm = dd ? null : scanSeparatedCoordinate(text, true)
    const dms = dmsPattern.exec(text), dmm = dmmPattern.exec(text)
    if (dd) {
      coordinate = { format: 'DD', latitude: number(dd[0]!), longitude: number(dd[1]!) }
      normalizedInput = `${normalizeNumber(dd[0]!)}, ${normalizeNumber(dd[1]!)}`
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
      coordinate = { format: 'UTM', zone: number(utm[0]!), band: utm[1]!, easting: number(utm[2]!), northing: number(utm[3]!) }
      normalizedInput = `${utm[0]}${utm[1]} ${normalizeNumber(utm[2]!)} ${normalizeNumber(utm[3]!)}`
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
