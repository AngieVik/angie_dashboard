import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { ErrorObject } from 'ajv'
import schema from './schema/angie-document-v4.schema.json'
import type { AngieDocumentV4, ValidationIssue, ValidationResult } from './types'
import { isTimelineEntryDeleted, isTimelineEntryCorrected, projectUnitStatus } from '../operations/timelineProjection'

const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  strictNumbers: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  ownProperties: true,
})
addFormats(ajv)
const validateSchema = ajv.compile<AngieDocumentV4>(schema)

function issueFromSchema(error: ErrorObject): ValidationIssue {
  const parts = error.instancePath.split('/').slice(1).map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'))
  if (error.keyword === 'required') parts.push(String(error.params.missingProperty))
  if (error.keyword === 'additionalProperties') parts.push(String(error.params.additionalProperty))
  const path = parts.reduce((result, part) => /^\d+$/.test(part)
    ? `${result}[${part}]`
    : `${result}${result ? '.' : ''}${part}`, '') || '$'
  const messages: Record<string, string> = {
    required: 'es obligatorio',
    additionalProperties: 'no es una propiedad permitida',
    type: `debe ser de tipo ${String(error.params.type)}`,
    const: `debe ser ${JSON.stringify(error.params.allowedValue)}`,
    enum: `debe ser uno de ${JSON.stringify(error.params.allowedValues)}`,
    minimum: `debe ser mayor o igual que ${String(error.params.limit)}`,
    maximum: `debe ser menor o igual que ${String(error.params.limit)}`,
    exclusiveMinimum: `debe ser mayor que ${String(error.params.limit)}`,
    minLength: 'no puede estar vacío',
    minItems: `debe contener al menos ${String(error.params.limit)} ítem(s)`,
    uniqueItems: 'no puede contener duplicados',
    pattern: 'no cumple el formato requerido',
    format: `debe tener formato ${String(error.params.format)}`,
    oneOf: 'debe coincidir con una única variante permitida',
    if: 'no cumple la relación condicional requerida',
  }
  return { path, message: `${path} ${messages[error.keyword] ?? 'no cumple el esquema V4'}` }
}

// Compare the complete UTC instant, including fractions finer than milliseconds.
function compareUtcDates(left: string, right: string): number {
  const leftSeconds = left.slice(0, 19)
  const rightSeconds = right.slice(0, 19)
  if (leftSeconds !== rightSeconds) return leftSeconds < rightSeconds ? -1 : 1
  const fraction = (date: string) => date[19] === '.' ? date.slice(20, -1) : ''
  const leftFraction = fraction(left)
  const rightFraction = fraction(right)
  const length = Math.max(leftFraction.length, rightFraction.length)
  const a = leftFraction.padEnd(length, '0')
  const b = rightFraction.padEnd(length, '0')
  return a === b ? 0 : a < b ? -1 : 1
}

