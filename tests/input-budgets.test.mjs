import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, loadVisibleDocument, createEmptyDocument, migrateDocument, validateDocument, createDocumentStore
let budgets, createWorkspaceFiles, readGpxFile, loadBoardImage, parseCoordinate
let DocumentRepository
before(async () => {
  server = await createServer({ configFile: false, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null, hmr: false } })
  ;({ loadVisibleDocument } = await server.ssrLoadModule('/src/platform/files/fileAccess.ts'))
  ;({ createEmptyDocument } = await server.ssrLoadModule('/src/domain/document/defaultDocument.ts'))
  ;({ migrateDocument } = await server.ssrLoadModule('/src/domain/document/migrateDocument.ts'))
  ;({ validateDocument } = await server.ssrLoadModule('/src/domain/document/validateDocument.ts'))
  ;({ createDocumentStore } = await server.ssrLoadModule('/src/features/document/documentStore.ts'))
  budgets = await server.ssrLoadModule('/src/domain/input/inputBudgets.ts')
  ;({ createWorkspaceFiles } = await server.ssrLoadModule('/src/platform/files/workspaceFiles.ts'))
  ;({ readGpxFile } = await server.ssrLoadModule('/src/features/map/gpxFileAccess.ts'))
  ;({ loadBoardImage } = await server.ssrLoadModule('/src/features/board/imageLoader.ts'))
  ;({ parseCoordinate } = await server.ssrLoadModule('/src/features/coordinates/parseCoordinate.ts'))
  ;({ DocumentRepository } = await server.ssrLoadModule('/src/storage/documentRepository.ts'))
})
after(async () => { await server?.close() })

test('an excessive JSON is rejected before text() is called', async () => {
  let reads = 0
  const result = await loadVisibleDocument({ size: 80 * 1024 * 1024 + 1, text: async () => { reads++; return '{}' } })
  assert.equal(reads, 0)
  assert.equal(result.status, 'error')
  assert.match(result.message, /80 MiB/)
})

const note = text => ({ id: randomUUID(), type: 'note', title: 'Nota', text })
test('text at 99,999 and 100,000 characters loads; 100,001 is rejected equally by validation and migration', () => {
  for (const length of [99_999, 100_000, 100_001]) {
    const doc = createEmptyDocument()
    doc.notebook.push(note('a'.repeat(length)))
    const original = structuredClone(doc)
    const validated = validateDocument(doc), migrated = migrateDocument(doc)
    assert.equal(validated.success, length <= 100_000)
    assert.equal(migrated.success, length <= 100_000)
    if (!validated.success) assert.deepEqual(migrated.errors, validated.errors)
    assert.deepEqual(doc, original)
  }
})

test('a rejected import or edit preserves the active document and never writes the candidate', async () => {
  const saved = []
  const store = createDocumentStore({ loadActive: async () => null, clearActive: async () => {},
    saveActive: async doc => { saved.push(structuredClone(doc)) } }, { platform: { download() {} } })
  await store.initialize()
  assert.equal(await store.newDocument('Abierto'), true)
  await store.flushAutosave()
  const original = store.getSnapshot().document, generation = store.getSnapshot().documentGeneration
  const baseline = saved.length
  const candidate = createEmptyDocument('Candidato')
  candidate.notebook.push(note('a'.repeat(100_001)))
  const file = new File([JSON.stringify(candidate)], 'prueba.json')
  assert.equal(await store.loadDocument(file), false)
  assert.equal(store.getSnapshot().document, original)
  assert.equal(store.getSnapshot().documentGeneration, generation)
  assert.deepEqual(JSON.parse(await file.text()), candidate)
  const rejection = store.getSnapshot().fileMessage
  assert.equal(store.mutateDocument(doc => { doc.notebook.push(note('a'.repeat(100_001))) }), false)
  assert.equal(store.getSnapshot().fileMessage, rejection)
  await store.flushAutosave()
  assert.equal(store.getSnapshot().document, original)
  assert.equal(saved.length, baseline)
})

