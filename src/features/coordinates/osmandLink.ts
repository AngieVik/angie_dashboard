import { toGeographic } from './convertCoordinate'

// https://osmand.net/docs/user/map/map-context-menu/#coordinates
export function createOsmAndLink(latitude: number, longitude: number): string {
  toGeographic({ format: 'DD', latitude, longitude })
  return `https://osmand.net/map?pin=${latitude},${longitude}#15/${latitude}/${longitude}`
}
