import { formatInstant } from '@/platform/formatting'
import { defaultFormatPreferences } from '../settings/formatPreferences'
import type { FormatPreferences } from '../settings/formatPreferences'
import type { AngieDocument, TimelineEntry, TimelineRevision } from '../../domain/document/types'
import { commandResult } from '../../domain/document/documentCommand'
import { latestDocumentTime } from '../../domain/document/documentTime'
import { appendTimelineEntry, nextTimelineEntryTime } from '../../domain/operations/timelineEntries'
import { getCurrentEntryId, getTimelineEntryLabel, isTimelineEntryDeleted } from '../../domain/operations/timelineProjection'
import { getTimelineIndex } from '../../domain/operations/operationIndexes'

export function addManualTimelineEntry(document: AngieDocument, text: string, now: Date) {
  const entry: TimelineEntry = { id: crypto.randomUUID(), type: 'manual', occurredAt: nextTimelineEntryTime(document.timeline, now), text, revisions: [] }
  return commandResult(document, { ...document, timeline: appendTimelineEntry(document.timeline, entry) }, entry)
}
export function reviseTimelineText(document: AngieDocument, id: string, text: string, now: string) {
  const entry = availableEntry(document, id)
  if (getTimelineEntryLabel(entry) === text) return commandResult(document, document)
  return commandResult(document, appendRevision(document, entry, { id: crypto.randomUUID(), kind: 'text', recordedAt: now, text }))
}
function availableEntry(document: AngieDocument, id: string) {
  const entry = getTimelineIndex(document.timeline).byId.get(id.toLowerCase())
  if (!entry || isTimelineEntryDeleted(entry)) throw new Error('La entrada ya no está disponible.')
  return entry
}
function appendRevision(document: AngieDocument, entry: TimelineEntry, revision: TimelineRevision): AngieDocument {
  const recordedAt = latestDocumentTime(entry.revisions.at(-1)?.recordedAt ?? revision.recordedAt, revision.recordedAt)
  return { ...document, timeline: document.timeline.map(item => item === entry ? { ...entry, revisions: [...entry.revisions, { ...revision, recordedAt }] } : item) }
}
function clearCurrentStatus(document: AngieDocument, unitId: string): AngieDocument {
  return { ...document, elements: document.elements.map(unit => unit.id.toLowerCase() === unitId.toLowerCase() && unit.isUnit
    ? { ...unit, operational: { ...unit.operational, status: null, currentEntryId: null } } : unit) }
}
export function deleteTimelineEntry(document: AngieDocument, id: string, now = new Date().toISOString()) {
  const entry = availableEntry(document, id)
  let next = appendRevision(document, entry, { id: crypto.randomUUID(), kind: 'delete', recordedAt: now })
  if (entry.type === 'status-change' && getCurrentEntryId(document, entry.unitId)?.toLowerCase() === entry.id.toLowerCase()) {
    next = clearCurrentStatus(next, entry.unitId)
  }
  return commandResult(document, next)
}
export function formatTimelineTime(time: string, formats: FormatPreferences = defaultFormatPreferences()) { return formatInstant(time, formats, { date: false, timeZone: 'Europe/Madrid' }) }
export function formatTimelineDate(time: string, formats: FormatPreferences = defaultFormatPreferences()) { return formatInstant(time, formats, { timeZone: 'Europe/Madrid' }) }
