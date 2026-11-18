import type { AppSettings } from './appSettings'
import { DEFAULT_TIME_ZONE } from '@/platform/timeZones'
import { parseCoordinate } from '../coordinates/parseCoordinate'
import { toGeographic } from '../coordinates/convertCoordinate'

export interface LocationDraft { coordinates: string; query: string; zone: string }
export function createLocationDraft(location: AppSettings['location']): LocationDraft {
  return { coordinates: location ? `${location.latitude}, ${location.longitude}` : '', query: location?.name ?? '', zone: location?.timeZone ?? DEFAULT_TIME_ZONE }
}
export function parseLocationDraft({ coordinates, query, zone }: LocationDraft): AppSettings['location'] {
  if (!coordinates.trim() && !query.trim()) return null
  const result = parseCoordinate(coordinates)
  if (!result.ok) throw new Error(result.error)
  const point = toGeographic(result.coordinate)
  return { name: query.trim() || coordinates.trim(), latitude: point.latitude, longitude: point.longitude, timeZone: zone }
}
