export type CoordinateFormat = 'DD' | 'DMS' | 'DMM' | 'UTM'
export interface GeographicCoordinate { latitude: number; longitude: number }
export type Coordinate = (GeographicCoordinate & { format: 'DD' | 'DMS' | 'DMM' }) | {
  format: 'UTM'; zone: number; band: string; easting: number; northing: number
}
export type CoordinateParseResult = { ok: true; coordinate: Coordinate; normalizedInput: string } |
  { ok: false; input: string; error: string }
export type FormattedCoordinate = { ok: true; format: CoordinateFormat; text: string } |
  { ok: false; format: CoordinateFormat; error: string }
export const UTM_BANDS = 'CDEFGHJKLMNPQRSTUVWX'
