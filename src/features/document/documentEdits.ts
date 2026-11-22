import { removeDrawingReferences } from '@/domain/document/drawingReferences'
import type { AngieDocument, DocumentModuleId, MapDocument, UnitOperational } from '../../domain/document/types'
import { commandResult, sameRecord } from '../../domain/document/documentCommand'
import { createEmptyDocument } from '../../domain/document/defaultDocument'

export function renameDocument(document: AngieDocument, title: string) {
  return commandResult(document, title === document.document.title ? document : { ...document, document: { ...document.document, title } })
}

function reuseItems<T extends { id: string }>(previous: T[], next: T[], reuse: (old: T, item: T) => T = (old, item) => sameRecord(old, item) ? old : item): T[] {
  if (previous === next) return previous
  const byId = new Map(previous.map(item => [item.id, item]))
  const items = next.map(item => {
    const old = byId.get(item.id)
    return old && old !== item ? reuse(old, item) : item
  })
  return items.length === previous.length && items.every((item, index) => item === previous[index]) ? previous : items
}

export function replaceBoard(document: AngieDocument, board: AngieDocument['board']) {
  const previous = document.board
  const next = { ...board, strokes: reuseItems(previous.strokes, board.strokes),
    quickNotes: reuseItems(previous.quickNotes, board.quickNotes, (old, item) => {
      const note = sameRecord(old.position, item.position) ? { ...item, position: old.position } : item
      return sameRecord(old, note) ? old : note
    }) }
  if (previous.backgroundImage && next.backgroundImage) {
    const image = { ...next.backgroundImage, layout: sameRecord(previous.backgroundImage.layout, next.backgroundImage.layout) ? previous.backgroundImage.layout : next.backgroundImage.layout }
    next.backgroundImage = sameRecord(previous.backgroundImage, image) ? previous.backgroundImage : image
  }
  return commandResult(document, sameRecord(previous, next) ? document : { ...document, board: next })
}

export function replaceMap(document: AngieDocument, map: MapDocument) {
  const previous = document.map
  const next = { ...map, markers: reuseItems(previous?.markers ?? [], map.markers), gpx: reuseItems(previous?.gpx ?? [], map.gpx) }
  return commandResult(document, sameRecord(previous, next) ? document : { ...document, map: next })
}

function resetOperations(document: AngieDocument, all: boolean) {
  let changed = false
  const elements = document.elements.map(element => {
    if (!element.isUnit) return element
    const old = element.operational
    const operational: UnitOperational = all ? { status: null, currentEntryId: null, notes: '', tags: old.tags.length ? [] : old.tags }
      : { ...old, status: null, currentEntryId: null }
    if (sameRecord(old, operational)) return element
    changed = true
    return { ...element, operational }
  })
  return changed ? { ...document, elements } : document
}

type CleanupRuntimeEffect = 'board-image' | 'coordinate-input' | 'element-selection' | 'timers'
interface CleanupSharedEffect { module: DocumentModuleId; text: string }
interface ModuleCleanupDefinition {
  clear: (document: AngieDocument) => AngieDocument
  summary: (document: AngieDocument, timers: number) => string
  preserves: readonly { text: string; unless?: readonly DocumentModuleId[] }[]
  runtime?: readonly CleanupRuntimeEffect[]
  shared?: (before: AngieDocument, after: AngieDocument) => CleanupSharedEffect[]
}
const unchanged = (document: AngieDocument) => document
const unitsIn = (document: AngieDocument) => document.elements.filter(element => element.isUnit).length
function resourceEffects(before: AngieDocument, after: AngieDocument): CleanupSharedEffect[] {
  const effects: CleanupSharedEffect[] = []
  const pins = (before.plan?.pins.length ?? 0) - (after.plan?.pins.length ?? 0)
  if (pins > 0) effects.push({ module: 'plan', text: `${pins} ubicaciones vinculadas a los recursos eliminados se retiran del Plano operativo.` })
  const units = unitsIn(before) - unitsIn(after)
  if (units > 0) for (const module of ['information', 'operations'] as const) {
    effects.push({ module, text: `${units} dotaciones eliminadas dejan de aparecer en Información y Operativo.` })
  }
  return effects
}
function operationalEffects(before: AngieDocument, after: AngieDocument): CleanupSharedEffect[] {
  const remaining = new Map(after.elements.map(element => [element.id, element]))
  const changed = before.elements.filter(element => {
    const next = remaining.get(element.id)
    return element.isUnit && next?.isUnit && element.operational !== next.operational
  }).length
  return changed ? (['information', 'operations'] as const).map(module => ({ module,
    text: `Se restablecen datos operativos compartidos de ${changed} dotaciones en Información y Operativo.` })) : []
}

