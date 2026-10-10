import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { getBoardBounds, initialBoardView, panBoard, toBoardPosition, zoomBoardAt } from './boardViewport'

describe('cámara rectangular de pizarra', () => {
  it('recupera el ancho del nombre escalado aunque exceda la caja del emoji', () => {
    const document = createEmptyDocument()
    document.elements.push({ id: '00000000-0000-4000-8000-000000000001', name: 'Nombre largo', pinVisible: true, information: '', isUnit: false, operational: null,
      visual: { type: 'emoji', value: '📍', scale: 3 }, position: { x: 1500, y: 1500 } })
    expect(getBoardBounds({ width: 300, height: 300 }, document.board, document.elements)).toEqual({ left: 0, top: 0, right: 1800, bottom: 1596 })
  })
  it.each([{ width: 700, height: 300 }, { width: 300, height: 700 }])('usa píxeles estables en $width × $height', size => {
    const view = { scale: 1, offsetX: 0, offsetY: 0 }
    expect(toBoardPosition({ x: 100 + size.width, y: 50 + size.height }, { left: 100, top: 50, ...size }, view, size)).toEqual({ x: size.width, y: size.height })
  })
  it('invierte simultáneamente escala principal 2 y cámara propia 0.5 con desplazamientos', () => {
    // Scene (500,300) -> own pixels (200,120) -> physical (500,290).
    expect(toBoardPosition({ x: 500, y: 290 }, { left: 100, top: 50, width: 1400, height: 600 },
      { scale: .5, offsetX: -50, offsetY: -30 }, { width: 700, height: 300 })).toEqual({ x: 500, y: 300 })
    expect(toBoardPosition({ x: 99, y: 50 }, { left: 100, top: 50, width: 1400, height: 600 },
      { scale: 1, offsetX: 0, offsetY: 0 }, { width: 700, height: 300 })).toBeNull()
  })
  it('abre contenido centrado a escala 1 y vacío en origen sin modificar el documento', () => {
    const document = createEmptyDocument(), size = { width: 700, height: 300 }
    expect(initialBoardView(size, document.board, document.elements)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
    document.board.quickNotes.push({ id: '00000000-0000-4000-8000-000000000001', title: '', scale: 1, text: 'Ruta', position: { x: 1500, y: 900 }, width: 220, height: 96 })
    const before = structuredClone(document)
    expect(initialBoardView(size, document.board, document.elements)).toEqual({ scale: 1, offsetX: -1150, offsetY: -750 })
    expect(getBoardBounds({ width: 300, height: 700 }, document.board, [])).toEqual({ left: 0, top: 0, right: 1610, bottom: 948 })
    const recovered = panBoard({ scale: 1, offsetX: 0, offsetY: 0 }, -1310, -500, { width: 300, height: 700 }, getBoardBounds({ width: 300, height: 700 }, document.board, []))
    expect(recovered.offsetX).toBe(-1310)
    expect(document).toEqual(before)
  })
  it('incluye cajas completas de pines, nombres y ancho de trazos', () => {
    const document = createEmptyDocument()
    document.elements.push({ id: '00000000-0000-4000-8000-000000000001', name: 'Nombre largo', pinVisible: true, information: '', isUnit: false, operational: null, visual: { type: 'asset', assetId: 'ambulance', scale: 3 }, position: { x: 1500, y: 1500 } })
    document.board.strokes.push({ id: '00000000-0000-4000-8000-000000000002', tool: 'pen', color: '#000000', width: 40, points: [{ x: 1900, y: 2000 }] })
    expect(getBoardBounds({ width: 300, height: 300 }, document.board, document.elements)).toEqual({ left: 0, top: 0, right: 1920, bottom: 2020 })
  })
  it('ancla zoom al puntero y limita entre 0.25 y 4', () => {
    const size = { width: 700, height: 300 }, bounds = { left: 0, top: 0, right: 3000, bottom: 3000 }
    const view = { scale: 1, offsetX: -100, offsetY: -200 }
    expect(zoomBoardAt(view, 2, { x: 200, y: 100 }, size, bounds)).toEqual({ scale: 2, offsetX: -400, offsetY: -500 })
    expect(zoomBoardAt(view, .01, { x: 200, y: 100 }, size, bounds).scale).toBe(.25)
    expect(zoomBoardAt(view, 10, { x: 200, y: 100 }, size, bounds).scale).toBe(4)
  })
})

describe('origen firme y exploración', () => {
  it('no crea margen positivo por centrar cajas importadas cercanas a cero', () => {
    const doc = createEmptyDocument()
    doc.board.quickNotes.push({ id: '00000000-0000-4000-8000-000000000003', title: '', scale: 1, text: 'Borde', position: { x: 1, y: 1 }, width: 220, height: 96 })
    const before = structuredClone(doc)
    expect(getBoardBounds({ width: 300, height: 200 }, doc.board, [])).toEqual({ left: 0, top: 0, right: 300, bottom: 200 })
    expect(initialBoardView({ width: 300, height: 200 }, doc.board, [])).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
    expect(doc).toEqual(before)
  })
  it('limita arriba/izquierda al origen incluso con tres zooms y explora vacío a derecha/abajo', () => {
    const size = { width: 300, height: 200 }, bounds = { left: 0, top: 0, right: 300, bottom: 200 }
    expect(panBoard({ scale: 4, offsetX: 0, offsetY: 0 }, 1000, 1000, size, bounds)).toEqual({ scale: 4, offsetX: 0, offsetY: 0 })
    expect(panBoard({ scale: 1, offsetX: 0, offsetY: 0 }, -200, -100, size, bounds)).toEqual({ scale: 1, offsetX: -200, offsetY: -100 })
  })
})


it('invierte los tres zooms para que cursor y punto compartan centro lógico', () => {
  // board .5, module 2, dashboard 1.5: scene (120,80) -> physical (190,110).
  expect(toBoardPosition({ x: 190, y: 110 }, { left: 10, top: 20, width: 1200, height: 900 },
    { scale: .5, offsetX: 0, offsetY: -10 }, { width: 400, height: 300 })).toEqual({ x: 120, y: 80 })
})

it('centrado recupera letra de 72 px cuando el icono mide 16 px', () => {
  const d = createEmptyDocument()
  d.elements.push({ id: crypto.randomUUID(), name: 'CP', nameFontSize: 72, pinVisible: true, information: '', isUnit: false, operational: null,
    visual: { type: 'emoji', value: '📍', scale: .25 }, position: { x: 200, y: 100 } })
  expect(initialBoardView({ width: 100, height: 100 }, d.board, d.elements)).toEqual({ scale: 1, offsetX: -150, offsetY: -13 })
})
