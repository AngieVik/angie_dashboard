import { createEmptyDocument } from './defaultDocument'
import type { AngieDocument, DocumentModuleId, TimelineEntry, UIBoardData } from './types'

// Only compare allowlisted projections, never the working document (which also
// owns geometry/resources). Shared immutable branches need no traversal.
function samePortableValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && samePortableValue(a[key], b[key]))
}

function captureItems<Source, Value>(items: Source[], previous: Source[] | undefined, captured: Value[] | undefined, project: (item: Source) => Value): Value[] {
  if (items === previous && captured) return captured
  const next = items.map((item, index) => {
    if (captured && previous?.[index] === item) return captured[index]!
    const value = project(item)
    return captured && samePortableValue(value, captured[index]) ? captured[index]! : value
  })
  return captured && next.length === captured.length && next.every((item, index) => item === captured[index]) ? captured : next
}

export function sameUIBoardContent(left: UIBoardData, right: UIBoardData): boolean {
  return left.document.title === right.document.title && left.elements === right.elements && left.notebook === right.notebook
    && left.timeline === right.timeline && left.quickNotes === right.quickNotes && left.openModules === right.openModules
}

function copyTimeline(entry: TimelineEntry): TimelineEntry {
  const revisions = entry.revisions.map(revision => revision.kind === 'text'
    ? { id: revision.id, kind: revision.kind, recordedAt: revision.recordedAt, text: revision.text }
    : { id: revision.id, kind: revision.kind, recordedAt: revision.recordedAt })
  const common = { id: entry.id, occurredAt: entry.occurredAt, revisions }
  return entry.type === 'manual' ? { ...common, type: 'manual', text: entry.text } : {
    ...common, type: 'status-change', unitId: entry.unitId, unitName: entry.unitName,
    previousStatus: entry.previousStatus, nextStatus: entry.nextStatus,
    ...(entry.customLabel === undefined ? {} : { customLabel: entry.customLabel }),
    ...(entry.customColor === undefined ? {} : { customColor: entry.customColor }),
  }
}

// Explicit allowlist: new UI state cannot silently become portable data.
export function captureUIBoard(document: AngieDocument, openModules: readonly DocumentModuleId[], previous?: { document: AngieDocument; data: UIBoardData }): UIBoardData {
  const source = previous?.document, data = previous?.data
  return {
    format: 'angie-uiboard',
    document: { id: document.document.id, title: document.document.title, createdAt: document.document.createdAt, updatedAt: document.document.updatedAt },
    elements: captureItems(document.elements, source?.elements, data?.elements, element => {
      const common = { id: element.id, name: element.name, information: element.information,
        icon: element.visual.type === 'asset' ? { type: 'asset' as const, assetId: element.visual.assetId } : { type: 'emoji' as const, value: element.visual.value } }
      return element.isUnit ? { ...common, isUnit: true, operational: {
        status: element.operational.status, currentEntryId: element.operational.currentEntryId,
        notes: element.operational.notes, tags: [...element.operational.tags],
        ...(element.operational.notesColor === undefined ? {} : { notesColor: element.operational.notesColor }),
      } } : { ...common, isUnit: false, operational: null }
    }),
    notebook: captureItems(document.notebook, source?.notebook, data?.notebook, block => block.type === 'note'
      ? { id: block.id, type: block.type, title: block.title, text: block.text }
      : { id: block.id, type: block.type, title: block.title, items: block.items.map(item => ({ id: item.id, text: item.text, checked: item.checked })) }),
    timeline: captureItems(document.timeline, source?.timeline, data?.timeline, copyTimeline),
    quickNotes: captureItems(document.board.quickNotes, source?.board.quickNotes, data?.quickNotes, note => ({ id: note.id, title: note.title, text: note.text })),
    openModules: data && samePortableValue(openModules, data.openModules) ? data.openModules : [...openModules],
  }
}

export function openUIBoard(data: UIBoardData): AngieDocument {
  const document = createEmptyDocument(data.document.title)
  document.document = { ...data.document }
  document.elements = data.elements.map(element => {
    const common = { id: element.id, name: element.name, information: element.information,
      visual: { ...element.icon, scale: 1 }, position: null, pinVisible: true }
    return element.isUnit ? { ...common, isUnit: true, operational: structuredClone(element.operational) }
      : { ...common, isUnit: false, operational: null }
  })
  document.notebook = structuredClone(data.notebook)
  document.timeline = structuredClone(data.timeline)
  document.board.quickNotes = data.quickNotes.map((note, index) => ({ ...note, scale: 1, width: 180, height: 64,
    position: { x: 110 + index % 4 * 200, y: 60 + Math.floor(index / 4) * 84 } }))
  return document
}
