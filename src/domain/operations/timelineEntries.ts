import type { TimelineEntry } from '../document/types'
import { compareUtcDates, latestDocumentTime } from '../document/documentTime'

export function nextTimelineEntryTime(entries: readonly TimelineEntry[], now: Date): string {
  const current = now.toISOString()
  return latestDocumentTime(entries.at(-1)?.occurredAt ?? current, current)
}
export function appendTimelineEntry(entries: TimelineEntry[], entry: TimelineEntry) {
  return [...entries, entry].sort((a, b) => compareUtcDates(a.occurredAt, b.occurredAt))
}
