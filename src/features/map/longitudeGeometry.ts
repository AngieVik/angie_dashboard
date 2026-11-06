export type GeographicBounds = [[number, number], [number, number]]

export const wrapLongitude = (longitude: number) => ((longitude + 180) % 360 + 360) % 360 - 180

// Choose the equivalent longitude nearest the reference. The -180° tie agrees
// with GPX interpolation; ordinary coordinates retain their recorded precision.
export function unwrapLongitude(longitude: number, reference: number): number {
  return longitude - 360 * Math.floor((longitude - reference + 180) / 360)
}

export function longitudeShift(west: number, east: number, reference: number): number {
  const center = (west + east) / 2
  return unwrapLongitude(center, reference) - center
}

// Enclose entire continuous intervals, not just their endpoints. Removing the
// largest uncovered circular gap aligns disconnected segments/files without
// clipping a long route that happens to have nearby endpoints.
export function geographicEnvelope(bounds: readonly GeographicBounds[], reference = 0): GeographicBounds | undefined {
  if (!bounds.length) return undefined
  let south = Infinity, north = -Infinity
  const intervals: [number, number][] = []
  let widest: GeographicBounds | undefined
  for (const bound of bounds) {
    south = Math.min(south, bound[0][0]); north = Math.max(north, bound[1][0])
    const width = bound[1][1] - bound[0][1]
    if (!widest || width > widest[1][1] - widest[0][1]) widest = bound
    const west = ((bound[0][1] % 360) + 360) % 360, east = west + width
    intervals.push([west, Math.min(360, east)])
    if (east > 360) intervals.push([0, Math.min(360, east - 360)])
  }
  if (widest && widest[1][1] - widest[0][1] >= 360) {
    const shift = longitudeShift(widest[0][1], widest[1][1], reference)
    let west = widest[0][1] + shift, east = widest[1][1] + shift
    const center = (west + east) / 2
    for (const bound of bounds) {
      const offset = longitudeShift(bound[0][1], bound[1][1], center)
      west = Math.min(west, bound[0][1] + offset); east = Math.max(east, bound[1][1] + offset)
    }
    return [[south, west], [north, east]]
  }
  intervals.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const interval of intervals) {
    const last = merged[merged.length - 1]
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1])
    else merged.push([...interval])
  }
  let gap = -1, west = 0, east = 360
  for (let index = 0; index < merged.length; index++) {
    const current = merged[index]!, next = merged[(index + 1) % merged.length]!
    const nextWest = next[0] + (index === merged.length - 1 ? 360 : 0)
    if (nextWest - current[1] > gap) {
      gap = nextWest - current[1]; west = nextWest; east = current[1] + 360
    }
  }
  const shift = longitudeShift(west, east, reference)
  west += shift; east += shift
  const center = (west + east) / 2
  // With no circular gap, some continuous intervals straddle the chosen seam.
  // Keep their complete extent, even if that requires more than one world.
  for (const bound of bounds) {
    const offset = longitudeShift(bound[0][1], bound[1][1], center)
    west = Math.min(west, bound[0][1] + offset); east = Math.max(east, bound[1][1] + offset)
  }
  return [[south, west], [north, east]]
}

export function coordinateNearLongitude(point: { latitude: number; longitude: number }, reference: number): [number, number] {
  return [point.latitude, unwrapLongitude(point.longitude, reference)]
}

export function unwrapPath(points: readonly { latitude: number; longitude: number }[]): [number, number][] {
  let previous = points[0]?.longitude ?? 0
  return points.map(point => {
    previous = unwrapLongitude(point.longitude, previous)
    return [point.latitude, previous]
  })
}

export function pathLongitudeBounds(points: readonly [number, number][]): [number, number] {
  let west = Infinity, east = -Infinity
  for (const point of points) { west = Math.min(west, point[1]); east = Math.max(east, point[1]) }
  return [west, east]
}

export function pathNearLongitude(points: readonly [number, number][], reference: number): [number, number][] {
  if (!points.length) return []
  const [west, east] = pathLongitudeBounds(points)
  const shift = longitudeShift(west, east, reference)
  return points.map(([latitude, longitude]) => [latitude, longitude + shift])
}
