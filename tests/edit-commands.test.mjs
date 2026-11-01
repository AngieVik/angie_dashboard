import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let server, empty, elements, timeline, notebook, plan, operations, annotations, createStore, projection, compose
before(async () => {
  server = await createServer({ configFile: false, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } }, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null, hmr: false } })
  const load = path => server.ssrLoadModule(`/src/${path}.ts`)
  ;({ createEmptyDocument: empty } = await load('domain/document/defaultDocument'))
  elements = await load('features/elements/elementCommands')
  timeline = await load('features/timeline/timelineCommands')
  notebook = await load('features/notebook/notebookCommands')
  plan = await load('features/plan/planCommands')
  operations = await load('domain/operations/changeStatus')
  annotations = await load('domain/operations/unitAnnotations')
  projection = await load('domain/operations/timelineProjection')
  ;({ createDocumentStore: createStore } = await load('features/document/documentStore'))
  ;({ applyDocumentCommands: compose } = await load('domain/document/documentCommand'))
})
after(async () => { await server?.close() })

function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
const input = isUnit => ({ name: isUnit ? 'D1' : 'E1', isUnit, information: '', visual: { type: 'emoji', value: '📍', scale: 1 } })
function fixture() {
  let doc = empty('Comandos')
  doc = elements.createElement(doc, input(false)).document
  doc = elements.createElement(doc, input(true)).document
  doc = notebook.addNotebookBlock(doc, 'note').document
  doc = notebook.addNotebookBlock(doc, 'checklist').document
  doc = notebook.addChecklistItem(doc, doc.notebook[1].id).document
  doc = plan.placePlanPin(doc, doc.elements[1].id, { latitude: 37, longitude: -4 }).document
  return doc
}
function check(doc, command, changedBranches) {
  const snapshot = structuredClone(doc)
  freeze(doc)
  const result = command(doc)
  assert.equal(result.changed, changedBranches.length > 0)
  assert.deepEqual(doc, snapshot)
  for (const key of Object.keys(doc)) {
    if (changedBranches.includes(key)) assert.notEqual(result.document[key], doc[key], key)
    else assert.equal(result.document[key], doc[key], key)
  }
  if (!result.changed) assert.equal(result.document, doc)
  return result
}

