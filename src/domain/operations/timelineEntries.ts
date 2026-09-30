import type { TimelineEntry } from '../document/types'

// Imported UTC instants may have a fraction finer than Date's milliseconds.
function compareInstants(left: string, right: string) {
  const secondsLeft = left.slice(0, 19), secondsRight = right.slice(0, 19)
  if (secondsLeft !== secondsRight) return secondsLeft < secondsRight ? -1 : 1
  const fractionLeft = left[19] === '.' ? left.slice(20, -1) : ''
  const fractionRight = right[19] === '.' ? right.slice(20, -1) : ''
  const length = Math.max(fractionLeft.length, fractionRight.length)
  const a = fractionLeft.padEnd(length, '0'), b = fractionRight.padEnd(length, '0')
  return a === b ? 0 : a < b ? -1 : 1
}
export function appendTimelineEntry(entries: TimelineEntry[], entry: TimelineEntry) {
  return [...entries, entry].sort((a, b) => compareInstants(a.occurredAt, b.occurredAt))
}
