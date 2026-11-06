// Manual profiling in development. Keep only the latest sample per operation;
// no document contents, console output or unbounded history.
type WorkMetric = 'document.edit' | 'document.budget' | 'document.capture' | 'document.validate' | 'document.stringify'
  | 'operations.timeline-index' | 'gpx.selection' | 'gpx.selection-batch'

export function startWorkMetric(name: WorkMetric) {
  const start = import.meta.env.DEV ? performance.now() : 0
  return (detail?: Record<string, number | boolean>) => {
    if (!import.meta.env.DEV) return
    const key = `angie.${name}`
    performance.clearMeasures(key)
    performance.measure(key, { start, end: performance.now(), detail })
  }
}

export function measureWork<T>(name: WorkMetric, work: () => T): T {
  const finish = startWorkMetric(name)
  try { return work() } finally { finish() }
}