// One definition per module owns its command, preview and session effects.
export const MODULE_CLEANUP: Readonly<Record<DocumentModuleId, ModuleCleanupDefinition>> = {
  board: {
    clear: document => replaceBoard(document, createEmptyDocument().board).document,
    summary: document => `${document.board.strokes.length} trazos, ${document.board.shapes?.length ?? 0} figuras, ${document.board.quickNotes.length} notas, ${document.board.labels?.length ?? 0} etiquetas, ${document.board.groups?.length ?? 0} grupos y ${(document.board.images?.length ?? 0) + Number(!!document.board.backgroundImage)} imágenes. Se restablece el fondo de la pizarra.`,
    preserves: [], runtime: ['board-image'],
  },
  elements: {
    clear: document => {
      const elements = document.elements.filter(element => element.isUnit)
      return elements.length === document.elements.length ? document : { ...document, elements }
    },
    summary: document => `${document.elements.length - unitsIn(document)} elementos y sus pines.`,
    preserves: [{ text: 'Dotaciones.', unless: ['dotations'] }], runtime: ['element-selection'], shared: resourceEffects,
  },
  dotations: {
    clear: document => {
      const elements = document.elements.filter(element => !element.isUnit)
      return elements.length === document.elements.length ? document : { ...document, elements }
    },
    summary: document => `${unitsIn(document)} dotaciones, sus datos operativos y sus pines.`,
    preserves: [{ text: 'Registro.', unless: ['timeline'] }, { text: 'Elementos.', unless: ['elements'] }],
    runtime: ['element-selection'], shared: resourceEffects,
  },
  information: {
    clear: document => resetOperations(document, true),
    summary: document => `Estados, anotaciones y etiquetas de ${unitsIn(document)} dotaciones.`,
    preserves: [{ text: 'Registro.', unless: ['timeline'] }], runtime: ['element-selection'], shared: operationalEffects,
  },
  operations: {
    clear: document => resetOperations(document, true),
    summary: document => `Estados, anotaciones y etiquetas de ${unitsIn(document)} dotaciones.`,
    preserves: [{ text: 'Registro.', unless: ['timeline'] }], runtime: ['element-selection'], shared: operationalEffects,
  },
  coordinates: { clear: unchanged, summary: () => 'Entrada y resultados de coordenadas.', preserves: [], runtime: ['coordinate-input'] },
  map: {
    clear: document => { if (!document.map) return document; const next = { ...document }; delete next.map; return next },
    summary: document => `${document.map?.gpx.length ?? 0} GPX vinculados, ${document.map?.markers.length ?? 0} marcadores y la selección del mapa.`,
    preserves: [{ text: 'Archivos GPX originales.' }],
  },
  plan: {
    clear: document => { if (!document.plan) return document; const next = { ...document }; delete next.plan; return next },
    summary: document => `${document.plan?.strokes.length ?? 0} trazos, ${document.plan?.shapes?.length ?? 0} figuras, ${document.plan?.quickNotes?.length ?? 0} notas, ${document.plan?.labels?.length ?? 0} etiquetas, ${document.plan?.images?.length ?? 0} imágenes, ${document.plan?.groups?.length ?? 0} grupos y ${document.plan?.pins.length ?? 0} ubicaciones del plano.`,
    preserves: [{ text: 'Elementos.', unless: ['elements'] }, { text: 'Dotaciones.', unless: ['dotations'] }, { text: 'GPX del Mapa.', unless: ['map'] }],
  },
  clock: { clear: unchanged, summary: (_document, timers) => `${timers} temporizadores guardados y sus alarmas.`, preserves: [], runtime: ['timers'] },
  calendar: { clear: unchanged, summary: () => 'Se restablece la vista del calendario.', preserves: [{ text: 'Eventos de la agenda transversal.' }] },
  calculator: { clear: unchanged, summary: () => 'Operación y resultado de la calculadora.', preserves: [] },
  notebook: {
    clear: document => document.notebook.length ? { ...document, notebook: [] } : document,
    summary: document => `${document.notebook.filter(block => block.type === 'note').length} notas y ${document.notebook.filter(block => block.type === 'checklist').length} listas del cuaderno.`,
    preserves: [],
  },
  timeline: {
    clear: document => resetOperations(document.timeline.length ? { ...document, timeline: [] } : document, false),
    summary: document => `${document.timeline.length} entradas del Registro y los estados actuales de las dotaciones.`,
    preserves: [{ text: 'Anotaciones y etiquetas operativas.', unless: ['information', 'operations', 'dotations'] }], shared: operationalEffects,
  },
  reports: { clear: unchanged, summary: () => 'Selección y vista previa de informes.', preserves: [{ text: 'Informes guardados.' }] },
}

export function clearDocumentModules(document: AngieDocument, ids: readonly DocumentModuleId[]) {
  let next = document
  for (const id of new Set(ids)) next = MODULE_CLEANUP[id].clear(next)
  if (next.elements !== document.elements) {
    const retained = new Set(next.elements.map(e => e.id))
    const removed = new Set(document.elements.filter(e => !retained.has(e.id)).map(e => e.id))
    next = { ...next, board: removeDrawingReferences(next.board, removed),
      ...(next.plan ? { plan: removeDrawingReferences(next.plan, removed) } : {}) }
  }
  if (next.plan && next.elements !== document.elements) {
    const remaining = new Set(next.elements.map(element => element.id.toLowerCase()))
    const pins = next.plan.pins.filter(pin => remaining.has(pin.elementId.toLowerCase()))
    if (pins.length !== next.plan.pins.length) next = { ...next, plan: { ...next.plan, pins } }
  }
  return commandResult(document, next)
}
