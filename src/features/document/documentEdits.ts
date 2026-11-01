import type { AngieDocument, DocumentModuleId, MapDocument, ModuleLayout, UnitOperational } from '../../domain/document/types'
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
  const next = { markers: reuseItems(previous?.markers ?? [], map.markers), gpx: reuseItems(previous?.gpx ?? [], map.gpx) }
  return commandResult(document, sameRecord(previous, next) ? document : { ...document, map: next })
}

export function updateModuleLayouts(document: AngieDocument, updates: readonly { id: DocumentModuleId; layout: ModuleLayout }[]) {
  let layouts = document.moduleLayouts
  for (const { id, layout } of updates) {
    const previous = layouts[id]
    const next = { ...layout, referenceSize: sameRecord(previous?.referenceSize, layout.referenceSize) ? previous!.referenceSize : layout.referenceSize }
    if (sameRecord(previous, next)) continue
    if (layouts === document.moduleLayouts) layouts = { ...layouts }
    layouts[id] = next
  }
  return commandResult(document, layouts === document.moduleLayouts ? document : { ...document, moduleLayouts: layouts })
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

export function clearDocumentModules(document: AngieDocument, ids: readonly DocumentModuleId[]) {
  let next = document
  for (const id of ids) {
    if (id === 'board') next = replaceBoard(next, createEmptyDocument().board).document
    else if ((id === 'map' && next.map) || (id === 'plan' && next.plan)) {
      next = { ...next }
      if (id === 'map') delete next.map
      else delete next.plan
    } else if (id === 'elements' || id === 'dotations') {
      const elements = next.elements.filter(element => element.isUnit === (id === 'elements'))
      if (elements.length !== next.elements.length) next = { ...next, elements }
    } else if (id === 'notebook' && next.notebook.length) next = { ...next, notebook: [] }
    else if (id === 'timeline') {
      if (next.timeline.length) next = { ...next, timeline: [] }
      next = resetOperations(next, false)
    } else if (id === 'information' || id === 'operations') next = resetOperations(next, true)
  }
  if (next.plan && next.elements !== document.elements) {
    const remaining = new Set(next.elements.map(element => element.id.toLowerCase()))
    const pins = next.plan.pins.filter(pin => remaining.has(pin.elementId.toLowerCase()))
    if (pins.length !== next.plan.pins.length) next = { ...next, plan: { ...next.plan, pins } }
  }
  return commandResult(document, next)
}
