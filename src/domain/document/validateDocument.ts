import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { ErrorObject } from 'ajv'
import schema from './schema/uiboard.schema.json'
import type { UIBoardData, ValidationIssue, ValidationResult } from './types'
import { compareUtcDates } from './documentTime'
import { checkDocumentBudget } from '../input/inputBudgets'
import { isTimelineEntryDeleted, isTimelineEntryCorrected, projectUnitStatus } from '../operations/timelineProjection'
import { buildTimelineIndex, currentEntryIds } from '../operations/operationIndexes'

const ajv = new Ajv2020({
  strict: true,
  allErrors: false,
  strictNumbers: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  ownProperties: true,
})
addFormats(ajv)
const validateSchema = ajv.compile<UIBoardData>(schema)

// At most 3,619 displayed characters including the separators used by callers.
const MAX_ISSUES = 20
const MAX_PATH_CHARACTERS = 160
const MAX_MESSAGE_CHARACTERS = 180
const shorten = (value: string, limit: number) => value.length > limit ? value.slice(0, limit - 1) + '…' : value
function boundedIssue(path: string, message: string): ValidationIssue {
  return { path: shorten(path, MAX_PATH_CHARACTERS), message: shorten(message, MAX_MESSAGE_CHARACTERS) }
}

function issueFromSchema(error: ErrorObject): ValidationIssue {
  const parts = shorten(error.instancePath, MAX_PATH_CHARACTERS).split('/').slice(1).map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'))
  if (error.keyword === 'required') parts.push(shorten(String(error.params.missingProperty), MAX_PATH_CHARACTERS))
  if (error.keyword === 'additionalProperties') parts.push(shorten(String(error.params.additionalProperty), MAX_PATH_CHARACTERS))
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
  return boundedIssue(path, `${path} ${messages[error.keyword] ?? 'no contiene datos válidos de UIBoard'}`)
}

export function validateDocument(input: unknown): ValidationResult<UIBoardData> {
  const budget = checkDocumentBudget(input)
  if (budget) return { success: false, errors: [boundedIssue(budget.path, budget.message)] }
  // Composite schema branches may still produce several errors without allErrors.
  if (!validateSchema(input)) return { success: false, errors: (validateSchema.errors ?? []).slice(0, MAX_ISSUES).map(issueFromSchema) }
  const document = input
  const timelineIndex = buildTimelineIndex(document.timeline), currentIds = currentEntryIds(document.elements)
  const errors: ValidationIssue[] = []
  const invalid = (): ValidationResult<UIBoardData> => ({ success: false, errors })
  const add = (path: string, message: string) => {
    errors.push(boundedIssue(path, `${path} ${message}`))
    return errors.length >= MAX_ISSUES
  }
  const ids = new Set<string>()
  const identify = (id: string, path: string) => {
    // UUID spelling is case-insensitive; references such as unitId are not owners.
    const key = id.toLowerCase()
    if (ids.has(key)) add(path, 'debe identificar un objeto distinto; el UUID está repetido')
    ids.add(key)
    return errors.length >= MAX_ISSUES
  }
  identify(document.document.id, 'document.id')
  for (const [index, note] of document.quickNotes.entries()) {
    if (identify(note.id, `quickNotes[${index}].id`)) return invalid()
  }
  if (compareUtcDates(document.document.updatedAt, document.document.createdAt) < 0) {
    if (add('document.updatedAt', 'no puede ser anterior a createdAt')) return invalid()
  }
  for (const [index, element] of document.elements.entries()) {
    if (identify(element.id, `elements[${index}].id`)) return invalid()
    if (!element.isUnit) continue
    const tags = new Set<string>()
    for (const [tagIndex, tag] of element.operational.tags.entries()) {
      const key = tag.toLowerCase()
      if (tags.has(key) && add(`elements[${index}].operational.tags[${tagIndex}]`, 'no puede duplicar otra etiqueta sin distinguir mayúsculas')) return invalid()
      tags.add(key)
    }
    const { status, currentEntryId } = element.operational
    const path = `elements[${index}].operational.currentEntryId`
    if ((status === null) !== (currentEntryId === null) && add(path, 'y status deben ser nulos conjuntamente')) return invalid()
    if (currentEntryId !== null) {
      if (projectUnitStatus(document.timeline, element.id, currentEntryId, timelineIndex) !== status && add(path, 'debe referenciar un cambio vigente de esta dotación con el mismo estado')) return invalid()
      const latest = timelineIndex.latestByUnit.get(element.id.toLowerCase())
      if (latest?.id.toLowerCase() !== currentEntryId.toLowerCase() && add(path, 'debe identificar la selección más reciente, sin recuperar anteriores')) return invalid()
    }
  }
  for (const [index, block] of document.notebook.entries()) {
    if (identify(block.id, `notebook[${index}].id`)) return invalid()
    if (block.type === 'checklist') for (const [itemIndex, item] of block.items.entries()) {
      if (identify(item.id, `notebook[${index}].items[${itemIndex}].id`)) return invalid()
    }
  }
  for (const [index, entry] of document.timeline.entries()) {
    if (identify(entry.id, `timeline[${index}].id`)) return invalid()
    const previous = document.timeline[index - 1]
    if (previous && compareUtcDates(entry.occurredAt, previous.occurredAt) < 0) {
      if (add(`timeline[${index}].occurredAt`, 'debe mantener el orden cronológico ascendente')) return invalid()
    }
    let lastInstant: string | null = null
    let deleted = false, corrected = false
    for (const [revisionIndex, revision] of entry.revisions.entries()) {
      const path = `timeline[${index}].revisions[${revisionIndex}]`
      if (identify(revision.id, `${path}.id`)) return invalid()
      if (lastInstant !== null && compareUtcDates(revision.recordedAt, lastInstant) < 0 && add(`${path}.recordedAt`, 'debe mantener el orden de las revisiones anteriores')) return invalid()
      lastInstant = revision.recordedAt
      if (deleted && add(path, 'no puede revisar una entrada eliminada')) return invalid()
      if (revision.kind === 'delete') deleted = true
      if (revision.kind === 'correction') {
        if ((entry.type !== 'status-change' || corrected) && add(path, 'solo puede corregir una vez un cambio de estado')) return invalid()
        corrected = true
      }
    }
    if ((isTimelineEntryDeleted(entry) || isTimelineEntryCorrected(entry)) && currentIds.has(entry.id.toLowerCase())) {
      if (add(`timeline[${index}].revisions`, 'una entrada retirada no puede ser Actual')) return invalid()
    }
  }
  return errors.length ? { success: false, errors } : { success: true, document }
}
