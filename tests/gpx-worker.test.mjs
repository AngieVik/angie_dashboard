import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'

let server, parseGpx, analyzeGpx, GpxGeometryCache
before(async () => {
  server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null, hmr: false } })
  ;({ parseGpx } = await server.ssrLoadModule('/src/features/map/gpxParser.ts'))
  ;({ analyzeGpx } = await server.ssrLoadModule('/src/features/map/gpxWorkerClient.ts'))
  ;({ GpxGeometryCache } = await server.ssrLoadModule('/src/features/map/gpxGeometryCache.ts'))
})
after(async () => { await server?.close() })

test('worker-compatible XML preserves namespaces, segments, routes, metadata and elevation gaps', () => {
  const result = parseGpx(`<g:gpx xmlns:g="http://www.topografix.com/GPX/1/1" xmlns:ext="urn:extension" version="1.1">
    <g:trk><g:trkseg><g:trkpt lat="36" lon="-4"><g:name>A &amp; B</g:name><g:ele>12.5</g:ele><g:time>2026-11-01T10:00:00Z</g:time></g:trkpt></g:trkseg>
    <g:trkseg><g:trkpt lat="37" lon="-5"/></g:trkseg></g:trk>
    <g:rte><g:rtept lat="38" lon="-6"/></g:rte><g:wpt lat="39" lon="-7"/><ext:wpt lat="90" lon="180"/></g:gpx>`)
  assert.equal(result.pointCount, 4)
  assert.equal(result.lines.length, 3)
  assert.equal(result.lines[0][0].name, 'A & B')
  assert.equal(result.lines[0][0].elevation, 12.5)
  assert.equal(result.lines[0][0].time, '2026-11-01T10:00:00Z')
  assert.equal(result.lines[1][0].elevation, undefined)
  assert.equal(result.waypoints.length, 1)
})

test('malformed XML, DTD, entities, incompatible versions and invalid points are rejected', () => {
  for (const xml of [
    '<gpx><wpt lat="36" lon="-4"></gpx>', '<gpx><wpt lat=36 lon="-4"/></gpx>',
    '<gpx><wpt lat="36" lat="37" lon="-4"/></gpx>', '<gpx><wpt lat="36" lon="-4"><name>&unknown;</name></wpt></gpx>',
    '<!DOCTYPE gpx><gpx><wpt lat="36" lon="-4"/></gpx>', '<gpx version="2.0"><wpt lat="36" lon="-4"/></gpx>',
    '<gpx xmlns="urn:invalid"><wpt lat="36" lon="-4"/></gpx>', '<gpx><wpt lat="91" lon="-4"/></gpx>',
    '<gpx><wpt lat="1e2" lon="-4"/></gpx>', '<gpx/>',
  ]) assert.throws(() => parseGpx(xml), undefined, xml)
})

test('point and metadata limits remain enforced by the worker parser', () => {
  assert.throws(() => parseGpx('<gpx><wpt lat="36" lon="-4"><name>' + 'n'.repeat(201) + '</name></wpt></gpx>'), /caracteres/)
  assert.throws(() => parseGpx('<gpx><trk><trkseg>' + '<trkpt lat="36" lon="-4"/>'.repeat(150001) + '</trkseg></trk></gpx>'), /150000 puntos/)
})

test('operation and generation must both match; cancellation terminates parsing and ignores late replies', async () => {
  const previous = globalThis.Worker
  const workers = []
  class FakeWorker {
    constructor() { workers.push(this) }
    postMessage(request) { this.request = request }
    terminate() { this.terminated = true }
    respond(patch = {}) { this.onmessage({ data: { ...this.request, ok: false, message: 'current failure', ...patch } }) }
  }
  globalThis.Worker = FakeWorker
  try {
    const signal = new AbortController()
    const pending = analyzeGpx(new File([''], 'test.gpx'), undefined, { documentGeneration: 7, signal: signal.signal })
    const worker = workers.at(-1)
    worker.respond({ operationId: 'old operation' }); worker.respond({ documentGeneration: 6 })
    assert.equal(worker.terminated, undefined)
    const rejected = assert.rejects(pending, { name: 'AbortError' })
    signal.abort(); await rejected
    assert.equal(worker.terminated, true)
    worker.respond()
    const next = analyzeGpx(new File([''], 'test.gpx'), undefined, { documentGeneration: 8 })
    assert.notEqual(workers.at(-1).request.operationId, worker.request.operationId)
    const failed = assert.rejects(next, /current failure/)
    workers.at(-1).respond(); await failed
    assert.equal(workers.at(-1).terminated, true)
    const count = workers.length
    await assert.rejects(analyzeGpx(new File([''], 'test.gpx'), undefined, { documentGeneration: 9, signal: signal.signal }), { name: 'AbortError' })
    assert.equal(workers.length, count)
  } finally { globalThis.Worker = previous }
})

test('shared processing is cancelled only after the last consumer; a stale completion cannot publish after remount', async () => {
  const cache = new GpxGeometryCache(), map = {}, plan = {}, reference = { fingerprint: 'shared' }
  cache.setNeeds(map, [reference]); cache.setNeeds(plan, [reference])
  let signal, finish, reads = 0
  const read = nextSignal => { reads++; signal = nextSignal; return new Promise(resolve => { finish = resolve }) }
  const first = cache.load(map, reference, read), second = cache.load(plan, reference, read)
  cache.release(map); assert.equal(signal.aborted, false)
  cache.release(plan); assert.equal(signal.aborted, true)
  cache.setNeeds(map, [reference])
  finish({ lines: [], waypoints: [], pointCount: 1 })
  assert.equal(await first, null); assert.equal(await second, null); assert.equal(cache.get('shared'), undefined)
  assert.equal(reads, 1)
  const fresh = cache.load(map, reference, read)
  cache.dispose(); assert.equal(signal.aborted, true)
  finish({ lines: [], waypoints: [], pointCount: 1 }); assert.equal(await fresh, null)
})
