import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { ErrorObject } from 'ajv'
import schema from './schema/angie-document-v1.schema.json'
import type { AngieDocumentV1, ValidationIssue, ValidationResult } from './types'

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
const validateSchema = ajv.compile<AngieDocumentV1>(schema)

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
  return { path, message: `${path} ${messages[error.keyword] ?? 'no cumple el esquema V1'}` }
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

export function validateDocument(input: unknown): ValidationResult<AngieDocumentV1> {
  if (!validateSchema(input)) {
    return { success: false, errors: (validateSchema.errors ?? []).map(issueFromSchema) }
  }

  const errors: ValidationIssue[] = []
  const add = (path: string, message: string) => errors.push({ path, message: `${path} ${message}` })
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
  })
  for (const [id, layout] of Object.entries(input.moduleLayouts)) {
    if (layout.x + layout.width > 1600) add(`moduleLayouts.${id}.x`, 'junto con width debe quedar dentro de 1600')
    if (layout.y + layout.height > 1000) add(`moduleLayouts.${id}.y`, 'junto con height debe quedar dentro de 1000')
  }
  return errors.length ? { success: false, errors } : { success: true, document: input }
}