test('all file-byte budgets accept limit - 1 and limit, and reject limit + 1 with the same message', async () => {
  for (const kind of ['json', 'gpx', 'image']) {
    const limit = budgets.INPUT_BUDGETS[`${kind}Bytes`]
    for (const offset of [-1, 0, 1]) {
      if (offset <= 0) assert.doesNotThrow(() => budgets.checkFileBytes(limit + offset, kind))
      else assert.throws(() => budgets.checkFileBytes(limit + offset, kind), budgets.InputBudgetError)
    }
  }
  let reads = 0
  const file = { name: 'prueba.gpx', size: budgets.INPUT_BUDGETS.gpxBytes + 1, arrayBuffer: async () => { reads++; return new ArrayBuffer(0) } }
  await assert.rejects(readGpxFile(file), /gpx: límite de 10 MiB/)
  const image = await loadBoardImage({ size: budgets.INPUT_BUDGETS.imageBytes + 1 })
  assert.match(image.message, /image: límite de 50 MiB/)
  assert.equal(reads, 0)
  const text = JSON.stringify(createEmptyDocument())
  for (const offset of [-1, 0]) {
    assert.equal((await loadVisibleDocument({ size: budgets.INPUT_BUDGETS.jsonBytes + offset, text: async () => text })).status, 'loaded')
  }
  assert.equal((await loadVisibleDocument({ text: async () => { reads++; return text } })).status, 'error')
  assert.equal(reads, 0, 'a source with no size must also fail before reading')
})

test('UTF-8 byte budgets count multibyte characters and surrogate pairs without truncation', () => {
  const limit = budgets.INPUT_BUDGETS.gpxBytes
  for (const offset of [-1, 0, 1]) {
    const text = 'á'.repeat(limit / 2 - 1) + 'a'.repeat(2 + offset)
    assert.equal(new Blob([text]).size, limit + offset)
    if (offset <= 0) assert.doesNotThrow(() => budgets.checkTextBytes(text, 'gpx'))
    else assert.throws(() => budgets.checkTextBytes(text, 'gpx'), /10 MiB/)
  }
  assert.doesNotThrow(() => budgets.checkTextBytes('a'.repeat(16_383) + '😀', 'json'))
})

test('coordinate boundaries are checked before trimming', () => {
  for (const length of [1023, 1024, 1025]) assert.equal(parseCoordinate('37 -4'.padEnd(length)).ok, length <= 1024)
})

test('text totals, collection lengths and totals have inclusive boundaries', () => {
  for (const offset of [-1, 0, 1]) {
    const text = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index, 'a'.repeat(100_000)]))
    text[9] = 'a'.repeat(99_999)
    text.extra = 'a'.repeat(offset + 1)
    assert.equal(budgets.checkDocumentBudget(text) === null, offset <= 0)
    const doc = createEmptyDocument()
    doc.notebook = Array.from({ length: 2000 + offset }, () => note(''))
    assert.equal(migrateDocument(doc).success, offset <= 0)
    const collections = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [index, Array(2000).fill(null)]))
    collections[4] = Array(1999).fill(null)
    collections.extra = Array(offset + 1).fill(null)
    assert.equal(budgets.checkDocumentBudget(collections) === null, offset <= 0)
  }
})

test('stroke points, total points, revisions and GPX reference budgets have inclusive boundaries', () => {
  for (const offset of [-1, 0, 1]) {
    const doc = createEmptyDocument()
    doc.board.strokes = [{ id: randomUUID(), tool: 'pen', width: 1, color: '#FFFFFF', points: Array(50_000 + offset).fill({ x: 0, y: 0 }) }]
    assert.equal(validateDocument(doc).success, offset <= 0)
    const total = { board: { strokes: [50_000, 50_000, 49_999, offset + 1].map(length => ({ points: Array(length).fill({ x: 0, y: 0 }) })) } }
    assert.equal(budgets.checkDocumentBudget(total) === null, offset <= 0)
    assert.equal(budgets.checkDocumentBudget({ timeline: [{ revisions: Array(100 + offset).fill(null) }] }) === null, offset <= 0)
    assert.equal(budgets.checkDocumentBudget({ map: { gpx: Array(20 + offset).fill(null) } }) === null, offset <= 0)
    const sizes = [10, 10, 10, 10].map(size => ({ size: size * 1024 * 1024 }))
    sizes.push({ size: 10 * 1024 * 1024 - 1 }, { size: offset + 1 })
    assert.equal(budgets.checkDocumentBudget({ map: { gpx: sizes } }) === null, offset <= 0)
    const files = [{ fingerprint: 'a', data: { pointCount: 100_000 } }, { fingerprint: 'b', data: { pointCount: 50_000 + offset } }]
    if (offset <= 0) assert.doesNotThrow(() => budgets.checkGpxPointTotal(files))
    else assert.throws(() => budgets.checkGpxPointTotal(files), /150000 puntos en total/)
  }
})

