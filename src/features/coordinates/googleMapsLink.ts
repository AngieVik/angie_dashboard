import { toGeographic } from './convertCoordinate'

export function createGoogleMapsLink(latitude: number, longitude: number): string {
  toGeographic({ format: 'DD', latitude, longitude })
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
}
