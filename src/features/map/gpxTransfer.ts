import type { GpxData, GpxPoint } from './gpx'
import { getGpxMetrics, primeGpxMetrics } from './gpxMetrics'
import { getGpxProfile, primeGpxProfile } from './gpxProfile'
import type { GpxProfile, GpxProfileSample } from './gpxProfile'
import { yieldGpx } from './gpxTasks'

export interface PackedGpx {
  // Float64 keeps the recorded precision; NaN encodes absent elevation.
  points: Float64Array<ArrayBuffer>
  offsets: Uint32Array<ArrayBuffer>
  distances: Float64Array<ArrayBuffer>
  metadata: [number, string | undefined, string | undefined][]
  bounds?: GpxData['bounds']
  gaps: Float64Array<ArrayBuffer>
  cuts: Float64Array<ArrayBuffer>
  summary: Pick<GpxProfile, 'totalMeters' | 'minimum' | 'maximum' | 'ascent' | 'descent' | 'missingPoints'>
}

export function packGpx(data: GpxData): PackedGpx {
  const metrics = getGpxMetrics(data), profile = getGpxProfile(data)
  const points = new Float64Array(data.pointCount * 3), offsets = new Uint32Array(data.lines.length + 1)
  const distances = new Float64Array(profile.samples.length), metadata: PackedGpx['metadata'] = []
  let index = 0
  function append(point: GpxPoint) {
    points[index * 3] = point.latitude; points[index * 3 + 1] = point.longitude; points[index * 3 + 2] = point.elevation ?? NaN
    if (point.name !== undefined || point.time !== undefined) metadata.push([index, point.name, point.time])
    index++
  }
  for (let lineIndex = 0; lineIndex < data.lines.length; lineIndex++) {
    offsets[lineIndex] = index
    for (const distance of metrics.distances[lineIndex]!) distances[index++] = distance
    index = offsets[lineIndex]!
    for (const point of data.lines[lineIndex]!) append(point)
  }
  offsets[data.lines.length] = index
  for (const point of data.waypoints) append(point)
  const gaps = new Float64Array(profile.gaps.length * 3)
  profile.gaps.forEach((gap, i) => { gaps[i * 3] = gap.from; gaps[i * 3 + 1] = gap.to; gaps[i * 3 + 2] = gap.segmentIndex })
  const { totalMeters, minimum, maximum, ascent, descent, missingPoints } = profile
  return { points, offsets, distances, metadata, bounds: data.bounds, gaps, cuts: new Float64Array(profile.cuts),
    summary: { totalMeters, missingPoints, ...(minimum === undefined ? {} : { minimum }), ...(maximum === undefined ? {} : { maximum }),
      ...(ascent === undefined ? {} : { ascent }), ...(descent === undefined ? {} : { descent }) } }
}

export function gpxTransferables(packed: PackedGpx): ArrayBuffer[] {
  return [packed.points.buffer, packed.offsets.buffer, packed.distances.buffer, packed.gaps.buffer, packed.cuts.buffer]
}

export async function unpackGpx(packed: PackedGpx, signal?: AbortSignal): Promise<GpxData> {
  const data: GpxData = { lines: [], waypoints: [], pointCount: packed.points.length / 3, ...(packed.bounds ? { bounds: packed.bounds } : {}) }
  const metrics = { distances: [] as number[][], totalMeters: packed.summary.totalMeters }
  const profile: GpxProfile = { ...packed.summary, segments: [], samples: [], gaps: [], cuts: [] }
  let index = 0, meta = 0, work = 0
  // Even the first batch is deferred, so receiving a worker result never
  // synchronously builds the entire point/profile graph in an event handler.
  await yieldGpx(signal)
  for (let lineIndex = 0; lineIndex < packed.offsets.length; lineIndex++) {
    const waypoint = lineIndex === packed.offsets.length - 1
    const end = waypoint ? data.pointCount : packed.offsets[lineIndex + 1]!
    const line: GpxPoint[] = [], distances: number[] = [], samples: GpxProfileSample[] = []
    if (!waypoint) { data.lines.push(line); metrics.distances.push(distances); profile.segments.push(samples) }
    for (; index < end; index++) {
      const point: GpxPoint = { latitude: packed.points[index * 3]!, longitude: packed.points[index * 3 + 1]! }
      const elevation = packed.points[index * 3 + 2]!
      if (!Number.isNaN(elevation)) point.elevation = elevation
      const metadata = packed.metadata[meta]
      if (metadata?.[0] === index) { if (metadata[1] !== undefined) point.name = metadata[1]; if (metadata[2] !== undefined) point.time = metadata[2]; meta++ }
      if (waypoint) data.waypoints.push(point)
      else {
        line.push(point)
        const distanceMeters = packed.distances[index]!
        distances.push(distanceMeters)
        const sample = { point, distanceMeters, segmentIndex: lineIndex }
        samples.push(sample); profile.samples.push(sample)
      }
      if (++work % 512 === 0) await yieldGpx(signal)
    }
  }
  for (let i = 0; i < packed.gaps.length; i += 3) {
    profile.gaps.push({ from: packed.gaps[i]!, to: packed.gaps[i + 1]!, segmentIndex: packed.gaps[i + 2]! })
    if (++work % 512 === 0) await yieldGpx(signal)
  }
  for (const cut of packed.cuts) { profile.cuts.push(cut); if (++work % 512 === 0) await yieldGpx(signal) }
  signal?.throwIfAborted()
  primeGpxMetrics(data, metrics); primeGpxProfile(data, profile)
  return data
}