export function validateDocument(input: unknown): ValidationResult<AngieDocumentV4> {
  if (!validateSchema(input)) {
    return { success: false, errors: (validateSchema.errors ?? []).map(issueFromSchema) }
  }

  const errors: ValidationIssue[] = []
  const add = (path: string, message: string) => errors.push({ path, message: `${path} ${message}` })
  const image = input.board.backgroundImage
  if (image) {
    try {
      const base64 = image.dataUrl.slice(image.dataUrl.indexOf(',') + 1)
      const prefix = atob(base64.slice(0, 16))
      const png = image.dataUrl.startsWith('data:image/png;')
      const valid = png ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => prefix.charCodeAt(index) === byte)
        : prefix.charCodeAt(0) === 255 && prefix.charCodeAt(1) === 216 && prefix.charCodeAt(2) === 255
      const byteLength = base64.length / 4 * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
      if (!valid || base64.length % 4 !== 0 || byteLength > 50 * 1024 * 1024) add('board.backgroundImage.dataUrl', 'debe contener una imagen PNG o JPEG válida de hasta 50 MiB')
    } catch { add('board.backgroundImage.dataUrl', 'no contiene una imagen base64 válida') }
  }
  const ids = new Set<string>()
  const identify = (id: string, path: string) => {
    // UUID spelling is case-insensitive; references such as unitId are not owners.
    const key = id.toLowerCase()
    if (ids.has(key)) add(path, 'debe identificar un objeto distinto; el UUID está repetido')
    ids.add(key)
  }
  identify(input.document.id, 'document.id')
  input.board.strokes.forEach((stroke, index) => identify(stroke.id, `board.strokes[${index}].id`))
  input.board.quickNotes.forEach((note, index) => identify(note.id, `board.quickNotes[${index}].id`))
  if (compareUtcDates(input.document.updatedAt, input.document.createdAt) < 0) {
    add('document.updatedAt', 'no puede ser anterior a createdAt')
  }
  input.elements.forEach((element, index) => {
    identify(element.id, `elements[${index}].id`)
    if (!element.isUnit) return
    const tags = new Set<string>()
    element.operational.tags.forEach((tag, tagIndex) => {
      const key = tag.toLowerCase()
      if (tags.has(key)) add(`elements[${index}].operational.tags[${tagIndex}]`, 'no puede duplicar otra etiqueta sin distinguir mayúsculas')
      tags.add(key)
    })
    const { status, currentEntryId } = element.operational
    const path = `elements[${index}].operational.currentEntryId`
    if ((status === null) !== (currentEntryId === null)) add(path, 'y status deben ser nulos conjuntamente')
    if (currentEntryId !== null) {
      if (projectUnitStatus(input.timeline, element.id, currentEntryId) !== status) add(path, 'debe referenciar un cambio vigente de esta dotación con el mismo estado')
      const latest = input.timeline.findLast(entry => entry.type === 'status-change' && entry.unitId.toLowerCase() === element.id.toLowerCase())
      if (latest?.id.toLowerCase() !== currentEntryId.toLowerCase()) add(path, 'debe identificar la selección más reciente, sin recuperar anteriores')
    }
  })
  input.notebook.forEach((block, index) => {
    identify(block.id, `notebook[${index}].id`)
    if (block.type === 'checklist') block.items.forEach((item, itemIndex) => identify(item.id, `notebook[${index}].items[${itemIndex}].id`))
  })
  input.timeline.forEach((entry, index) => {
    identify(entry.id, `timeline[${index}].id`)
    const previous = input.timeline[index - 1]
    if (previous && compareUtcDates(entry.occurredAt, previous.occurredAt) < 0) {
      add(`timeline[${index}].occurredAt`, 'debe mantener el orden cronológico ascendente')
    }
    let lastInstant: string | null = null
    let deleted = false, corrected = false
    entry.revisions.forEach((revision, revisionIndex) => {
      const path = `timeline[${index}].revisions[${revisionIndex}]`
      identify(revision.id, `${path}.id`)
      if (lastInstant !== null && compareUtcDates(revision.recordedAt, lastInstant) < 0) add(`${path}.recordedAt`, 'debe mantener el orden de las revisiones anteriores')
      lastInstant = revision.recordedAt
      if (deleted) add(path, 'no puede revisar una entrada eliminada')
      if (revision.kind === 'delete') deleted = true
      if (revision.kind === 'correction') {
        if (entry.type !== 'status-change' || corrected) add(path, 'solo puede corregir una vez un cambio de estado')
        corrected = true
      }
    })
    if ((isTimelineEntryDeleted(entry) || isTimelineEntryCorrected(entry)) && input.elements.some(element => element.isUnit && element.operational.currentEntryId?.toLowerCase() === entry.id.toLowerCase())) {
      add(`timeline[${index}].revisions`, 'una entrada retirada no puede ser Actual')
    }
  })
  for (const [id, layout] of Object.entries(input.moduleLayouts)) {
    if (layout.x + layout.width > layout.referenceSize.width) add(`moduleLayouts.${id}.x`, 'junto con width debe quedar dentro de referenceSize.width')
    if (layout.y + layout.height > layout.referenceSize.height) add(`moduleLayouts.${id}.y`, 'junto con height debe quedar dentro de referenceSize.height')
  }
  return errors.length ? { success: false, errors } : { success: true, document: input }
}
