import type { MapGpxReference } from '../../domain/document/types'

export interface GpxPoint { latitude: number; longitude: number; name?: string; elevation?: number; time?: string }
export interface GpxData { lines: GpxPoint[][]; waypoints: GpxPoint[]; pointCount: number }
export const PK_INTERVALS = [0.1, 0.5, 1, 5, 10] as const
export interface LoadedGpx extends MapGpxReference {
  data: GpxData
}

export const MAX_GPX_BYTES = 10 * 1024 * 1024
const MAX_GPX_POINTS = 150_000

export function parseGpx(text: string): GpxData {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('El GPX no puede contener declaraciones DTD ni entidades.')
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  const root = xml.documentElement
  if (xml.getElementsByTagName('parsererror').length || root.localName !== 'gpx') throw new Error('El archivo no es un GPX válido.')
  const version = root.getAttribute('version')
  if (version && version !== '1.0' && version !== '1.1') throw new Error('Solo se admiten GPX 1.0 y 1.1.')
  if (root.namespaceURI && !['http://www.topografix.com/GPX/1/0', 'http://www.topografix.com/GPX/1/1'].includes(root.namespaceURI)) {
    throw new Error('El espacio de nombres del GPX no se reconoce.')
  }
  const children = (parent: Element, name: string) => Array.from(parent.children).filter(child => child.localName === name && child.namespaceURI === root.namespaceURI)
  let pointCount = 0
  function point(element: Element): GpxPoint {
    if (++pointCount > MAX_GPX_POINTS) throw new Error('El GPX supera el límite de 150.000 puntos.')
    const lat = element.getAttribute('lat'), lon = element.getAttribute('lon')
    const latitude = Number(lat), longitude = Number(lon)
    const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
    if (!lat || !lon || !decimal.test(lat.trim()) || !decimal.test(lon.trim()) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new Error('El GPX contiene un punto con coordenadas inválidas.')
    }
    const name = children(element, 'name')[0]?.textContent?.trim().slice(0, 200)
    const elevationText = children(element, 'ele')[0]?.textContent?.trim()
    const elevation = elevationText && decimal.test(elevationText) ? Number(elevationText) : undefined
    const time = children(element, 'time')[0]?.textContent?.trim()
    return { latitude, longitude, ...(name ? { name } : {}),
      ...(elevation !== undefined && Number.isFinite(elevation) ? { elevation } : {}),
      ...(time && /^\d{4}-\d{2}-\d{2}T/.test(time) && Number.isFinite(Date.parse(time)) ? { time } : {}),
    }
  }
  const lines: GpxPoint[][] = []
  // Keep each track segment separate; joining them invents connections.
  for (const track of children(root, 'trk')) for (const segment of children(track, 'trkseg')) {
    const points = children(segment, 'trkpt').map(point)
    if (points.length) lines.push(points)
  }
  for (const route of children(root, 'rte')) {
    const points = children(route, 'rtept').map(point)
    if (points.length) lines.push(points)
  }
  const waypoints = children(root, 'wpt').map(point)
  if (!pointCount) throw new Error('El GPX no contiene recorridos ni puntos.')
  return { lines, waypoints, pointCount }
}