test('Elementos y Dotaciones copian solo el elemento y las propiedades editadas', () => {
  for (const index of [0, 1]) {
    const doc = fixture(), target = doc.elements[index]
    const { document: next } = check(doc, d => elements.updateElement(d, target.id, { information: 'Nueva información' }), ['elements'])
    assert.equal(next.elements[index].information, 'Nueva información')
    assert.equal(next.elements[1 - index], doc.elements[1 - index])
    for (const key of ['visual', 'position', 'operational']) assert.equal(next.elements[index][key], target[key])
    check(next, d => elements.updateElement(d, target.id, { visual: { ...target.visual }, position: { ...target.position }, information: 'Nueva información' }), [])
  }
})
test('altas, duplicados, lotes, visibilidad y bajas preservan originales y relaciones del Plano', () => {
  const doc = fixture(), [element, unit] = doc.elements
  check(doc, d => elements.createElement(d, input(false)), ['elements'])
  const duplicated = check(doc, d => elements.duplicateElement(d, unit.id), ['elements'])
  assert.equal(duplicated.value.operational.status, null)
  assert.equal(duplicated.value.name, 'D2')
  check(doc, d => elements.updateElements(d, [element.id, unit.id], { nameHidden: true }), ['elements'])
  check(doc, d => elements.updateElements(d, [], { nameHidden: true }), [])
  check(doc, d => elements.togglePinVisibility(d, unit.id), ['elements'])
  check(doc, d => elements.deleteElement(d, element.id), ['elements'])
  const removed = check(doc, d => elements.deleteElement(d, unit.id), ['elements', 'plan'])
  assert.equal(removed.document.plan.pins.length, 0)
  assert.equal(removed.document.plan.strokes, doc.plan.strokes)
  check(doc, d => elements.deleteElement(d, 'missing'), [])
  assert.throws(() => elements.updateElements(doc, [element.id, 'missing'], { nameHidden: true }))
  assert.equal(doc.elements[0].nameHidden, undefined)
})
test('Operativo y Registro cambian juntos sin tocar otras dotaciones ni revisiones antiguas', () => {
  const doc = fixture(), unit = doc.elements[1]
  const status = check(doc, d => operations.changeElementStatus(d, unit.id, 'Activada', new Date()), ['elements', 'timeline']).document
  const entry = status.timeline[0]
  assert.equal(status.elements[0], doc.elements[0])
  assert.equal(status.elements[1].operational.currentEntryId, entry.id)
  assert.equal(projection.isCurrentTimelineEntry(status, entry), true)
  check(status, d => operations.changeElementStatus(d, unit.id, 'Activada', new Date()), [])
  const edited = check(status, d => timeline.reviseTimelineText(d, entry.id, 'Texto nuevo', new Date().toISOString()), ['timeline']).document
  assert.equal(projection.getTimelineEntryText(edited.timeline[0]), 'Texto nuevo')
  check(edited, d => timeline.reviseTimelineText(d, entry.id, 'Texto nuevo', new Date().toISOString()), [])
  for (const command of [d => timeline.deleteTimelineEntry(d, entry.id), d => timeline.correctCurrentStatusEntry(d, entry.id,
    { currentEntryId: entry.id, status: 'Activada', revisionCount: 0 }, new Date().toISOString())]) {
    const next = check(status, command, ['elements', 'timeline']).document
    assert.equal(next.elements[1].operational.currentEntryId, null)
    assert.equal(next.elements[1].operational.status, null)
  }
  check(doc, d => annotations.setUnitNotes(d, unit.id, 'Personalizado'), ['elements'])
  check(doc, d => annotations.setUnitNotesColor(d, unit.id, '#abcdef'), ['elements'])
  check(doc, d => annotations.setUnitNotes(d, unit.id, ''), [])
})
test('Registro manual añade, revisa y elimina preservando entradas ajenas', () => {
  const doc = fixture()
  const added = check(doc, d => timeline.addManualTimelineEntry(d, 'Inicial', new Date()), ['timeline'])
  const next = check(added.document, d => timeline.addManualTimelineEntry(d, 'Otra', new Date()), ['timeline']).document
  assert.equal(next.timeline[0], added.value)
  const revised = check(next, d => timeline.editManualTimelineEntry(d, added.value.id, 'Revisada'), ['timeline']).document
  assert.equal(revised.timeline[1], next.timeline[1])
  check(revised, d => timeline.deleteManualTimelineEntry(d, added.value.id), ['timeline'])
})
test('Cuaderno copia solo bloque, lista e ítem editados', () => {
  const doc = fixture(), [note, list] = doc.notebook, item = list.items[0]
  for (const command of [d => notebook.editNotebookNote(d, note.id, 'Texto'), d => notebook.editNotebookTitle(d, note.id, 'Título'),
    d => notebook.addNotebookBlock(d, 'note'), d => notebook.deleteNotebookBlock(d, note.id), d => notebook.reorderNotebookBlock(d, note.id, list.id),
    d => notebook.addChecklistItem(d, list.id, item.id), d => notebook.editChecklistItem(d, list.id, item.id, 'Tarea'),
    d => notebook.setChecklistItemChecked(d, list.id, item.id, true), d => notebook.deleteChecklistItem(d, list.id, item.id)]) {
    check(doc, command, ['notebook'])
  }
  const next = notebook.editChecklistItem(doc, list.id, item.id, 'Tarea').document
  assert.equal(next.notebook[0], note)
  assert.notEqual(next.notebook[1].items, list.items)
  check(next, d => notebook.editChecklistItem(d, list.id, item.id, 'Tarea'), [])
  check(doc, d => notebook.editNotebookNote(d, note.id, ''), [])
  check(doc, d => notebook.reorderNotebookBlock(d, note.id, note.id), [])
  check(doc, d => notebook.setChecklistItemChecked(d, list.id, item.id, false), [])
})
test('Plano copia solo pines o trazos y detecta las operaciones sin efecto', () => {
  const doc = fixture(), unit = doc.elements[1]
  check(doc, d => plan.placePlanPin(d, unit.id, { latitude: 37, longitude: -4 }), [])
  for (const command of [d => plan.placePlanPin(d, unit.id, { latitude: 38, longitude: -4 }), d => plan.togglePlanPin(d, unit.id), d => plan.removePlanPin(d, unit.id)]) {
    const next = check(doc, command, ['plan']).document
    assert.equal(next.plan.strokes, doc.plan.strokes)
  }
  check(doc, d => plan.removePlanPin(d, 'missing'), [])
  check(doc, d => plan.togglePlanPin(d, 'missing'), [])
  const stroke = { id: crypto.randomUUID(), width: 3, color: '#ABCDEF', points: [{ latitude: 37, longitude: -4 }, { latitude: 38, longitude: -4 }] }
  const next = check(doc, d => plan.addPlanStroke(d, stroke), ['plan']).document
  assert.equal(next.plan.pins, doc.plan.pins)
  check(next, d => plan.removePlanStroke(d, stroke.id), ['plan'])
  check(doc, d => plan.removePlanStroke(d, 'missing'), [])
})
test('el store publica comandos sin clonar ramas ajenas y no guarda operaciones sin cambio', async () => {
  const writes = []
  const store = createStore({ loadActive: async () => null, saveActive: async d => writes.push(d), clearActive: async () => {} }, { platform: { download() {} } })
  await store.initialize()
  await store.newDocument('Edición')
  await store.flushAutosave()
  const original = store.getSnapshot().document
  freeze(original)
  assert.equal(store.applyDocumentCommand(d => elements.createElement(d, input(false))), true)
  await store.flushAutosave()
  const next = store.getSnapshot().document, count = writes.length
  assert.equal(next.board, original.board)
  assert.equal(next.timeline, original.timeline)
  assert.equal(original.elements.length, 0)
  assert.equal(store.applyDocumentCommand(d => elements.updateElement(d, next.elements[0].id, {})), true)
  await store.flushAutosave()
  assert.equal(store.getSnapshot().document, next)
  assert.equal(writes.length, count)
})

