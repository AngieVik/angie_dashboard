import type { AngieDocument, OperationalStatus, TimelineEntry, TimelineRevision } from '../../domain/document/types'
import { commandResult } from '../../domain/document/documentCommand'
import { appendTimelineEntry } from '../../domain/operations/timelineEntries'
import { getCurrentEntryId, getTimelineEntryLabel, isCurrentTimelineEntry, isTimelineEntryDeleted } from '../../domain/operations/timelineProjection'

export function addManualTimelineEntry(document: AngieDocument, text: string, now: Date) {
  const entry: TimelineEntry = { id: crypto.randomUUID(), type: 'manual', occurredAt: now.toISOString(), text, revisions: [] }
  return commandResult(document, { ...document, timeline: appendTimelineEntry(document.timeline, entry) }, entry)
}
function manualEntry(document: AngieDocument, id: string) {
  const entry = document.timeline.find(entry => entry.id === id)
  if (entry?.type !== 'manual' || isTimelineEntryDeleted(entry)) throw new Error('Solo pueden editarse o eliminarse entradas manuales vigentes.')
  return entry
}
export function reviseTimelineText(document: AngieDocument, id: string, text: string, now: string) {
  const entry = availableEntry(document, id)
  if (getTimelineEntryLabel(entry) === text) return commandResult(document, document)
  return commandResult(document, appendRevision(document, entry, { id: crypto.randomUUID(), kind: 'text', recordedAt: now, text }))
}
function availableEntry(document: AngieDocument, id: string) {
  const entry = document.timeline.find(entry => entry.id.toLowerCase() === id.toLowerCase())
  if (!entry || isTimelineEntryDeleted(entry)) throw new Error('La entrada ya no está disponible.')
  return entry
}
export function editManualTimelineEntry(document: AngieDocument, id: string, text: string, now = new Date()) {
  manualEntry(document, id)
  return reviseTimelineText(document, id, text, now.toISOString())
}
export function deleteManualTimelineEntry(document: AngieDocument, id: string, now = new Date()) {
  manualEntry(document, id)
  return deleteTimelineEntry(document, id, now.toISOString())
}
function appendRevision(document: AngieDocument, entry: TimelineEntry, revision: TimelineRevision): AngieDocument {
  return { ...document, timeline: document.timeline.map(item => item === entry ? { ...entry, revisions: [...entry.revisions, revision] } : item) }
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
export type CurrentStatusGuard = { currentEntryId: string; status: OperationalStatus; revisionCount: number }
export function correctCurrentStatusEntry(document: AngieDocument, id: string, expected: CurrentStatusGuard, now: string) {
  const entry = availableEntry(document, id)
  if (entry.type !== 'status-change' || !isCurrentTimelineEntry(document, entry)
    || expected.currentEntryId.toLowerCase() !== entry.id.toLowerCase()
    || expected.status !== entry.nextStatus || expected.revisionCount !== entry.revisions.length) {
    throw new Error('La entrada cambió o dejó de ser Actual. Vuelve a abrir el editor antes de corregirla.')
  }
  const next = appendRevision(document, entry, { id: crypto.randomUUID(), kind: 'correction', recordedAt: now })
  return commandResult(document, clearCurrentStatus(next, entry.unitId))
}
const spanishTime = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const spanishDate = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
function formatSpanishInstant(time: string, formatter: Intl.DateTimeFormat) {
  // JSON Schema accepts leap seconds, which Date cannot represent. Use the
  // preceding second for the timezone/date, preserving 60 in the display.
  const leapSecond = time.slice(17, 19) === '60'
  const instant = new Date(leapSecond ? `${time.slice(0, 17)}59${time.slice(19)}` : time)
  return leapSecond ? formatter.formatToParts(instant).map(part => part.type === 'second' ? '60' : part.value).join('') : formatter.format(instant)
}
export function formatTimelineTime(time: string) { return formatSpanishInstant(time, spanishTime) }
export function formatTimelineDate(time: string) { return formatSpanishInstant(time, spanishDate) }
