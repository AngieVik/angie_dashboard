import type { AngieDocument, OperationalStatus, TimelineEntry } from '../../domain/document/types'
import { appendTimelineEntry } from '../../domain/operations/timelineEntries'
import { getCurrentEntryId, isCurrentTimelineEntry, isTimelineEntryDeleted } from '../../domain/operations/timelineProjection'

export function addManualTimelineEntry(document: AngieDocument, text: string, now: Date): TimelineEntry {
  const entry: TimelineEntry = { id: crypto.randomUUID(), type: 'manual', occurredAt: now.toISOString(), text, revisions: [] }
  document.timeline = appendTimelineEntry(document.timeline, entry)
  return entry
}
function manualEntry(document: AngieDocument, id: string) {
  const entry = document.timeline.find(entry => entry.id === id)
  if (entry?.type !== 'manual' || isTimelineEntryDeleted(entry)) throw new Error('Solo pueden editarse o eliminarse entradas manuales vigentes.')
  return entry
}
export function reviseTimelineText(document: AngieDocument, id: string, text: string, now: string): void {
  const entry = availableEntry(document, id)
  entry.revisions.push({ id: crypto.randomUUID(), kind: 'text', recordedAt: now, text })
}
function availableEntry(document: AngieDocument, id: string) {
  const entry = document.timeline.find(entry => entry.id.toLowerCase() === id.toLowerCase())
  if (!entry || isTimelineEntryDeleted(entry)) throw new Error('La entrada ya no está disponible.')
  return entry
}
export function editManualTimelineEntry(document: AngieDocument, id: string, text: string, now = new Date()) {
  manualEntry(document, id)
  reviseTimelineText(document, id, text, now.toISOString())
}
export function deleteManualTimelineEntry(document: AngieDocument, id: string, now = new Date()) {
  manualEntry(document, id)
  deleteTimelineEntry(document, id, now.toISOString())
}
export function deleteTimelineEntry(document: AngieDocument, id: string, now = new Date().toISOString()): void {
  const entry = availableEntry(document, id)
  entry.revisions.push({ id: crypto.randomUUID(), kind: 'delete', recordedAt: now })
  if (entry.type === 'status-change' && getCurrentEntryId(document, entry.unitId)?.toLowerCase() === entry.id.toLowerCase()) {
    const unit = document.elements.find(element => element.id.toLowerCase() === entry.unitId.toLowerCase())
    if (unit?.isUnit) Object.assign(unit.operational, { status: null, currentEntryId: null })
  }
}
export type CurrentStatusGuard = { currentEntryId: string; status: OperationalStatus; revisionCount: number }
export function correctCurrentStatusEntry(document: AngieDocument, id: string, expected: CurrentStatusGuard, now: string): void {
  const entry = availableEntry(document, id)
  if (entry.type !== 'status-change' || !isCurrentTimelineEntry(document, entry)
    || expected.currentEntryId.toLowerCase() !== entry.id.toLowerCase()
    || expected.status !== entry.nextStatus || expected.revisionCount !== entry.revisions.length) {
    throw new Error('La entrada cambió o dejó de ser Actual. Vuelve a abrir el editor antes de corregirla.')
  }
  const unit = document.elements.find(element => element.id.toLowerCase() === entry.unitId.toLowerCase())!
  entry.revisions.push({ id: crypto.randomUUID(), kind: 'correction', recordedAt: now })
  Object.assign(unit.operational!, { status: null, currentEntryId: null })
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
