import type { GpxData, GpxPoint } from './gpx'
import { getGpxMetrics } from './gpxMetrics'

export interface GpxProfileSample { point: GpxPoint; distanceMeters: number; segmentIndex: number }
interface ProfileGap { from: number; to: number; segmentIndex: number }
export interface GpxProfile {
  segments: GpxProfileSample[][]
  samples: GpxProfileSample[]
  gaps: ProfileGap[]
  cuts: number[]
  totalMeters: number
  minimum?: number
  maximum?: number
  ascent?: number
  descent?: number
  missingPoints: number
}

export function getGpxProfile(data: GpxData): GpxProfile {
  const metrics = getGpxMetrics(data)
  const profile: GpxProfile = { segments: [], samples: [], gaps: [], cuts: [], totalMeters: metrics.totalMeters, missingPoints: 0 }
  let ascent = 0, descent = 0, pairs = 0
  for (let segmentIndex = 0; segmentIndex < data.lines.length; segmentIndex++) {
    const line = data.lines[segmentIndex]!
    const segment: GpxProfileSample[] = []
    for (let index = 0; index < line.length; index++) {
      const point = line[index]!, distanceMeters = metrics.distances[segmentIndex]![index]!
      const sample = { point, distanceMeters, segmentIndex }
      segment.push(sample); profile.samples.push(sample)
      const elevation = point.elevation
      if (elevation === undefined) profile.missingPoints++
      else {
        profile.minimum = profile.minimum === undefined ? elevation : Math.min(profile.minimum, elevation)
        profile.maximum = profile.maximum === undefined ? elevation : Math.max(profile.maximum, elevation)
      }
      const previous = segment[index - 1]
      if (previous) {
        if (previous.point.elevation !== undefined && elevation !== undefined) {
          const difference = elevation - previous.point.elevation
          ascent += Math.max(0, difference); descent += Math.max(0, -difference); pairs++
        } else {
          const last = profile.gaps[profile.gaps.length - 1]
          if (last?.segmentIndex === segmentIndex && last.to === previous.distanceMeters) last.to = distanceMeters
          else profile.gaps.push({ from: previous.distanceMeters, to: distanceMeters, segmentIndex })
        }
      } else if (line.length === 1 && elevation === undefined) {
        profile.gaps.push({ from: distanceMeters, to: distanceMeters, segmentIndex })
      }
    }
    if (segment.length) {
      if (profile.segments.length) profile.cuts.push(segment[0]!.distanceMeters)
      profile.segments.push(segment)
    }
  }
  if (pairs) { profile.ascent = ascent; profile.descent = descent }
  return profile
}

export function nearestProfileSample(profile: GpxProfile, distanceMeters: number, elevation?: number): number {
  let nearest = 0, distance = Infinity, height = Infinity
  for (let index = 0; index < profile.samples.length; index++) {
    const sample = profile.samples[index]!
    const delta = Math.abs(sample.distanceMeters - distanceMeters)
    // Height resolves points at the same PK on either side of a segment cut.
    const heightDelta = elevation !== undefined && sample.point.elevation !== undefined ? Math.abs(sample.point.elevation - elevation) : Infinity
    if (delta < distance || delta === distance && heightDelta < height) {
      nearest = index; distance = delta; height = heightDelta
    }
  }
  return nearest
}
