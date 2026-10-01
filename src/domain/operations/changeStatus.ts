import { DOCUMENT_STATUSES } from '../document/types'
import type { AngieDocument, OperationalStatus, TimelineEntry } from '../document/types'
import { appendTimelineEntry } from './timelineEntries'

function statusChangeEntry(unitId: string, unitName: string, previousStatus: OperationalStatus, nextStatus: OperationalStatus, now: Date): TimelineEntry {
  return { id: crypto.randomUUID(), type: 'status-change', occurredAt: now.toISOString(), unitId, unitName, previousStatus, nextStatus }
}

export function changeElementStatus(document: AngieDocument, elementId: string, nextStatus: OperationalStatus, now: Date): AngieDocument {
  const unit = document.elements.find(element => element.id === elementId)
  if (!unit?.isUnit) throw new Error('La dotación ya no existe.')
  if (!DOCUMENT_STATUSES.includes(nextStatus)) throw new Error('Estado operativo desconocido.')
  if (unit.operational.status === nextStatus) return document
  const entry = statusChangeEntry(unit.id, unit.name, unit.operational.status, nextStatus, now)
  return {
    ...document,
    document: { ...document.document, updatedAt: entry.occurredAt < document.document.createdAt ? document.document.createdAt : entry.occurredAt },
    elements: document.elements.map(element => element.id === elementId && element.isUnit ? { ...element, operational: { ...element.operational, status: nextStatus } } : element),
    timeline: appendTimelineEntry(document.timeline, entry),
  }
}
