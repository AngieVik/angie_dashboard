import fs from 'node:fs'
import path from 'node:path'
import Ajv from 'ajv'
import { root, readJson } from './project.mjs'
import { digest } from './snapshot.mjs'

export const policyFile = 'scripts/config/ui-consistency.json'
const properties = ['font-family', 'font-size', 'font-weight', 'line-height', 'padding', 'padding-inline', 'padding-block', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'padding-inline-start', 'padding-inline-end', 'padding-block-start', 'padding-block-end', 'gap', 'row-gap', 'column-gap', ...['width', 'height', 'inline-size', 'block-size'].flatMap(axis => [axis, `min-${axis}`, `max-${axis}`]), 'initialWidth', 'initialHeight', 'registryMinWidth', 'registryMinHeight']
const id = { type: 'string', pattern: '^[a-z][a-z0-9-]*$' }
const description = { type: 'string', minLength: 1 }
const sources = { type: 'array', minItems: 1, uniqueItems: true, items: description }
const validate = new Ajv({ allErrors: true }).compile({
  type: 'object', additionalProperties: false, required: ['schemaVersion', 'groups', 'exceptions'],
  properties: {
    schemaVersion: { const: 1 },
    groups: { type: 'array', minItems: 1, items: {
      type: 'object', additionalProperties: false, required: ['id', 'name', 'target', 'properties', 'reason', 'sources'],
      properties: { id, name: description, target: { enum: ['modules', 'fileDialog', 'alertDialog', 'sheet'] },
        members: { type: 'array', minItems: 1, uniqueItems: true, items: description },
        properties: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: properties } }, reason: description, sources },
    } },
    exceptions: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['id', 'group', 'moduleId', 'property', 'expected', 'reason', 'sources'],
      properties: { id, group: id, moduleId: description, property: { enum: properties }, expected: description, reason: description, sources },
    } },
  },
})

export function loadUiPolicy() {
  const policy = readJson(policyFile)
  if (!validate(policy)) throw new Error(`Política visual inválida: ${validate.errors[0].instancePath} ${validate.errors[0].message}`)
  const groupIds = new Set(), exceptionIds = new Set(), exceptionTargets = new Set()
  for (const group of policy.groups) {
    if (groupIds.has(group.id)) throw new Error(`Grupo visual duplicado: ${group.id}`)
    if (group.members && group.target !== 'modules') throw new Error(`members solo se admite para módulos: ${group.id}`)
    groupIds.add(group.id)
  }
  for (const exception of policy.exceptions) {
    const group = policy.groups.find(item => item.id === exception.group)
    if (!group || group.target !== 'modules' || !group.properties.includes(exception.property)) throw new Error(`Excepción fuera de su grupo o propiedad: ${exception.id}`)
    const target = `${exception.group}:${exception.moduleId}:${exception.property}`
    if (exceptionIds.has(exception.id) || exceptionTargets.has(target)) throw new Error(`Excepción visual duplicada: ${exception.id}`)
    exceptionIds.add(exception.id); exceptionTargets.add(target)
  }
  for (const source of [...policy.groups, ...policy.exceptions].flatMap(item => item.sources)) {
    const absolute = path.resolve(root, source), local = path.relative(root, absolute)
    if (local.startsWith('..') || path.isAbsolute(local) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`Fuente de política visual no válida: ${source}`)
  }
  return { ...policy, file: policyFile, hash: digest(JSON.stringify(policy)) }
}