test('depth, object count, map names, cycles and embedded bytes are bounded before schema validation', () => {
  for (const offset of [-1, 0, 1]) {
    let nested = null
    for (let depth = 0; depth < budgets.INPUT_BUDGETS.depth + offset; depth++) nested = { child: nested }
    assert.equal(budgets.checkDocumentBudget(nested) === null, offset <= 0)
    const objects = Object.fromEntries(Array.from({ length: budgets.INPUT_BUDGETS.objects - 1 + offset }, (_, index) => [index, {}]))
    assert.equal(budgets.checkDocumentBudget(objects) === null, offset <= 0)
    const properties = Object.fromEntries(Array.from({ length: budgets.INPUT_BUDGETS.properties + offset }, (_, index) => [index, 0]))
    assert.equal(budgets.checkDocumentBudget(properties) === null, offset <= 0)
    assert.equal(budgets.checkDocumentBudget({ map: { markers: [{ name: 'a'.repeat(200 + offset) }] } }) === null, offset <= 0)
    const length = budgets.INPUT_BUDGETS.imageBytes + offset
    const padding = length % 3 === 0 ? '' : length % 3 === 1 ? '==' : '='
    const dataUrl = 'data:image/png;base64,' + 'A'.repeat(Math.ceil(length / 3) * 4 - padding.length) + padding
    assert.equal(budgets.checkDocumentBudget({ board: { backgroundImage: { dataUrl } } }) === null, offset <= 0)
  }
  const cyclic = {}; cyclic.self = cyclic
  assert.match(budgets.checkDocumentBudget(cyclic).message, /circulares/)
})

test('V1–V4 fixtures remain importable at the text limit and original objects are untouched', () => {
  for (const version of [1, 2, 3, 4]) {
    for (const offset of [-1, 0, 1]) {
      const doc = createEmptyDocument()
      doc.formatVersion = version
      const block = note('a'.repeat(100_000 + offset))
      if (version === 1) { delete block.title; doc.filters = { visibleStatuses: [] } }
      doc.notebook.push(block)
      const original = structuredClone(doc)
      assert.equal(migrateDocument(doc).success, offset <= 0, `V${version}, ${offset}`)
      assert.deepEqual(doc, original)
    }
  }
})

function workspaceFixture(file) {
  let writes = 0
  const missing = () => { throw new DOMException('No existe', 'NotFoundError') }
  const handle = { kind: 'file', name: 'dashboard.json', getFile: async () => file,
    createWritable: async () => { writes++; throw new Error('No se esperaba ninguna escritura') } }
  const folder = { kind: 'directory', name: 'Original', queryPermission: async () => 'granted',
    getFileHandle: async name => name === 'dashboard.json' ? handle : missing(), getDirectoryHandle: async () => missing(),
    async *entries() { yield ['dashboard.json', handle] } }
  const root = { kind: 'directory', name: 'angie_dashboard', queryPermission: async () => 'granted',
    getDirectoryHandle: async name => name === 'Original' ? folder : missing(),
    async *entries() { yield ['Original', folder] } }
  return { workspace: createWorkspaceFiles(async () => ({ handle: root, accessId: 'prueba' })), writes: () => writes }
}

test('workspace recovery and save reject an excessive original before reading or overwriting it', async () => {
  const doc = createEmptyDocument('Original')
  let reads = 0
  const file = { size: budgets.INPUT_BUDGETS.jsonBytes + 1, text: async () => { reads++; return JSON.stringify(doc) } }
  const { workspace, writes } = workspaceFixture(file)
  const direct = await loadVisibleDocument(file)
  await assert.rejects(workspace.loadRecoverable('workspace:Original:dashboard.json'), { message: direct.message })
  const saved = await workspace.save(doc)
  assert.equal(saved.status, 'error')
  assert.equal(saved.message, direct.message)
  assert.equal(reads, 0)
  assert.equal(writes(), 0)
})

