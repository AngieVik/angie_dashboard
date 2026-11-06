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
  allErrors: true,
  strictNumbers: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  ownProperties: true,
})
addFormats(ajv)
const validateSchema = ajv.compile<UIBoardData>(schema)

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
  return { path, message: `${path} ${messages[error.keyword] ?? 'no contiene datos válidos de UIBoard'}` }
}

export function validateDocument(input: unknown): ValidationResult<UIBoardData> {
  const budget = checkDocumentBudget(input)
  if (budget) return { success: false, errors: [budget] }
  if (!validateSchema(input)) return { success: false, errors: (validateSchema.errors ?? []).map(issueFromSchema) }
  const document = input
  const timelineIndex = buildTimelineIndex(document.timeline), currentIds = currentEntryIds(document.elements)
  const errors: ValidationIssue[] = []
  const add = (path: string, message: string) => errors.push({ path, message: `${path} ${message}` })
  const ids = new Set<string>()
  const identify = (id: string, path: string) => {
    // UUID spelling is case-insensitive; references such as unitId are not owners.
    const key = id.toLowerCase()
    if (ids.has(key)) add(path, 'debe identificar un objeto distinto; el UUID está repetido')
    ids.add(key)
  }
  identify(document.document.id, 'document.id')
  document.quickNotes.forEach((note, index) => identify(note.id, `quickNotes[${index}].id`))
  if (compareUtcDates(document.document.updatedAt, document.document.createdAt) < 0) {
    add('document.updatedAt', 'no puede ser anterior a createdAt')
  }
  document.elements.forEach((element, index) => {
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
      if (projectUnitStatus(document.timeline, element.id, currentEntryId, timelineIndex) !== status) add(path, 'debe referenciar un cambio vigente de esta dotación con el mismo estado')
      const latest = timelineIndex.latestByUnit.get(element.id.toLowerCase())
      if (latest?.id.toLowerCase() !== currentEntryId.toLowerCase()) add(path, 'debe identificar la selección más reciente, sin recuperar anteriores')
    }
  })
  document.notebook.forEach((block, index) => {
    identify(block.id, `notebook[${index}].id`)
    if (block.type === 'checklist') block.items.forEach((item, itemIndex) => identify(item.id, `notebook[${index}].items[${itemIndex}].id`))
  })
  document.timeline.forEach((entry, index) => {
    identify(entry.id, `timeline[${index}].id`)
    const previous = document.timeline[index - 1]
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
    if ((isTimelineEntryDeleted(entry) || isTimelineEntryCorrected(entry)) && currentIds.has(entry.id.toLowerCase())) {
      add(`timeline[${index}].revisions`, 'una entrada retirada no puede ser Actual')
    }
  })
  return errors.length ? { success: false, errors } : { success: true, document }
}
