import type { AngieDocument, DocumentElement } from '@/domain/document/types'
import { commandResult, type DocumentCommand } from '@/domain/document/documentCommand'
import type { DocumentStore } from '../document/documentStore'

type Module = 'board' | 'plan'
type Change = { key: string; before: unknown; after: unknown }
interface Entry { fields: Change[]; elements: { id: string; fields: Change[] }[] }
interface History { undo: Entry[]; redo: Entry[] }
const capacity = 100
const sessions = new WeakMap<DocumentStore, { generation: number; board: History; plan: History }>()

export function drawingHistory(store: DocumentStore, module: Module) {
  const generation = store.getSnapshot().documentGeneration
  let session = sessions.get(store)
  if (session?.generation !== generation) {
    session = { generation, board: { undo: [], redo: [] }, plan: { undo: [], redo: [] } }
    sessions.set(store, session)
  }
  return session[module]
}

export function resetDrawingHistory(store: DocumentStore, module: Module) {
  const history = drawingHistory(store, module)
  history.undo.length = 0
  history.redo.length = 0
}

const emptyPlan = { pins: [], strokes: [] }
function fields(before: object, after: object): Change[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => {
    const a: unknown = Reflect.get(before, key), b: unknown = Reflect.get(after, key)
    return a === b ? [] : [{ key, before: a, after: b }]
  })
}

export function recordDrawingEdit(store: DocumentStore, module: Module, command: DocumentCommand) {
  const before = store.getSnapshot().document
  const accepted = store.applyDocumentCommand(command)
  if (!accepted) return false
  const after = store.getSnapshot().document
  if (before === after) return true
  const entry: Entry = { fields: fields(before[module] ?? emptyPlan, after[module] ?? emptyPlan), elements: [] }
  if (before.elements !== after.elements) {
    const originals = new Map(before.elements.map(item => [item.id, item]))
    for (const item of after.elements) {
      const old = originals.get(item.id)
      if (old && old !== item) entry.elements.push({ id: item.id, fields: fields(old, item) })
    }
  }
  if (entry.fields.length || entry.elements.length) {
    const history = drawingHistory(store, module)
    history.undo.push(entry)
    if (history.undo.length > capacity) history.undo.shift()
    history.redo.length = 0
  }
  return true
}

function restore<T extends object>(source: T, changes: Change[], undo: boolean): T {
  if (!changes.length) return source
  const result = { ...source }
  for (const change of changes) {
    if (Reflect.get(source, change.key) !== (undo ? change.after : change.before)) {
      throw new Error('El contenido se ha modificado desde otra herramienta.')
    }
    const value = undo ? change.before : change.after
    if (value === undefined) Reflect.deleteProperty(result, change.key)
    else Reflect.set(result, change.key, value)
  }
  return result
}

export function replayDrawingEdit(store: DocumentStore, module: Module, direction: keyof History) {
  const history = drawingHistory(store, module)
  const undo = direction === 'undo', entry = history[direction].at(-1)
  if (!entry) return false
  const accepted = store.applyDocumentCommand(document => {
    let elements = document.elements
    if (entry.elements.length) {
      const changes = new Map(entry.elements.map(change => [change.id, change.fields]))
      if (!entry.elements.every(change => elements.some(item => item.id === change.id))) throw new Error('El recurso ya no existe.')
      elements = elements.map(item => restore<DocumentElement>(item, changes.get(item.id) ?? [], undo))
    }
    const next: AngieDocument = { ...document, elements }
    if (module === 'board') next.board = restore(document.board, entry.fields, undo)
    else {
      next.plan = restore(document.plan ?? emptyPlan, entry.fields, undo)
      if (next.plan.pins.some(pin => !elements.some(element => element.id === pin.elementId))) throw new Error('El recurso ya no existe.')
    }
    return commandResult(document, next)
  })
  if (accepted) { history[direction].pop(); history[undo ? 'redo' : 'undo'].push(entry) }
  return accepted
}

