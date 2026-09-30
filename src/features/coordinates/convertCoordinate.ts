import proj4 from 'proj4'
import type { Coordinate, CoordinateFormat, FormattedCoordinate, GeographicCoordinate } from './coordinateTypes'
import { UTM_BANDS } from './coordinateTypes'

function projection(zone: number, band: string) {
  // S is a latitude band, not the southern-hemisphere flag.
  const south = UTM_BANDS.indexOf(band) < UTM_BANDS.indexOf('N')
  return `+proj=utm +zone=${zone}${south ? ' +south' : ''} +datum=WGS84 +units=m +no_defs`
}

export function toGeographic(coordinate: Coordinate): GeographicCoordinate {
  let latitude: number, longitude: number
  if (coordinate.format === 'UTM') {
    const { zone, band, easting, northing } = coordinate
    if (!Number.isInteger(zone) || zone < 1 || zone > 60) throw new Error('Huso UTM: debe estar entre 1 y 60.')
    const index = UTM_BANDS.indexOf(band)
    if (band.length !== 1 || index < 0) throw new Error('Banda UTM: usa C–X, excepto I y O.')
    if (!Number.isFinite(easting) || easting < 100000 || easting > 900000) throw new Error('Este UTM: debe estar entre 100000 y 900000 m.')
    if (!Number.isFinite(northing) || northing < 0 || northing > 10000000) throw new Error('Norte UTM: debe estar entre 0 y 10000000 m.')
    const point = proj4(projection(zone, band), 'EPSG:4326', [easting, northing])
    longitude = point[0]!
    latitude = point[1]!
    const lower = -80 + index * 8, upper = band === 'X' ? 84 : lower + 8
    // Millimetre rounding at band edges can shift an inverse by a few nanodegrees.
    if (latitude < lower - 1e-8 || latitude > upper + 1e-8 || (band === 'M' && latitude >= 0)) {
      throw new Error('Banda UTM: no coincide con el Norte introducido.')
    }
    if (Math.abs(Math.abs(longitude) - 180) < 1e-8) longitude = zone <= 30 ? -180 : 180
    if (Math.abs(latitude + 80) < 1e-8) latitude = -80
    if (Math.abs(latitude - 84) < 1e-8) latitude = 84
  } else {
    latitude = coordinate.latitude
    longitude = coordinate.longitude
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('Latitud: debe estar entre -90 y 90.')
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Longitud: debe estar entre -180 y 180.')
  return { latitude, longitude }
}

function decimal(value: number, places: number) { return String(Number(value.toFixed(places))) }
function angular(value: number, latitude: boolean, format: 'DMS' | 'DMM') {
  const hemisphere = latitude ? (value < 0 ? 'S' : 'N') : (value < 0 ? 'W' : 'E')
  // Round the total first so 59.999… seconds/minutes carry into the next degree.
  const units = format === 'DMS' ? 36000 : 60000
  const total = Math.round(Math.abs(value) * units)
  const degrees = Math.floor(total / units), remainder = total % units
  if (format === 'DMM') return `${degrees}°${(remainder / 1000).toFixed(3).padStart(6, '0')}'${hemisphere}`
  const minutes = Math.floor(remainder / 600), seconds = (remainder % 600) / 10
  return `${degrees}°${String(minutes).padStart(2, '0')}'${seconds.toFixed(1).padStart(4, '0')}"${hemisphere}`
}

function geographicZone(latitude: number, longitude: number) {
  let zone = Math.min(60, Math.floor((longitude + 180) / 6) + 1)
  // Standard UTM exceptions in Norway and Svalbard.
  if (latitude >= 56 && latitude < 64 && longitude >= 3 && longitude < 12) zone = 32
  if (latitude >= 72 && latitude <= 84 && longitude >= 0 && longitude < 42) {
    zone = longitude < 9 ? 31 : longitude < 21 ? 33 : longitude < 33 ? 35 : 37
  }
  return zone
}

export function convertCoordinate(coordinate: Coordinate, format: CoordinateFormat): FormattedCoordinate {
  try {
    const { latitude, longitude } = toGeographic(coordinate)
    let text: string
    if (format === 'DD') text = `${decimal(latitude, 6)}, ${decimal(longitude, 6)}`
    else if (format === 'DMS' || format === 'DMM') text = `${angular(latitude, true, format)} ${angular(longitude, false, format)}`
    else {
      if (latitude < -80 || latitude > 84) throw new Error('UTM solo admite latitudes entre -80° y 84°.')
      const zone = coordinate.format === 'UTM' ? coordinate.zone : geographicZone(latitude, longitude)
      const band = coordinate.format === 'UTM' ? coordinate.band : UTM_BANDS[Math.min(19, Math.floor((latitude + 80) / 8))]!
      const point = coordinate.format === 'UTM' ? [coordinate.easting, coordinate.northing] :
        proj4('EPSG:4326', projection(zone, band), [longitude, latitude])
      if (!point.every(Number.isFinite)) throw new Error('No se pudo convertir la coordenada UTM.')
      text = `${zone}${band} ${decimal(point[0]!, 3)} ${decimal(point[1]!, 3)}`
    }
    return { ok: true, format, text }
  } catch (error) {
    return { ok: false, format, error: error instanceof Error ? error.message : 'No se reconoce la coordenada.' }
  }
}
