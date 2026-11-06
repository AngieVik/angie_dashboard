// Manual CPU benchmark, not an E2E or domain-correctness test. Node 24:
// node --experimental-transform-types scripts/measure-gpx.mjs
import console from 'node:console'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { registerHooks } from 'node:module'
import { performance } from 'node:perf_hooks'

// The app uses Vite's extensionless TS imports. Resolve those same local modules
// for Node's native type stripping without emitting files or copying algorithms.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context)
    return nextResolve(specifier, context)
  },
})

try {
  const { buildGpxProfilePaths } = await import('../src/features/map/gpxProfilePaths.ts')
  const { getGpxProfile, nearestProfileSample } = await import('../src/features/map/gpxProfile.ts')
  const { prepareGpxDisplay } = await import('../src/features/map/gpxDisplayGeometry.ts')
  const { geographicEnvelope } = await import('../src/features/map/longitudeGeometry.ts')
  const { GPX_GEOMETRY_BYTES, gpxGeometryBytes } = await import('../src/features/map/gpxBudget.ts')
  const { INPUT_BUDGETS } = await import('../src/domain/input/inputBudgets.ts')
  const repeats = 9
  const viewport = { left: 55, top: 23, bottom: 118, width: 529, height: 95 }

  function measure(work) {
    const start = performance.now()
    let result = work()
    const firstMs = performance.now() - start
    const times = []
    for (let run = 0; run < repeats; run++) {
      const start = performance.now()
      result = work()
      times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    return { result, firstMs, medianMs: times[Math.floor(times.length / 2)], maxMs: times.at(-1) }
  }

  function fixture(count, kind) {
    const data = { lines: [], waypoints: [], pointCount: count }
    let line
    let xmlBytes = Buffer.byteLength('<gpx version="1.1"><trk></trk></gpx>')
    const segmentLength = kind === 'fragmented' ? 250 : Math.ceil(count / 20)
    for (let index = 0; index < count; index++) {
      if (index % segmentLength === 0) {
        line = []
        data.lines.push(line)
        xmlBytes += Buffer.byteLength('<trkseg></trkseg>')
      }
      const position = kind === 'repeated-pk' ? Math.floor(index / 2) : index
      const latitude = (40 + (position % 1000) / 10000).toFixed(4)
      const rawLongitude = kind === 'antimeridian' ? 179.5 + (position % 1000) / 1000 : -3 + (position % 1000) / 1000
      const longitude = (rawLongitude > 180 ? rawLongitude - 360 : rawLongitude).toFixed(3)
      const elevation = kind === 'fragmented' && index % 11 < 3 ? undefined : 500 + index % 300
      line.push({ latitude: Number(latitude), longitude: Number(longitude), ...(elevation === undefined ? {} : { elevation }) })
      xmlBytes += Buffer.byteLength(`<trkpt lat="${latitude}" lon="${longitude}">${elevation === undefined ? '' : `<ele>${elevation}</ele>`}</trkpt>`)
    }
    const estimatedBytes = gpxGeometryBytes(data)
    if (count > INPUT_BUDGETS.gpxPoints || count > INPUT_BUDGETS.totalGpxPoints || xmlBytes > INPUT_BUDGETS.gpxBytes || estimatedBytes > GPX_GEOMETRY_BYTES) {
      throw new Error('El caso sintético supera los presupuestos GPX actuales.')
    }
    prepareGpxDisplay(data)
    // Same aggregate points split between up to twenty files, using the actual
    // line envelopes. Only these precomputed bounds enter the timed fit work.
    const fileCount = Math.min(INPUT_BUDGETS.gpxFiles, data.lines.length)
    const groups = Array.from({ length: fileCount }, () => [])
    for (let index = 0; index < data.lines.length; index++) groups[index % fileCount].push(data.lines[index])
    const bounds = groups.map(lines => {
      const group = { lines, waypoints: [], pointCount: lines.reduce((sum, line) => sum + line.length, 0) }
      prepareGpxDisplay(group)
      return group.bounds
    })
    return { data, bounds, xmlBytes, estimatedBytes }
  }

  console.log(`Node ${process.version} ${process.platform}/${process.arch}; primera ejecución y ${repeats} repeticiones por operación.`)
  console.log('Solo CPU en Node: excluye React, SVG/paint, Leaflet, importación y latencia de interacción. Sin umbral de aprobado.')
  for (const [count, kind] of [[1000, 'continuous'], [50000, 'continuous'], [150000, 'continuous'], [150000, 'fragmented'], [150000, 'repeated-pk'], [150000, 'antimeridian']]) {
    const { data, bounds, xmlBytes, estimatedBytes } = fixture(count, kind)
    // Match the UI's ready state: metrics/profile have already been prepared.
    const profile = getGpxProfile(data)
    const low = profile.minimum === profile.maximum ? profile.minimum - 1 : profile.minimum
    const high = profile.minimum === profile.maximum ? profile.maximum + 1 : profile.maximum
    const lastPoint = profile.samples.at(-1).point
    const rows = []
    for (const [operation, work] of [
      ['profile-read (cache)', () => getGpxProfile(data)],
      ['profile-paths', () => buildGpxProfilePaths(profile, { ...viewport, low, high })],
      ['profile-selected (last)', () => profile.samples.findIndex(sample => sample.point === lastPoint)],
      ['profile-nearest', () => nearestProfileSample(profile, profile.totalMeters / 2, 650)],
      ['fit-envelope (1 file)', () => geographicEnvelope([data.bounds], 180)],
      [`fit-envelope (${bounds.length} files)`, () => geographicEnvelope(bounds, 180)],
    ]) {
      const { result, firstMs, medianMs, maxMs } = measure(work)
      rows.push({ operation, firstMs: +firstMs.toFixed(3), medianMs: +medianMs.toFixed(3), maxMs: +maxMs.toFixed(3),
        ...(operation === 'profile-paths' ? { characters: result.trace.length + result.gaps.length + result.cuts.length } : {}) })
    }
    console.log(`${kind}: ${count} puntos; ${profile.segments.length} segmentos; ${profile.gaps.length} huecos; XML ${(xmlBytes / 1048576).toFixed(2)} MiB; geometría estimada ${(estimatedBytes / 1048576).toFixed(2)} MiB.`)
    console.table(rows)
  }
} finally {
  hooks.deregister()
}
