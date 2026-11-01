import type { ValidationIssue } from '../document/types'

// Admission policy, shared by editing, imports, recovery and serialization.
// Text lengths use UTF-16 units, as DOM inputs and the coordinate parser do.
// 100k per field / 1M total keep ordinary text below the audit's 8M slow case.
// The 2026-11-01 audit measured ten store edits at ~58 ms for 1M characters
// versus ~465 ms for 8M, before the UI's additional multi-second work.
// Preserve the existing 50 MiB image, 10 MiB GPX and 50k plan-stroke contracts.
// 80 MiB JSON leaves room for the 66.7 MiB base64 image plus document content.
// These are capacity ceilings, not a latency guarantee on Android.
export const INPUT_BUDGETS = Object.freeze({
  coordinateCharacters: 1024,
  textCharacters: 100_000,
  totalTextCharacters: 1_000_000,
  collectionItems: 2000,
  totalCollectionItems: 10_000,
  strokePoints: 50_000,
  totalStrokePoints: 150_000,
  revisions: 100,
  gpxFiles: 20,
  gpxPoints: 150_000,
  totalGpxPoints: 150_000,
  gpxNameCharacters: 200,
  gpxBytes: 10 * 1024 * 1024,
  totalGpxBytes: 50 * 1024 * 1024,
  imageBytes: 50 * 1024 * 1024,
  jsonBytes: 80 * 1024 * 1024,
  objects: 50_000,
  properties: 100_000,
  depth: 32,
})

export function budgetIssue(path: string, limit: number, unit: string): ValidationIssue {
  return { path, message: `${path}: límite de ${limit} ${unit}. Se conserva el contenido anterior.` }
}

export class InputBudgetError extends Error {
  constructor(readonly issue: ValidationIssue) { super(issue.message); this.name = 'InputBudgetError' }
}

export type InputFileKind = 'json' | 'gpx' | 'image'
export function checkFileBytes(size: number, kind: InputFileKind): void {
  const limit = INPUT_BUDGETS[`${kind}Bytes`]
  if (!Number.isSafeInteger(size) || size < 0) throw new InputBudgetError({ path: kind, message: `${kind}: no se pudo comprobar el tamaño. Se conserva el contenido anterior.` })
  if (size > limit) throw new InputBudgetError(budgetIssue(kind, limit / (1024 * 1024), 'MiB'))
}

export function checkGpxPointTotal(files: readonly { fingerprint: string; data: { pointCount: number } }[]): void {
  let count = 0
  const fingerprints = new Set<string>()
  for (const file of files) {
    if (fingerprints.has(file.fingerprint)) continue
    fingerprints.add(file.fingerprint)
    count += file.data.pointCount
    if (count > INPUT_BUDGETS.totalGpxPoints) throw new InputBudgetError(budgetIssue('map.gpx', INPUT_BUDGETS.totalGpxPoints, 'puntos en total'))
  }
}

// Count UTF-8 without allocating a second buffer the size of an imported file.
export function checkTextBytes(text: string, kind: 'json' | 'gpx'): void {
  // A UTF-16 unit encodes to at most three UTF-8 bytes (a surrogate pair to
  // four). Small documents therefore need no encoding allocation at all.
  if (text.length * 3 <= INPUT_BUDGETS[`${kind}Bytes`]) return
  let bytes = 0
  const encoder = new TextEncoder()
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 16_384, text.length)
    if (end < text.length && text.charCodeAt(end - 1) >= 0xD800 && text.charCodeAt(end - 1) <= 0xDBFF) end--
    bytes += encoder.encode(text.slice(start, end)).byteLength
    checkFileBytes(bytes, kind)
    start = end
  }
}

