import type { AngieDocument, TimelineEntry } from '../../domain/document/types'
import { appendTimelineEntry } from '../../domain/operations/timelineEntries'
import { getCurrentEntryId, isTimelineEntryCorrected, isTimelineEntryDeleted } from '../../domain/operations/timelineProjection'
export type UndoResult = { success: true; document: AngieDocument } | { success: false; message: string }

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
export function editManualTimelineEntry(document: AngieDocument, id: string, text: string, now = new Date()) {
  manualEntry(document, id).revisions.push({ id: crypto.randomUUID(), kind: 'text', recordedAt: now.toISOString(), text })
}
export function deleteManualTimelineEntry(document: AngieDocument, id: string, now = new Date()) {
  manualEntry(document, id).revisions.push({ id: crypto.randomUUID(), kind: 'delete', recordedAt: now.toISOString() })
}
export function deleteTimelineEntry(document: AngieDocument, id: string, now = new Date()) {
  const entry = document.timeline.find(entry => entry.id === id)
  if (!entry || isTimelineEntryDeleted(entry)) throw new Error('La entrada ya no está disponible.')
  entry.revisions.push({ id: crypto.randomUUID(), kind: 'delete', recordedAt: now.toISOString() })
  if (entry.type === 'status-change' && getCurrentEntryId(document, entry.unitId)?.toLowerCase() === entry.id.toLowerCase()) {
    const unit = document.elements.find(element => element.id.toLowerCase() === entry.unitId.toLowerCase())
    if (unit?.isUnit) Object.assign(unit.operational, { status: null, currentEntryId: null })
  }
}
export function canUndoAutomaticTimelineEntry(document: AngieDocument, id: string) {
  const entry = document.timeline.find(entry => entry.id === id)
  if (entry?.type !== 'status-change' || isTimelineEntryDeleted(entry) || isTimelineEntryCorrected(entry)) return false
  const unitId = entry.unitId.toLowerCase()
  const unit = document.elements.find(element => element.id.toLowerCase() === unitId)
  if (!unit?.isUnit || unit.operational.status !== entry.nextStatus) return false
  return unit.operational.currentEntryId?.toLowerCase() === id.toLowerCase()
}
export function undoAutomaticTimelineEntry(document: AngieDocument, id: string): UndoResult {
  if (!canUndoAutomaticTimelineEntry(document, id)) return { success: false, message: 'No se puede deshacer este cambio de estado.' }
  const entry = document.timeline.find(entry => entry.id === id)!
  if (entry.type !== 'status-change') return { success: false, message: 'La entrada no es automática.' }
  const now = new Date().toISOString()
  return { success: true, document: {
    ...document,
    document: { ...document.document, updatedAt: now < document.document.createdAt ? document.document.createdAt : now },
    elements: document.elements.map(element => element.id.toLowerCase() === entry.unitId.toLowerCase() && element.isUnit ? { ...element, operational: { ...element.operational, status: null, currentEntryId: null } } : element),
    timeline: document.timeline.map(candidate => candidate.id === id ? { ...candidate, revisions: [...candidate.revisions, { id: crypto.randomUUID(), kind: 'correction', recordedAt: now }] } : candidate),
  } }
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
