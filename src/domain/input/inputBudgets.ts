import type { ValidationIssue } from '../document/types'

// Política de admisión, compartida por las funciones de edición, importación, recuperación y serialización.
// La longitud del texto se mide en unidades UTF-16, al igual que las entradas DOM y el analizador de coordenadas.
// 100 000 por campo / 1 millón en total mantienen el texto ordinario por debajo del caso de lentitud de 8 millones de la auditoría.
// La auditoría del 1 de noviembre de 2026 midió diez ediciones en la tienda en unos 58 ms para 1 millón de caracteres,
// frente a unos 465 ms para 8 millones, antes del trabajo adicional de varios segundos de la interfaz de usuario.
// Mantener los límites actuales de 50 MiB para imágenes, 10 MiB para GPX y 50k para los contratos de trazos de planos.
// JSON cuenta con una comprobación previa de bytes; el contrato de datos también limita todo el texto y las colecciones.
// Se trata de límites máximos de capacidad, no de una garantía de latencia en Android.
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
  // Capacidad de admisión previa a la decodificación: como máximo 64 MiB para una superficie RGBA de 8-bits.
  // Los búferes del decodificador, los metadatos y el mapa de bits redimensionado pueden requerir más memoria.
  imageDimension: 8192,
  imagePixels: 16_777_216,
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

export function checkImageDimensions(width: number, height: number): void {
  if (![width, height].every(value => Number.isSafeInteger(value) && value > 0)) {
    throw new InputBudgetError({ path: 'image', message: 'No se pudieron comprobar las dimensiones de la imagen. Se conserva el fondo anterior.' })
  }
  if (width > INPUT_BUDGETS.imageDimension || height > INPUT_BUDGETS.imageDimension || width * height > INPUT_BUDGETS.imagePixels) {
    throw new InputBudgetError({ path: 'image', message: `La imagen supera el límite de ${INPUT_BUDGETS.imageDimension} píxeles por lado o ${INPUT_BUDGETS.imagePixels} píxeles totales. Se conserva el fondo anterior.` })
  }
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

// Contar UTF-8 sin asignar un segundo búfer del tamaño del archivo importado.
export function checkTextBytes(text: string, kind: 'json' | 'gpx'): void {
  // Una unidad UTF-16 se codifica en un máximo de tres bytes UTF-8 (un par sustituto, en cuatro). Por lo tanto, los documentos pequeños no necesitan asignación de codificación alguna.
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

/** Comprobación previa limitada antes de AJV, clonación o referencias cruzadas semánticas. Nunca modifica los datos de entrada. */
export function checkDocumentBudget(input: unknown): ValidationIssue | null {
  let text = 0, items = 0, points = 0, objects = 0, properties = 0, gpxBytes = 0
  const seen = new WeakSet<object>()
  function visit(value: unknown, path: string, depth: number, point = false): ValidationIssue | null {
    if (depth > INPUT_BUDGETS.depth) return budgetIssue(path, INPUT_BUDGETS.depth, 'niveles de profundidad')
    if (typeof value === 'string') {
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
        // Los escalares de puntos ya cuentan con un presupuesto agregado independiente. Desconocido
        // Los campos de punto siguen contando, por lo que los objetos con formato incorrecto no pueden eludir esta restricción.
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
        // Las claves desconocidas siguen estando restringidas antes del rechazo del esquema.
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