test('los valores normalizados iguales conservan la identidad de visual, posición y anclajes', () => {
  let doc = fixture(), id = doc.elements[0].id
  doc = elements.updateElement(doc, id, { nameOffset: { x: 2, y: 3 }, pinAnchor: { x: 0.5, y: 0.5 }, visual: { type: 'emoji', value: '📍', scale: 4 } }).document
  const target = doc.elements[0]
  check(doc, d => elements.updateElement(d, id, { nameOffset: { ...target.nameOffset }, pinAnchor: { ...target.pinAnchor }, visual: { ...target.visual, scale: 20 } }), [])
  check(doc, d => elements.updateElements(d, doc.elements.map(e => e.id), { visual: { rotation: 45 } }), ['elements'])
  assert.throws(() => elements.updateElement(doc, id, { visual: { ...target.visual, scale: NaN } }))
})
test('editar un ítem o pin conserva los ítems y pines vecinos', () => {
  let doc = fixture(), listId = doc.notebook[1].id
  doc = notebook.addChecklistItem(doc, listId).document
  doc = plan.placePlanPin(doc, doc.elements[0].id, { latitude: 36, longitude: -5 }).document
  const edited = check(doc, d => notebook.setChecklistItemChecked(d, listId, doc.notebook[1].items[0].id, true), ['notebook']).document
  assert.equal(edited.notebook[1].items[1], doc.notebook[1].items[1])
  const moved = check(doc, d => plan.placePlanPin(d, doc.elements[1].id, { latitude: 38, longitude: -5 }), ['plan']).document
  assert.equal(moved.plan.pins[1], doc.plan.pins[1])
})
test('borrar un estado histórico conserva la entrada Actual y corregir con una guarda antigua falla', () => {
  let doc = fixture(), id = doc.elements[1].id
  doc = operations.changeElementStatus(doc, id, 'Activada', new Date()).document
  const old = doc.timeline[0]
  doc = operations.changeElementStatus(doc, id, 'Interviniendo', new Date()).document
  const currentId = doc.elements[1].operational.currentEntryId
  const next = check(doc, d => timeline.deleteTimelineEntry(d, old.id.toUpperCase()), ['timeline']).document
  assert.equal(next.elements[1].operational.currentEntryId, currentId)
  assert.throws(() => timeline.correctCurrentStatusEntry(doc, old.id, { currentEntryId: old.id, status: 'Activada', revisionCount: 0 }, new Date().toISOString()))
  const removed = check(doc, d => elements.deleteElement(d, id), ['elements', 'plan']).document
  assert.equal(removed.timeline, doc.timeline)
})
test('los comandos compuestos aplican el estado personalizado de forma atómica y conservan el histórico', () => {
  const doc = fixture(), id = doc.elements[1].id
  const commands = [d => annotations.setUnitNotes(d, id, 'Apoyo'), d => annotations.setUnitNotesColor(d, id, '#abcdef'),
    d => operations.changeElementStatus(d, id, 'Personalizada', new Date())]
  const next = check(doc, d => compose(d, commands), ['elements', 'timeline']).document
  assert.equal(next.timeline[0].customLabel, 'Apoyo')
  check(next, d => compose(d, commands), [])
  const revised = compose(next, [d => annotations.setUnitNotes(d, id, 'Reserva'), d => operations.changeElementStatus(d, id, 'Personalizada', new Date())]).document
  assert.equal(revised.timeline[0], next.timeline[0])
  assert.equal(next.timeline[0].customLabel, 'Apoyo')
})
test('vaciar trazos copia una sola rama del Plano y conserva sus pines', () => {
  const doc = fixture()
  check(doc, d => plan.clearPlanStrokes(d), [])
  const stroke = { id: crypto.randomUUID(), width: 2, color: '#ABCDEF', points: [{ latitude: 37, longitude: -4 }, { latitude: 38, longitude: -4 }] }
  const next = plan.addPlanStroke(doc, stroke).document
  const cleared = check(next, d => plan.clearPlanStrokes(d), ['plan']).document
  assert.equal(cleared.plan.pins, next.plan.pins)
  assert.deepEqual(cleared.plan.strokes, [])
})
test('una secuencia de ediciones en el store conserva todas sus instantáneas y rechaza sin publicar ni guardar', async () => {
  const { replaceBoard, replaceMap, updateModuleLayouts, clearDocumentModules } = await server.ssrLoadModule('/src/features/document/documentEdits.ts')
  const writes = []
  const store = createStore({ loadActive: async () => null, saveActive: async d => writes.push(d), clearActive: async () => {} }, { platform: { download() {} } })
  await store.initialize()
  await store.newDocument('Secuencia')
  store.applyDocumentCommand(() => ({ document: fixture(), changed: true }))
  const snapshots = []
  const record = () => {
    const doc = store.getSnapshot().document
    snapshots.push([freeze(doc), structuredClone(doc)])
    return doc
  }
  const first = record(), id = first.elements[1].id
  const commands = [d => elements.updateElement(d, first.elements[0].id, { name: 'E2' }), d => elements.updateElement(d, id, { information: 'Dotación editada' }),
    d => operations.changeElementStatus(d, id, 'Activada', new Date()), d => timeline.reviseTimelineText(d, d.timeline[0].id, 'Activación', new Date().toISOString()),
    d => notebook.editNotebookNote(d, d.notebook[0].id, 'Nota'), d => plan.placePlanPin(d, id, { latitude: 38, longitude: -4 }),
    d => replaceBoard(d, { ...d.board, backgroundColor: '#ABCDEF' }),
    d => replaceMap(d, { markers: [{ id: crypto.randomUUID(), name: 'M.1', latitude: 37, longitude: -4, color: '#ABCDEF' }], gpx: [] }),
    d => updateModuleLayouts(d, [{ id: 'board', layout: { x: 0, y: 0, width: 300, height: 200, referenceSize: { width: 1000, height: 800 } } }]),
    d => clearDocumentModules(d, ['notebook'])]
  for (const command of commands) { assert.equal(store.applyDocumentCommand(command), true); record() }
  await store.flushAutosave()
  const current = store.getSnapshot().document, count = writes.length
  assert.equal(store.applyDocumentCommand(d => elements.updateElement(d, id, { information: 'x'.repeat(100_001) })), false)
  assert.throws(() => store.applyDocumentCommand(d => compose(d, [d => annotations.setUnitNotes(d, id, 'Pendiente'),
    d => annotations.setUnitNotesColor(d, id, 'invalid')])))
  assert.equal(store.getSnapshot().document, current)
  await store.flushAutosave()
  assert.equal(writes.length, count)
  for (const [doc, copy] of snapshots) assert.deepEqual(doc, copy)
})