/** Bounded preflight before AJV, cloning or semantic cross-references. Never edits input. */
export function checkDocumentBudget(input: unknown): ValidationIssue | null {
  let text = 0, items = 0, points = 0, objects = 0, properties = 0, gpxBytes = 0
  const seen = new WeakSet<object>()
  function visit(value: unknown, path: string, depth: number, point = false): ValidationIssue | null {
    if (depth > INPUT_BUDGETS.depth) return budgetIssue(path, INPUT_BUDGETS.depth, 'niveles de profundidad')
    if (typeof value === 'string') {
      if (path === 'board.backgroundImage.dataUrl') {
        const comma = value.indexOf(',')
        const length = value.length - comma - 1
        const bytes = length / 4 * 3 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0)
        if (bytes > INPUT_BUDGETS.imageBytes) return budgetIssue('image', INPUT_BUDGETS.imageBytes / (1024 * 1024), 'MiB')
        return null // Signature and base64 syntax belong to the document validator.
      }
      const limit = /^map\.(?:markers|gpx)\[\d+\]\.name$/.test(path) ? INPUT_BUDGETS.gpxNameCharacters : INPUT_BUDGETS.textCharacters
      if (value.length > limit) return budgetIssue(path, limit, 'caracteres')
      text += value.length
      return text > INPUT_BUDGETS.totalTextCharacters ? budgetIssue('$', INPUT_BUDGETS.totalTextCharacters, 'caracteres de texto en total') : null
    }
    if (!value || typeof value !== 'object') return null
    if (seen.has(value)) return { path, message: `${path}: el documento contiene referencias circulares. Se conserva el contenido anterior.` }
    seen.add(value)
    if (Array.isArray(value)) {
      const isPoints = /^(board|plan)\.strokes\[\d+\]\.points$/.test(path)
      const limit = isPoints ? INPUT_BUDGETS.strokePoints : path === 'map.gpx' ? INPUT_BUDGETS.gpxFiles
        : /\.revisions$/.test(path) ? INPUT_BUDGETS.revisions : INPUT_BUDGETS.collectionItems
      if (value.length > limit) return budgetIssue(path, limit, isPoints ? 'puntos' : 'entradas')
      if (isPoints) points += value.length
      else items += value.length
      if (points > INPUT_BUDGETS.totalStrokePoints) return budgetIssue('$', INPUT_BUDGETS.totalStrokePoints, 'puntos de trazos en total')
      if (items > INPUT_BUDGETS.totalCollectionItems) return budgetIssue('$', INPUT_BUDGETS.totalCollectionItems, 'entradas de colecciones en total')
      for (let index = 0; index < value.length; index++) {
        const issue = visit(value[index], `${path}[${index}]`, depth + 1, isPoints)
        if (issue) return issue
      }
    } else {
      if (!point && ++objects > INPUT_BUDGETS.objects) return budgetIssue('$', INPUT_BUDGETS.objects, 'objetos')
      for (const key in value) {
        if (!Object.hasOwn(value, key)) continue
        // Point scalars already have a separate aggregate budget. Unknown
        // point fields still count, so malformed objects cannot bypass this.
        if (!(point && ['x', 'y', 'latitude', 'longitude'].includes(key)) && ++properties > INPUT_BUDGETS.properties) {
          return budgetIssue('$', INPUT_BUDGETS.properties, 'propiedades')
        }
        const field = path === '$' ? key : `${path}.${key}`
        const child = (value as Record<string, unknown>)[key]
        if (/^map\.gpx\[\d+\]\.size$/.test(field) && typeof child === 'number') {
          if (child > INPUT_BUDGETS.gpxBytes) return budgetIssue('gpx', INPUT_BUDGETS.gpxBytes / (1024 * 1024), 'MiB')
          gpxBytes += child > 0 ? child : 0
          if (gpxBytes > INPUT_BUDGETS.totalGpxBytes) return budgetIssue('map.gpx', INPUT_BUDGETS.totalGpxBytes / (1024 * 1024), 'MiB en total')
        }
        // Unknown keys are still bounded before schema rejection.
        if (key.length > INPUT_BUDGETS.textCharacters) return budgetIssue(path, INPUT_BUDGETS.textCharacters, 'caracteres por clave')
        const issue = visit(child, field, depth + 1)
        if (issue) return issue
      }
    }
    seen.delete(value)
    return null
  }
  return visit(input, '$', 0)
}
