import { toGeographic } from './convertCoordinate'

const ALPHABET = '23456789CFGHJMPQRVWX'
const PAIR_PRECISION = 8000

// Full, ten-digit Open Location Code (WGS84), without a locality reference.
// https://github.com/google/open-location-code/blob/main/Documentation/Specification/specification.md
export function createPlusCode(latitude: number, longitude: number): string {
  toGeographic({ format: 'DD', latitude, longitude })
  // Scale before adding the offsets to avoid losing precision near cell edges.
  // The north pole belongs to the final cell; +180 wraps to the antimeridian.
  let lat = Math.min(180 * PAIR_PRECISION - 1, Math.floor(latitude * PAIR_PRECISION) + 90 * PAIR_PRECISION)
  let lon = Math.floor((longitude === 180 ? -180 : longitude) * PAIR_PRECISION) + 180 * PAIR_PRECISION
  let code = ''
  for (let pair = 0; pair < 5; pair++) {
    code = ALPHABET.charAt(lat % 20) + ALPHABET.charAt(lon % 20) + code
    lat = Math.floor(lat / 20)
    lon = Math.floor(lon / 20)
  }
  return code.slice(0, 8) + '+' + code.slice(8)
}