test('Pizarra y Mapa comparten las colecciones y objetos que no cambian', async () => {
  const { replaceBoard, replaceMap } = await server.ssrLoadModule('/src/features/document/documentEdits.ts')
  const doc = fixture()
  check(doc, d => replaceBoard(d, { ...d.board, strokes: [], quickNotes: [] }), [])
  const next = check(doc, d => replaceBoard(d, { ...d.board, backgroundColor: '#ABCDEF' }), ['board']).document
  assert.equal(next.board.strokes, doc.board.strokes)
  assert.equal(next.board.quickNotes, doc.board.quickNotes)
  const marker = { id: crypto.randomUUID(), name: 'M.1', latitude: 37, longitude: -4, color: '#ABCDEF' }
  const mapped = check(doc, d => replaceMap(d, { markers: [marker], gpx: [] }), ['map']).document
  check(mapped, d => replaceMap(d, { markers: [{ ...marker }], gpx: [] }), [])
  const moved = check(mapped, d => replaceMap(d, { ...d.map, markers: [{ ...marker, latitude: 38 }] }), ['map']).document
  assert.equal(moved.map.gpx, mapped.map.gpx)
})
test('la geometría conserva los layouts vecinos y detecta medidas iguales', async () => {
  const { updateModuleLayouts } = await server.ssrLoadModule('/src/features/document/documentEdits.ts')
  const doc = fixture(), layout = { x: 0, y: 0, width: 300, height: 200, referenceSize: { width: 1000, height: 800 } }
  const next = check(doc, d => updateModuleLayouts(d, [{ id: 'board', layout }, { id: 'map', layout: { ...layout, x: 400 } }]), ['moduleLayouts']).document
  check(next, d => updateModuleLayouts(d, [{ id: 'board', layout: { ...layout, referenceSize: { ...layout.referenceSize } } }]), [])
  const resized = check(next, d => updateModuleLayouts(d, [{ id: 'board', layout: { ...layout, width: 350 } }]), ['moduleLayouts']).document
  assert.equal(resized.moduleLayouts.map, next.moduleLayouts.map)
})
test('la limpieza de módulos conserva históricos y solo desconecta las relaciones afectadas', async () => {
  const { clearDocumentModules } = await server.ssrLoadModule('/src/features/document/documentEdits.ts')
  let doc = fixture()
  doc = operations.changeElementStatus(doc, doc.elements[1].id, 'Activada', new Date()).document
  check(doc, d => clearDocumentModules(d, ['coordinates', 'clock']), [])
  const withoutUnits = check(doc, d => clearDocumentModules(d, ['dotations']), ['elements', 'plan']).document
  assert.equal(withoutUnits.elements[0], doc.elements[0])
  assert.equal(withoutUnits.timeline, doc.timeline)
  const cleared = check(doc, d => clearDocumentModules(d, ['timeline']), ['elements', 'timeline']).document
  assert.equal(cleared.elements[0], doc.elements[0])
  assert.equal(cleared.elements[1].operational.currentEntryId, null)
  check(cleared, d => clearDocumentModules(d, ['timeline']), [])
  for (const [ids, branches] of [[['board'], []], [['map'], []], [['notebook'], ['notebook']], [['plan'], ['plan']], [['information'], ['elements']], [['operations'], ['elements']]]) {
    check(doc, d => clearDocumentModules(d, ids), branches)
  }
})

