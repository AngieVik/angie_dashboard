import type { AngieDocument, DocumentElement, ElementVisual, Position } from '../../domain/document/types'
import type { CreateElementInput, ElementPatch } from './elementTypes'
import { ICON_CATALOG } from './iconCatalog'

export function clampAssetScale(value: number) {
  if (!Number.isFinite(value)) throw new Error('La escala debe ser un número finito.')
  return Math.max(0.25, Math.min(3, value))
}
export function clampPinPosition(position: Position, _visual: ElementVisual) {
  // Keep the command's existing interface; a stable center no longer depends on its box.
  void _visual
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error('La posición debe contener números finitos.')
  return { x: Math.max(0, position.x), y: Math.max(0, position.y) }
}
function normalizeVisual(visual: ElementVisual): ElementVisual {
  if (visual.type === 'asset') {
    if (!ICON_CATALOG[visual.assetId]) throw new Error('Icono no reconocido.')
    return { type: 'asset', assetId: visual.assetId, scale: clampAssetScale(visual.scale) }
  }
  if (!visual.value.length) throw new Error('Escribe o pega un emoji.')
  return { type: 'emoji', value: visual.value, scale: clampAssetScale(visual.scale) }
}
function validateNameFontSize(value: number) {
  if (!Number.isFinite(value) || value < 8 || value > 72) throw new Error('El tamaño de letra debe estar entre 8 y 72 px.')
  return value
}
function validateName(name: string) {
  if (!name.trim()) throw new Error('El nombre no puede estar vacío.')
}
function findElement(document: AngieDocument, id: string) {
  const element = document.elements.find(element => element.id === id)
  if (!element) throw new Error('El elemento ya no existe.')
  return element
}
export function createElement(document: AngieDocument, input: CreateElementInput): DocumentElement {
  validateName(input.name)
  const visual = normalizeVisual(input.visual)
  const requested = input.position === undefined ? { x: 500, y: 500 } : input.position
  const common = { id: crypto.randomUUID(), name: input.name, visual, information: input.information,
    position: requested ? clampPinPosition(requested, visual) : null, pinVisible: true, nameFontSize: validateNameFontSize(input.nameFontSize ?? 16) }
  const element: DocumentElement = input.isUnit ? { ...common, isUnit: true, operational: { status: null, currentEntryId: null, notes: '', tags: [] } } :
    { ...common, isUnit: false, operational: null }
  document.elements.push(element)
  return element
}
export function updateElement(document: AngieDocument, id: string, patch: ElementPatch) {
  if (Object.keys(patch).some(key => !['name', 'visual', 'information', 'position', 'nameFontSize'].includes(key))) throw new Error('Solo se puede modificar la configuración común. Dotación es inmutable.')
  const element = findElement(document, id)
  const name = patch.name ?? element.name
  validateName(name)
  const visual = normalizeVisual(patch.visual ?? element.visual)
  const requested = patch.position === undefined ? element.position : patch.position
  const position = requested ? clampPinPosition(requested, visual) : null
  const nameFontSize = patch.nameFontSize === undefined ? element.nameFontSize : validateNameFontSize(patch.nameFontSize)
  Object.assign(element, { ...(nameFontSize === undefined ? {} : { nameFontSize }), name, visual, information: patch.information ?? element.information, position })
}
export function duplicateElement(document: AngieDocument, id: string) {
  const element = findElement(document, id)
  const copy = createElement(document, { name: `${element.name} copia`, visual: element.visual, information: element.information,
    isUnit: element.isUnit, nameFontSize: element.nameFontSize, position: element.position ? { x: element.position.x + 24, y: element.position.y + 24 } : null })
  copy.pinVisible = element.pinVisible
  return copy
}
export function deleteElement(document: AngieDocument, id: string) {
  document.elements = document.elements.filter(element => element.id !== id)
}

export function togglePinVisibility(document: AngieDocument, id: string) {
  const element = findElement(document, id)
  element.pinVisible = !element.pinVisible
}
