import { MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId, ModuleLayout, Size } from './layoutTypes'

type Module = { id: ModuleId; layout: ModuleLayout }

export function repositionModules(open: readonly Module[], visible: Size): Module[] {
  if (![visible.width, visible.height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Superficie de recolocación inválida')
  if (!open.length) return []
  const pixels = (value: number) => Math.max(1, Math.floor(value + 1e-7))
  const order = Object.keys(MODULE_REGISTRY) as ModuleId[]
  const stable = [...open].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  const sequences = [stable, [...stable].sort((a, b) => b.layout.height - a.layout.height), [...stable].sort((a, b) => b.layout.width - a.layout.width)]
  function pack(sequence: readonly Module[]): Module[] | null {
    const placed: Module[] = []
    for (const { id, layout } of sequence) {
      const xs = [0, ...placed.map(item => item.layout.x + item.layout.width)]
      const ys = [0, ...placed.map(item => item.layout.y + item.layout.height)].sort((a, b) => a - b)
      let position: { x: number; y: number } | undefined
      for (const y of ys) {
        for (const x of xs.sort((a, b) => a - b)) {
          if (x + layout.width > visible.width || y + layout.height > visible.height) continue
          if (placed.every(({ layout: other }) => x + layout.width <= other.x || other.x + other.width <= x || y + layout.height <= other.y || other.y + other.height <= y)) {
            position = { x, y }; break
          }
        }
        if (position) break
      }
      if (!position) return null
      placed.push({ id, layout: { ...layout, ...position, referenceSize: { width: Math.ceil(visible.width), height: Math.ceil(visible.height) } } })
    }
    return placed
  }
  let best: { rows: Module[][]; scale: number; width: number; waste: number } | undefined
  // There are at most ten modules. Compare all row breaks to avoid greedy gaps.
  for (const sequence of sequences) for (let mask = 0; mask < 2 ** (sequence.length - 1); mask++) {
    const rows: Module[][] = [[]]
    sequence.forEach((module, index) => {
      if (index > 0 && (mask & (1 << (index - 1)))) rows.push([])
      rows.at(-1)!.push(module)
    })
    const width = Math.max(...rows.map(row => row.reduce((sum, item) => sum + item.layout.width, 0)))
    const height = rows.reduce((sum, row) => sum + Math.max(...row.map(item => item.layout.height)), 0)
    let scale = Math.min(1, visible.width / width, visible.height / height)
    const fits = (value: number) => rows.every(row => row.reduce((sum, item) => sum + pixels(item.layout.width * value), 0) <= visible.width) &&
      rows.reduce((sum, row) => sum + pixels(Math.max(...row.map(item => item.layout.height)) * value), 0) <= visible.height
    if (!fits(0)) continue
    if (!fits(scale)) {
      let low = 0, high = scale
      for (let step = 0; step < 40; step++) {
        const middle = (low + high) / 2
        if (fits(middle)) low = middle; else high = middle
      }
      scale = low
    }
    const area = sequence.reduce((sum, item) => sum + item.layout.width * item.layout.height, 0)
    const waste = width * height - area
    if (!best || scale > best.scale + 1e-8 || (Math.abs(scale - best.scale) < 1e-8 && waste < best.waste)) best = { rows, scale, width, waste }
  }
  if (!best) throw new Error('Superficie de recolocación insuficiente')
  if (best.scale < 1) for (const sequence of sequences) {
    const packed = pack(sequence)
    if (packed) return packed
  }
  const { rows, scale, width } = best
  let y = 0
  const result = rows.flatMap(row => {
    const height = Math.max(...row.map(item => item.layout.height))
    const rowWidth = row.reduce((sum, item) => sum + item.layout.width, 0)
    const widthAdjustment = width / rowWidth <= 1.2 ? width / rowWidth : 1
    let x = 0
    const placed = row.map(({ id, layout }) => {
      const next = { ...layout, x, y, width: pixels(layout.width * scale * widthAdjustment),
        height: pixels((height <= layout.height * 1.2 ? height : layout.height) * scale),
        referenceSize: { width: Math.ceil(visible.width), height: Math.ceil(visible.height) } }
      x += next.width
      return { id, layout: next }
    })
    y += pixels(height * scale)
    return placed
  })
  return pack(result) ?? result
}
