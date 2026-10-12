import { DOCUMENT_STATUSES } from '../document/types'
import type { AngieDocument, OperationalStatus, TimelineEntry } from '../document/types'
import { appendTimelineEntry } from './timelineEntries'

function statusChangeEntry(unitId: string, unitName: string, previousStatus: OperationalStatus | null, nextStatus: OperationalStatus, now: Date): TimelineEntry {
  return { id: crypto.randomUUID(), type: 'status-change', occurredAt: now.toISOString(), unitId, unitName, previousStatus, nextStatus, revisions: [] }
}

export function changeElementStatus(document: AngieDocument, elementId: string, nextStatus: OperationalStatus, now: Date): AngieDocument {
  const unit = document.elements.find(element => element.id === elementId)
  if (!unit?.isUnit) throw new Error('La dotación ya no existe.')
  if (nextStatus !== 'Personalizada' && !DOCUMENT_STATUSES.includes(nextStatus)) throw new Error('Estado operativo desconocido.')
  const customLabel = nextStatus === 'Personalizada' ? unit.operational.notes.trim() : undefined
  const customColor = nextStatus === 'Personalizada' ? unit.operational.notesColor : undefined
  if (nextStatus === 'Personalizada' && !customLabel) throw new Error('Escribe el nombre del estado personalizado.')
  const current = document.timeline.find(entry => entry.id.toLowerCase() === unit.operational.currentEntryId?.toLowerCase())
  if (unit.operational.status === nextStatus && (nextStatus !== 'Personalizada' || current?.type === 'status-change' && current.customLabel === customLabel && current.customColor === customColor)) return document
  const entry = statusChangeEntry(unit.id, unit.name, unit.operational.status, nextStatus, now)
  if (entry.type === 'status-change' && customLabel) {
    entry.customLabel = customLabel
    if (customColor) entry.customColor = customColor
  }
  return {
    ...document,
    document: { ...document.document, updatedAt: entry.occurredAt < document.document.createdAt ? document.document.createdAt : entry.occurredAt },
    elements: document.elements.map(element => element.id === elementId && element.isUnit ? { ...element, operational: { ...element.operational, status: nextStatus, currentEntryId: entry.id } } : element),
    timeline: appendTimelineEntry(document.timeline, entry),
  }
}
