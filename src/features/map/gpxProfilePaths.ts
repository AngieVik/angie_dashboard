import type { GpxProfile } from './gpxProfile'

interface ProfileViewport {
  left: number
  top: number
  bottom: number
  width: number
  height: number
  low: number
  high: number
}

// Keep SVG preparation independent of React so its synchronous cost can be
// measured separately from committing, parsing and painting the SVG.
export function buildGpxProfilePaths(profile: GpxProfile, { left, top, bottom, width, height, low, high }: ProfileViewport) {
  const px = (distance: number) => (left + (profile.totalMeters ? distance / profile.totalMeters : .5) * width).toFixed(1)
  const py = (elevation: number) => (bottom - (elevation - low) / (high - low) * height).toFixed(1)
  const trace: string[] = []
  for (const segment of profile.segments) {
    let drawing = false, previous = ''
    for (const item of segment) {
      if (item.point.elevation === undefined) { drawing = false; continue }
      const coordinate = px(item.distanceMeters) + ' ' + py(item.point.elevation)
      if (!drawing) trace.push('M' + coordinate + 'l0 .01')
      else if (coordinate !== previous) trace.push('L' + coordinate)
      previous = coordinate; drawing = true
    }
  }
  const gaps = profile.gaps.map(gap => {
    const start = Number(px(gap.from)), end = Number(px(gap.to))
    return `M${start} ${top}h${Math.max(1, end - start)}v${height}H${start}Z`
  }).join('')
  const cuts = profile.cuts.map(distance => `M${px(distance)} ${top}V${bottom}`).join('')
  return { trace: trace.join(''), gaps, cuts }
}
