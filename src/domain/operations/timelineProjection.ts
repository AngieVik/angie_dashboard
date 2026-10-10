import { OPERATIONAL_STATUSES } from './statuses'
import type { AngieDocument, OperationalStatus, TimelineEntry } from '../document/types'

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
  const unit = document.elements.find(element => element.id.toLowerCase() === unitId.toLowerCase())
  return unit?.isUnit ? unit.operational.currentEntryId : null
}
export function projectUnitStatus(entries: readonly TimelineEntry[], unitId: string, currentEntryId: string | null): OperationalStatus | null {
  if (currentEntryId === null) return null
  const entry = entries.find(entry => entry.id.toLowerCase() === currentEntryId.toLowerCase())
  return entry?.type === 'status-change' && entry.unitId.toLowerCase() === unitId.toLowerCase()
    && !isTimelineEntryDeleted(entry) && !isTimelineEntryCorrected(entry) ? entry.nextStatus : null
}

export function isCurrentTimelineEntry(document: AngieDocument, entry: TimelineEntry): boolean {
  if (entry.type !== 'status-change' || isTimelineEntryDeleted(entry) || isTimelineEntryCorrected(entry)) return false
  const unit = document.elements.find(element => element.id.toLowerCase() === entry.unitId.toLowerCase())
  return Boolean(unit?.isUnit && unit.operational.currentEntryId?.toLowerCase() === entry.id.toLowerCase()
    && unit.operational.status === entry.nextStatus)
}
export function getTimelineEntryLabel(entry: TimelineEntry): string {
  const text = getTimelineEntryText(entry)
  if (text !== null) return text
  if (entry.type === 'manual') return entry.text
  const previous = entry.previousStatus === null ? 'Sin estado' : `${entry.previousStatus} ${OPERATIONAL_STATUSES.find(item => item.status === entry.previousStatus)!.icon}`
  return `${entry.unitName} · ${previous} → ${entry.nextStatus} ${OPERATIONAL_STATUSES.find(item => item.status === entry.nextStatus)!.icon}`
}
