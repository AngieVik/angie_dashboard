import { OPERATIONAL_STATUSES } from './statuses'
import type { AngieDocument, OperationalStatus, TimelineEntry } from '../document/types'
import { getElementIndex, getTimelineIndex } from './operationIndexes'
import type { TimelineIndex } from './operationIndexes'

export function isTimelineEntryDeleted(entry: TimelineEntry): boolean {
  return entry.revisions.some(revision => revision.kind === 'delete')
}
export function isTimelineEntryCorrected(entry: TimelineEntry): boolean {
  return entry.revisions.some(revision => revision.kind === 'correction')
}
export function getTimelineEntryText(entry: TimelineEntry): string | null {
  const revision = entry.revisions.findLast(revision => revision.kind === 'text')
  return revision?.kind === 'text' ? revision.text : entry.type === 'manual' ? entry.text : null
}
export function getCurrentEntryId(document: AngieDocument, unitId: string): string | null {
  const unit = getElementIndex(document.elements).get(unitId.toLowerCase())
  return unit?.isUnit ? unit.operational.currentEntryId : null
}
export function projectUnitStatus(entries: readonly TimelineEntry[], unitId: string, currentEntryId: string | null, index?: TimelineIndex): OperationalStatus | null {
  if (currentEntryId === null) return null
  const entry = (index ?? getTimelineIndex(entries)).byId.get(currentEntryId.toLowerCase())
  return entry?.type === 'status-change' && entry.unitId.toLowerCase() === unitId.toLowerCase()
    && !isTimelineEntryDeleted(entry) && !isTimelineEntryCorrected(entry) ? entry.nextStatus : null
}

export function isCurrentTimelineEntry(document: AngieDocument, entry: TimelineEntry): boolean {
  if (entry.type !== 'status-change' || isTimelineEntryDeleted(entry) || isTimelineEntryCorrected(entry)) return false
  const unit = getElementIndex(document.elements).get(entry.unitId.toLowerCase())
  return Boolean(unit?.isUnit && unit.operational.currentEntryId?.toLowerCase() === entry.id.toLowerCase()
    && unit.operational.status === entry.nextStatus)
}
export function getTimelineEntryLabel(entry: TimelineEntry): string {
  const text = getTimelineEntryText(entry)
  if (text !== null) return text
  if (entry.type === 'manual') return entry.text
  if (entry.nextStatus === 'Personalizada') return `${entry.unitName} · ${entry.customLabel ?? 'Personalizada'}`
  return `${entry.unitName} · ${entry.nextStatus} ${OPERATIONAL_STATUSES.find(item => item.status === entry.nextStatus)!.icon}`
}
