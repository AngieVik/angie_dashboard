import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, parseCoordinate, maxLength
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, watch: null } })
  const parser = await server.ssrLoadModule('/src/features/coordinates/parseCoordinate.ts')
  parseCoordinate = parser.parseCoordinate
  maxLength = parser.MAX_COORDINATE_INPUT_LENGTH
})
after(async () => { await server?.close() })

test('preserves DD, DMS, DMM and UTM formats and their separators', () => {
  const cases = [
    ['37.5, -4.5', 'DD', '37.5, -4.5'],
    [' +37,5\t-4,5 ', 'DD', '+37.5, -4.5'],
    ['37 -4', 'DD', '37, -4'],
    ['37.-4', 'DD', '37, -4'],
    ['37\t,\n-4', 'DD', '37, -4'],
    ['37°30\'0"N 4°30\'0"W', 'DMS', '37°30\'0"N 4°30\'0"W'],
    ['37 ° 30 \' 0,5 " S\t4 ° 30 \' 0,5 " E', 'DMS', '37°30\'0.5"S 4°30\'0.5"E'],
    ["37°30'N 4°30'W", 'DMM', "37°30'N 4°30'W"],
    ["37 ° 30,5 ' S\n4 ° 30,5 ' E", 'DMM', "37°30.5'S 4°30.5'E"],
    ['30S 500000 4100000', 'UTM', '30S 500000 4100000'],
    ['30 S, 500000, 4100000', 'UTM', '30S 500000 4100000'],
    ['30S.500000.0.4100000.0', 'UTM', '30S 500000.0 4100000.0'],
    ['30S\t500000,5\n4100000,5', 'UTM', '30S 500000.5 4100000.5'],
  ]
  for (const [input, format, normalized] of cases) {
    const result = parseCoordinate(input)
    assert.equal(result.ok, true, input)
    assert.equal(result.coordinate.format, format, input)
    assert.equal(result.normalizedInput, normalized, input)
  }
  assert.deepEqual(parseCoordinate('37.5, -4.5').coordinate, { format: 'DD', latitude: 37.5, longitude: -4.5 })
})

test('rejects malformed tokens and out of range coordinates', () => {
  for (const input of ['37.12', '37,12', '37-4', '37,, -4', '37; -4', '37 -4 extra',
    '91 0', '0 181', '37°60\'0"N 4°0\'0"W', '90°0\'1"N 4°0\'0"W',
    "37°60'N 4°0'W", '30s 500000 4100000', '61S 500000 4100000', '30I 500000 4100000']) {
    assert.equal(parseCoordinate(input).ok, false, input)
  }
})

test('rejects excessive input before trimming, without accepting a truncated coordinate', () => {
  assert.equal(parseCoordinate('37 -4'.padEnd(maxLength, ' ')).ok, true)
  for (const input of ['37 -4'.padEnd(maxLength + 1, ' '), ' '.repeat(64000), '1'.repeat(64000),
    '37 -4' + ' '.repeat(64000), ' '.repeat(64000) + '37 -4']) {
    const result = parseCoordinate(input)
    assert.equal(result.ok, false)
    assert.equal(result.input, input)
    assert.match(result.error, /caracteres/)
  }
})

test('malformed separators with 64,000 spaces do not block parsing', () => {
  // A separate process bounds synchronous regex stalls, which a test timer cannot interrupt.
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict'
    import { createServer } from 'vite'
    const server = await createServer({ configFile: false, server: { middlewareMode: true, watch: null } })
    try {
      const { parseCoordinate } = await server.ssrLoadModule('/src/features/coordinates/parseCoordinate.ts')
      for (const size of [800, 64000]) {
        for (const input of ['37' + ' '.repeat(size) + 'x -4', '30S' + ' '.repeat(size) + 'x 500000 4100000',
          '30S 500000' + ' '.repeat(size) + 'x 4100000']) {
          assert.equal(parseCoordinate(input).ok, false)
        }
      }
    } finally { await server.close() }
  `], { timeout: 5000, encoding: 'utf8' })
  assert.ifError(run.error)
  assert.equal(run.status, 0, run.stderr)
})
