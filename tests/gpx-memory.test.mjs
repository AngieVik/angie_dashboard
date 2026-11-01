import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'

let server, originals
before(async () => {
  server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null, hmr: false } })
  originals = await server.ssrLoadModule('/src/storage/gpxResources.ts')
})
after(async () => { await server?.close() })

test('pending originals cannot grow past the file budget or evict unsaved bytes', async () => {
  const fingerprints = []
  for (let i = 0; i < 20; i++) fingerprints.push((await originals.registerGpx(new Blob(['pending-' + i]))).fingerprint)
  await assert.rejects(originals.registerGpx(new Blob(['overflow'])))
  for (const fingerprint of fingerprints) assert.ok(originals.gpxResource(fingerprint))
  originals.releaseGpxOriginals(fingerprints)
})

test('geometry is shared until its last consumer leaves and repeated document changes release it', async () => {
  const { GpxGeometryCache } = await server.ssrLoadModule('/src/features/map/gpxGeometryCache.ts')
  const cache = new GpxGeometryCache(), map = {}, plan = {}, report = {}
  const reference = { id: 'a', fingerprint: 'shared' }
  const data = { lines: [[{ latitude: 36, longitude: -4 }]], waypoints: [], pointCount: 1 }
  for (let i = 0; i < 100; i++) {
    for (const consumer of [map, plan, report]) cache.setNeeds(consumer, [reference])
    cache.publish(map, [{ ...reference, data }])
    assert.equal(cache.get(reference.fingerprint), data)
    cache.release(map); cache.release(plan)
    assert.equal(cache.get(reference.fingerprint), data)
    cache.release(report)
    assert.equal(cache.get(reference.fingerprint), undefined)
    assert.deepEqual(cache.memory(), { files: 0, points: 0, bytes: 0, consumers: 0 })
    cache.publish(map, [{ ...reference, data }]) // Late completion after close.
    assert.equal(cache.get(reference.fingerprint), undefined)
  }
})

test('active geometry admission preserves existing data when the point budget is exhausted', async () => {
  const { GpxGeometryCache } = await server.ssrLoadModule('/src/features/map/gpxGeometryCache.ts')
  const cache = new GpxGeometryCache(), consumer = {}
  cache.setNeeds(consumer, [{ fingerprint: 'a' }, { fingerprint: 'b' }])
  const first = { lines: [], waypoints: [], pointCount: 150000 }
  cache.publish(consumer, [{ fingerprint: 'a', data: first }])
  assert.throws(() => cache.publish(consumer, [{ fingerprint: 'b', data: { ...first, pointCount: 1 } }]))
  assert.equal(cache.get('a'), first)
  assert.equal(cache.get('b'), undefined)
  cache.release(consumer)
})

test('committed originals are evicted by budget and pending originals survive that pressure', async () => {
  const first = await originals.registerGpx(new Blob(['protected-pending']))
  const fingerprints = [first.fingerprint]
  for (let i = 0; i < 60; i++) {
    const item = await originals.registerGpx(new Blob(['committed-' + i]))
    fingerprints.push(item.fingerprint)
    originals.commitGpxOriginals([item.fingerprint])
    assert.ok(originals.gpxOriginalMemory().files <= 20)
  }
  assert.ok(originals.gpxResource(first.fingerprint))
  assert.equal(originals.gpxResource(fingerprints[1]), undefined)
  originals.releaseGpxOriginals(fingerprints)
})

test('concurrent consumers parse once and a late completion cannot resurrect released geometry', async () => {
  const { GpxGeometryCache } = await server.ssrLoadModule('/src/features/map/gpxGeometryCache.ts')
  const cache = new GpxGeometryCache(), map = {}, plan = {}, reference = { id: 'a', fingerprint: 'a' }
  for (const consumer of [map, plan]) cache.setNeeds(consumer, [reference])
  let reads = 0, finish
  const read = () => { reads++; return new Promise(resolve => { finish = resolve }) }
  const a = cache.load(map, reference, read), b = cache.load(plan, reference, read)
  const data = { lines: [], waypoints: [], pointCount: 1 }
  cache.release(map)
  finish(data)
  assert.equal(await a, null)
  assert.equal(await b, data)
  assert.equal(reads, 1)
  cache.release(plan)
  assert.equal(cache.memory().files, 0)
  cache.setNeeds(map, [reference])
  const late = cache.load(map, reference, read)
  cache.release(map); finish(data)
  assert.equal(await late, null)
  assert.equal(cache.memory().files, 0)
})

test('report recovery borrows shared geometry and releases it even when rendering fails', async () => {
  const { GpxGeometryCache } = await server.ssrLoadModule('/src/features/map/gpxGeometryCache.ts')
  const cache = new GpxGeometryCache(), map = {}, reference = { id: 'a', fingerprint: 'a' }
  const data = { lines: [], waypoints: [], pointCount: 1 }
  cache.setNeeds(map, [reference]); cache.publish(map, [{ ...reference, data }])
  await assert.rejects(cache.withFiles([reference], async () => { throw new Error('must share') }, async files => {
    assert.equal(files[0].data, data)
    cache.release(map)
    assert.equal(cache.memory().files, 1)
    throw new Error('render failed')
  }), /render failed/)
  assert.deepEqual(cache.memory(), { files: 0, points: 0, bytes: 0, consumers: 0 })
})

test('large point metadata is included in the geometry byte budget', async () => {
  const { GpxGeometryCache } = await server.ssrLoadModule('/src/features/map/gpxGeometryCache.ts')
  const cache = new GpxGeometryCache(), consumer = {}, reference = { fingerprint: 'metadata' }
  const point = { latitude: 36, longitude: -4, name: 'n'.repeat(200) }
  cache.setNeeds(consumer, [reference])
  assert.throws(() => cache.publish(consumer, [{ ...reference, data: { lines: [Array(150000).fill(point)], waypoints: [], pointCount: 150000 } }]))
  assert.equal(cache.memory().files, 0)
  cache.release(consumer)
})