test('workspace recovery applies the same text boundaries and never modifies the file', async () => {
  for (const offset of [-1, 0, 1]) {
    const doc = createEmptyDocument('Original')
    doc.notebook.push(note('a'.repeat(100_000 + offset)))
    const file = new File([JSON.stringify(doc)], 'dashboard.json')
    const original = await file.text()
    const { workspace, writes } = workspaceFixture(file)
    if (offset <= 0) assert.deepEqual((await workspace.loadRecoverable('workspace:Original:dashboard.json')).document, doc)
    else {
      const direct = await loadVisibleDocument(file)
      await assert.rejects(workspace.loadRecoverable('workspace:Original:dashboard.json'), { message: direct.message })
    }
    assert.equal(await file.text(), original)
    assert.equal(writes(), 0)
  }
})

test('an oversized local active is retained and does not silently fall back to previous', async () => {
  const active = createEmptyDocument('Original')
  active.notebook.push(note('a'.repeat(100_001)))
  const previous = createEmptyDocument('Anterior')
  const records = { active: { document: active }, previous: { document: previous } }
  const original = structuredClone(records)
  const db = { isOpen: () => true, table: () => ({ get: async key => records[key] }), transaction: async (mode, _table, action) => {
    assert.equal(mode, 'r', 'only a read transaction is allowed')
    return action()
  } }
  const repository = new DocumentRepository(db)
  const message = migrateDocument(active).errors[0].message
  await assert.rejects(repository.loadActive(), { message })
  const store = createDocumentStore(repository, { platform: { download() {} } })
  await store.initialize()
  assert.equal(store.getSnapshot().active, false)
  assert.equal(store.getSnapshot().fileMessage, message)
  assert.deepEqual(records, original)
})

test('picker and recent-document rejections preserve an already open document', async () => {
  let candidate = createEmptyDocument('Candidato'), writes = 0
  const store = createDocumentStore({ loadActive: async () => null, clearActive: async () => {},
    saveActive: async () => { writes++ }, loadRecoverable: async () => ({ document: candidate, session: { openModules: [] } }),
    listRecoverable: async () => [{ key: 'board:prueba', title: 'Candidato', documentId: candidate.document.id, savedAt: candidate.document.updatedAt }] },
  { platform: { download() {}, pickOpen: async () => ({ file: new File([JSON.stringify(candidate)], 'prueba.json'), handle: {} }) } })
  await store.initialize()
  await store.newDocument('Abierto')
  await store.flushAutosave()
  const baseline = writes, snapshot = store.getSnapshot()
  const cases = [
    doc => { doc.notebook = [note('a'.repeat(100_001))] },
    doc => { doc.notebook = Array.from({ length: 2001 }, () => note('')) },
    doc => { doc.board.strokes = [{ points: Array(50_001).fill({ x: 0, y: 0 }) }] },
    doc => { doc.board.strokes = [50_000, 50_000, 50_000, 1].map(length => ({ points: Array(length).fill({ x: 0, y: 0 }) })) },
    doc => { doc.timeline = [{ revisions: Array(101).fill(null) }] },
    doc => { doc.map = { markers: [], gpx: Array(21).fill(null) } },
    doc => { doc.map = { markers: [], gpx: [{ size: 10 * 1024 * 1024 + 1 }] } },
  ]
  for (const change of cases) {
    candidate = createEmptyDocument('Candidato'); change(candidate)
    assert.equal(await store.openDocument(), false)
    const rejection = store.getSnapshot().fileMessage
    assert.equal(await store.openRecentDocument(), false)
    assert.equal(store.getSnapshot().fileMessage, rejection)
    assert.equal(store.getSnapshot().document, snapshot.document)
    assert.equal(store.getSnapshot().documentGeneration, snapshot.documentGeneration)
  }
  await store.flushAutosave()
  assert.equal(writes, baseline)
})

test('budget traversal timings for admitted synthetic documents', context => {
  for (const count of [100_000, 900_000]) {
    const input = createEmptyDocument()
    input.notebook = Array.from({ length: count / 100_000 }, () => note('a'.repeat(100_000)))
    const start = performance.now()
    for (let repeat = 0; repeat < 10; repeat++) assert.equal(migrateDocument(JSON.parse(JSON.stringify(input))).success, true)
    context.diagnostic(`${count} text units, ten JSON round-trips + migrations: ${(performance.now() - start).toFixed(2)} ms (Node; not UI latency)`)
  }
})