test('Pizarra conserva notas, trazos e imagen ajenos a cada acción del reducer', async () => {
  const { replaceBoard } = await server.ssrLoadModule('/src/features/document/documentEdits.ts')
  const { boardReducer, createBoardState } = await server.ssrLoadModule('/src/features/board/boardReducer.ts')
  let doc = fixture()
  const note = { id: crypto.randomUUID(), title: 'Nota', text: '', scale: 1, position: { x: 300, y: 300 }, width: 200, height: 100 }
  for (const item of [note, { ...note, id: crypto.randomUUID() }]) {
    doc = replaceBoard(doc, boardReducer(createBoardState(doc.board), { type: 'add-note', note: item }).board).document
  }
  for (const action of [{ type: 'move-note', id: note.id, position: { ...doc.board.quickNotes[0].position } },
    { type: 'edit-note', id: note.id, text: '' }, { type: 'delete-note', id: 'missing' }, { type: 'clear-strokes' }]) {
    check(doc, d => replaceBoard(d, boardReducer(createBoardState(d.board), action).board), [])
  }
  const edited = check(doc, d => replaceBoard(d, boardReducer(createBoardState(d.board), { type: 'edit-note', id: note.id, text: 'Cambio' }).board), ['board']).document
  assert.equal(edited.board.quickNotes[1], doc.board.quickNotes[1])
  assert.equal(edited.board.quickNotes[0].position, doc.board.quickNotes[0].position)
  const pen = boardReducer(createBoardState(doc.board), { type: 'mode', mode: 'pen' })
  const started = freeze(boardReducer(pen, { type: 'start', id: crypto.randomUUID(), point: { x: 10, y: 20 }, width: 2, color: '#ABCDEF' }))
  const drawn = freeze(boardReducer(started, { type: 'point', point: { x: 30, y: 40 } }))
  const stroked = check(doc, d => replaceBoard(d, boardReducer(drawn, { type: 'finish' }).board), ['board']).document
  assert.equal(started.draft.points.length, 1)
  assert.equal(stroked.board.strokes[0].points.length, 2)
  assert.equal(stroked.board.quickNotes, doc.board.quickNotes)
  check(stroked, d => replaceBoard(d, boardReducer(createBoardState(d.board), { type: 'clear-strokes' }).board), ['board'])
  const image = { dataUrl: 'data:image/png;base64,prueba', layout: { x: 0, y: 0, width: 300, height: 200 } }
  const withImage = replaceBoard(doc, { ...doc.board, backgroundImage: image }).document
  check(withImage, d => replaceBoard(d, { ...d.board, backgroundImage: { ...image, layout: { ...image.layout } } }), [])
  const moved = check(withImage, d => replaceBoard(d, { ...d.board, backgroundImage: { ...image, layout: { ...image.layout, x: 10 } } }), ['board']).document
  assert.equal(moved.board.quickNotes, withImage.board.quickNotes)
})
test('Mapa conserva marcadores y referencias GPX vecinos incluso en operaciones sin efecto', async () => {
  const { replaceMap } = await server.ssrLoadModule('/src/features/document/documentEdits.ts')
  const marker = { id: crypto.randomUUID(), name: 'M.1', latitude: 37, longitude: -4, color: '#ABCDEF' }
  const reference = { id: crypto.randomUUID(), name: 'Ruta', size: 100, lastModified: 0, fingerprint: 'test', visible: true, color: '#ABCDEF', kilometers: false, kilometerInterval: 1 }
  const doc = replaceMap(fixture(), { markers: [marker, { ...marker, id: crypto.randomUUID() }], gpx: [reference, { ...reference, id: crypto.randomUUID() }] }).document
  check(doc, d => replaceMap(d, { ...d.map, gpx: d.map.gpx.map(item => ({ ...item })) }), [])
  const next = check(doc, d => replaceMap(d, { ...d.map, gpx: d.map.gpx.map(item => item.id === reference.id ? { ...item, visible: false } : item) }), ['map']).document
  assert.equal(next.map.markers, doc.map.markers)
  assert.equal(next.map.gpx[1], doc.map.gpx[1])
})
test('cambiar el título conserva la identidad del contenido y la instantánea anterior', async () => {
  const { renameDocument } = await server.ssrLoadModule('/src/features/document/documentEdits.ts')
  const doc = fixture()
  check(doc, d => renameDocument(d, d.document.title), [])
  check(doc, d => renameDocument(d, 'Título nuevo'), ['document'])
  const store = createStore({ loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {} }, { platform: { download() {} } })
  await store.initialize()
  await store.newDocument('Inicial')
  await store.flushAutosave()
  const previous = freeze(store.getSnapshot().document)
  assert.equal(await store.setTitle('Título nuevo'), true)
  const next = store.getSnapshot().document
  assert.equal(previous.document.title, 'Inicial')
  for (const key of Object.keys(previous).filter(key => key !== 'document')) assert.equal(next[key], previous[key])
  await store.flushAutosave()
})
