import type { DocumentElement, TimelineEntry, UIBoardElement } from '../document/types'
import { measureWork } from '../../platform/workMetrics'

export interface TimelineIndex {
  byId: ReadonlyMap<string, TimelineEntry>
  latestByUnit: ReadonlyMap<string, TimelineEntry>
}
const timelineCache = new WeakMap<readonly TimelineEntry[], TimelineIndex>()
const elementCache = new WeakMap<readonly DocumentElement[], ReadonlyMap<string, DocumentElement>>()

// Array identity is the revision: commands replace changed arrays/objects. Weak
// keys release indexes with their document, without a global revision counter.
export function buildTimelineIndex(entries: readonly TimelineEntry[]): TimelineIndex {
  const byId = new Map<string, TimelineEntry>(), latestByUnit = new Map<string, TimelineEntry>()
  for (const entry of entries) {
    const id = entry.id.toLowerCase()
    if (!byId.has(id)) byId.set(id, entry) // Same first-match semantics as find.
    if (entry.type === 'status-change') latestByUnit.set(entry.unitId.toLowerCase(), entry)
  }
  return { byId, latestByUnit }
}
export function getTimelineIndex(entries: readonly TimelineEntry[]): TimelineIndex {
  let index = timelineCache.get(entries)
  if (!index) { index = measureWork('operations.timeline-index', () => buildTimelineIndex(entries)); timelineCache.set(entries, index) }
  return index
}
export function getElementIndex(elements: readonly DocumentElement[]): ReadonlyMap<string, DocumentElement> {
  let index = elementCache.get(elements)
  if (!index) {
    const next = new Map<string, DocumentElement>()
    for (const element of elements) if (!next.has(element.id.toLowerCase())) next.set(element.id.toLowerCase(), element)
    elementCache.set(elements, next); index = next
  }
  return index
}

// Validation uses fresh indexes: untrusted callers need not obey immutability.
export function currentEntryIds(elements: readonly (DocumentElement | UIBoardElement)[]): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const element of elements) if (element.isUnit && element.operational.currentEntryId !== null) ids.add(element.operational.currentEntryId.toLowerCase())
  return ids
}
