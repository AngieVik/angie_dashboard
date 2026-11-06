// Compare UTC timestamps without losing fractional precision or leap seconds.
export function compareUtcDates(left: string, right: string): number {
  const leftSeconds = left.slice(0, 19), rightSeconds = right.slice(0, 19)
  if (leftSeconds !== rightSeconds) return leftSeconds < rightSeconds ? -1 : 1
  const fraction = (date: string) => date[19] === '.' ? date.slice(20, -1) : ''
  const a = fraction(left), b = fraction(right), length = Math.max(a.length, b.length)
  const paddedLeft = a.padEnd(length, '0'), paddedRight = b.padEnd(length, '0')
  return paddedLeft === paddedRight ? 0 : paddedLeft < paddedRight ? -1 : 1
}

export function latestDocumentTime(previous: string, current: string): string {
  return compareUtcDates(current, previous) > 0 ? current : previous
}
