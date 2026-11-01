import { DOMParser } from '@xmldom/xmldom'
import type { Element } from '@xmldom/xmldom'
import type { GpxData, GpxPoint } from './gpx'
import { INPUT_BUDGETS, budgetIssue, checkTextBytes, InputBudgetError } from '../../domain/input/inputBudgets'

export function parseGpx(text: string, availablePoints: number = INPUT_BUDGETS.gpxPoints): GpxData {
  checkTextBytes(text, 'gpx')
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('El GPX no puede contener declaraciones DTD ni entidades.')
  // Workers have no native DOMParser. Reject recovery warnings as well as errors:
  // accepting a repaired XML tree would silently change the imported geometry.
  const xml = new DOMParser({ onError: () => { throw new Error('El archivo no es un GPX válido.') } }).parseFromString(text, 'application/xml')
  const root = xml.documentElement
  if (!root || root.localName !== 'gpx') throw new Error('El archivo no es un GPX válido.')
  const version = root.getAttribute('version')
  if (version && version !== '1.0' && version !== '1.1') throw new Error('Solo se admiten GPX 1.0 y 1.1.')
  if (root.namespaceURI && !['http://www.topografix.com/GPX/1/0', 'http://www.topografix.com/GPX/1/1'].includes(root.namespaceURI)) {
    throw new Error('El espacio de nombres del GPX no se reconoce.')
  }
  const children = (parent: Element, name: string) => Array.from(parent.childNodes).filter((child): child is Element => child.nodeType === 1 && (child as Element).localName === name && (child as Element).namespaceURI === root.namespaceURI)
  let pointCount = 0
  function point(element: Element): GpxPoint {
    if (++pointCount > INPUT_BUDGETS.gpxPoints) throw new InputBudgetError(budgetIssue('gpx', INPUT_BUDGETS.gpxPoints, 'puntos'))
    if (pointCount > availablePoints) throw new InputBudgetError(budgetIssue('map.gpx', INPUT_BUDGETS.totalGpxPoints, 'puntos en total'))
    const lat = element.getAttribute('lat'), lon = element.getAttribute('lon')
    const latitude = Number(lat), longitude = Number(lon)
    const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
    if (!lat || !lon || !decimal.test(lat.trim()) || !decimal.test(lon.trim()) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new Error('El GPX contiene un punto con coordenadas inválidas.')
    }
    const name = children(element, 'name')[0]?.textContent?.trim()
    if (name && name.length > INPUT_BUDGETS.gpxNameCharacters) throw new InputBudgetError(budgetIssue('gpx.name', INPUT_BUDGETS.gpxNameCharacters, 'caracteres'))
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
