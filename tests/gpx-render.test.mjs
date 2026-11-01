import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'

let server, transfer, parser, metrics, profile
before(async () => {
  server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null, hmr: false } })
  transfer = await server.ssrLoadModule('/src/features/map/gpxTransfer.ts')
  parser = await server.ssrLoadModule('/src/features/map/gpxParser.ts')
  metrics = await server.ssrLoadModule('/src/features/map/gpxMetrics.ts')
  profile = await server.ssrLoadModule('/src/features/map/gpxProfile.ts')
})
after(async () => { await server?.close() })

test('transferred buffers preserve exact points, segments, metadata, gaps and shared profile identity', async () => {
  const data = parser.parseGpx('<gpx><trk><trkseg><trkpt lat="36.1234567890123" lon="-4"><ele>0</ele><name>A &amp; B</name><time>2026-11-01T10:00:00Z</time></trkpt><trkpt lat="37" lon="-5"/></trkseg><trkseg><trkpt lat="38" lon="-6"><ele>100</ele></trkpt></trkseg></trk><wpt lat="39" lon="-7"><name>W</name></wpt></gpx>')
  const packed = transfer.packGpx(data)
  const buffers = transfer.gpxTransferables(packed)
  const received = structuredClone(packed, { transfer: buffers })
  assert.ok(buffers.every(buffer => buffer.byteLength === 0), 'ownership is transferred, not copied')
  const restored = await transfer.unpackGpx(received)
  assert.deepEqual(restored.lines, data.lines)
  assert.deepEqual(restored.waypoints, data.waypoints)
  assert.deepEqual(metrics.getGpxMetrics(restored), metrics.getGpxMetrics(data))
  assert.deepEqual(profile.getGpxProfile(restored), profile.getGpxProfile(data))
  assert.equal(profile.getGpxProfile(restored).samples[0].point, restored.lines[0][0])
})

test('large buffer reconstruction yields and aborts without returning partial geometry', async () => {
  const data = { lines: [Array.from({ length: 10000 }, (_, i) => ({ latitude: 36 + i / 100000, longitude: -4 }))], waypoints: [], pointCount: 10000 }
  const packed = transfer.packGpx(data), controller = new AbortController()
  const pending = transfer.unpackGpx(packed, controller.signal)
  setTimeout(() => controller.abort(), 0)
  await assert.rejects(pending, { name: 'AbortError' })
})

test('parser rejects against remaining aggregate points before materializing a second full geometry', () => {
  assert.throws(() => parser.parseGpx('<gpx><wpt lat="36" lon="-4"/><wpt lat="37" lon="-5"/></gpx>', 1), /puntos/)
})

test('admission is aggregated across concurrent files and releases its slot on failure', async () => {
  const { GpxGeometryCache } = await server.ssrLoadModule('/src/features/map/gpxGeometryCache.ts')
  const cache = new GpxGeometryCache(), owner = {}
  cache.setNeeds(owner, [{ fingerprint: 'a' }, { fingerprint: 'b' }])
  let finish
  const first = cache.withAdmission(async allowance => {
    assert.equal(allowance.points, 150000)
    await new Promise(resolve => { finish = resolve })
    cache.publish(owner, [{ fingerprint: 'a', data: { lines: [], waypoints: [], pointCount: 100000 } }])
  })
  let started = false
  const second = cache.withAdmission(async allowance => {
    started = true
    assert.equal(allowance.points, 50000)
    assert.equal(allowance.known[0].points, 100000)
    assert.ok(allowance.bytes < 64 * 1024 * 1024)
    throw new Error('rejected')
  })
  assert.equal(started, false)
  const rejection = assert.rejects(second, /rejected/)
  finish(); await first; await rejection
  await cache.withAdmission(async allowance => assert.equal(allowance.points, 50000))
  cache.dispose()
})

test('a verified known fingerprint reuses geometry without unpacking a duplicate graph', async () => {
  const { analyzeGpx } = await server.ssrLoadModule('/src/features/map/gpxWorkerClient.ts')
  const previous = globalThis.Worker
  let worker
  globalThis.Worker = class {
    constructor() { worker = this }
    postMessage(request) { this.request = request }
    terminate() { this.terminated = true }
  }
  try {
    const data = { lines: [], waypoints: [], pointCount: 150000 }
    const pending = analyzeGpx(new File(['original'], 'known.gpx'), undefined, { documentGeneration: 1, getCached: fingerprint => fingerprint === 'known' ? data : undefined })
    worker.onmessage({ data: { ...worker.request, ok: true, fingerprint: 'known', cached: true } })
    assert.equal((await pending).data, data)
    assert.ok(worker.terminated)
  } finally { globalThis.Worker = previous }
})
