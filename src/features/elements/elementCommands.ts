import type { AngieDocument, DocumentElement, ElementVisual, Position } from '../../domain/document/types'
import type { CreateElementInput, ElementBatchPatch, ElementPatch } from './elementTypes'
import { ICON_CATALOG } from './iconCatalog'
import { PIN_ANCHORS, PIN_NAME_COLORS } from './pinPresentation'

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
  if (visual.rotation !== undefined && (!Number.isFinite(visual.rotation) || visual.rotation < 0 || visual.rotation > 360)) throw new Error('El giro debe estar entre 0 y 360 grados.')
  if ([visual.flipX, visual.flipY].some(value => value !== undefined && typeof value !== 'boolean')) throw new Error('La inversión debe ser un valor booleano.')
  const transform = { ...(visual.rotation === undefined ? {} : { rotation: visual.rotation }),
    ...(visual.flipX === undefined ? {} : { flipX: visual.flipX }), ...(visual.flipY === undefined ? {} : { flipY: visual.flipY }) }
  if (visual.type === 'asset') {
    if (!ICON_CATALOG[visual.assetId]) throw new Error('Icono no reconocido.')
    return { type: 'asset', assetId: visual.assetId, scale: clampAssetScale(visual.scale), ...transform }
  }
  if (!visual.value.length) throw new Error('Escribe o pega un emoji.')
  return { type: 'emoji', value: visual.value, scale: clampAssetScale(visual.scale), ...transform }
}
function normalizeNamePresentation(input: Pick<CreateElementInput, 'nameOffset' | 'nameColor'>) {
  if (input.nameOffset && (!Number.isFinite(input.nameOffset.x) || !Number.isFinite(input.nameOffset.y))) throw new Error('La posición del nombre debe contener números finitos.')
  if (input.nameColor !== undefined && !Object.hasOwn(PIN_NAME_COLORS, input.nameColor)) throw new Error('Color del nombre no reconocido.')
  return { ...(input.nameOffset === undefined ? {} : { nameOffset: { ...input.nameOffset } }),
    ...(input.nameColor === undefined ? {} : { nameColor: input.nameColor }) }
}
function validateNameFontSize(value: number) {
  if (!Number.isFinite(value) || value < 8 || value > 72) throw new Error('El tamaño de letra debe estar entre 8 y 72 px.')
  return value
}
function normalizePinAnchor(pinAnchor: DocumentElement['pinAnchor']) {
  if (pinAnchor === undefined) return {}
  if (typeof pinAnchor === 'object' && pinAnchor !== null) {
    if (![pinAnchor.x, pinAnchor.y].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error('El punto de coordenadas debe estar dentro del pin.')
    return { pinAnchor: { x: pinAnchor.x, y: pinAnchor.y } }
  }
  if (!PIN_ANCHORS.some(point => point.value === pinAnchor)) throw new Error('Punto de coordenadas no reconocido.')
  return { pinAnchor }
}
function resolveName(document: AngieDocument, name: string, isUnit: boolean, excludeId?: string) {
  if (name.trim()) return name
  const names = new Set(document.elements.filter(element => element.id !== excludeId && element.isUnit === isUnit).map(element => element.name))
  const prefix = isUnit ? 'D' : 'E'
  let number = 1
  while (names.has(prefix + number)) number++
  return prefix + number
}
function findElement(document: AngieDocument, id: string) {
  const element = document.elements.find(element => element.id === id)
  if (!element) throw new Error('El elemento ya no existe.')
  return element
}
function duplicateName(document: AngieDocument, element: DocumentElement) {
  const numbered = /^(.*?)(\d+)$/s.exec(element.name.trimEnd())
  const prefix = numbered ? numbered[1]! : `${element.name.trimEnd()} `
  let last = numbered ? BigInt(numbered[2]!) : 0n
  for (const candidate of document.elements) {
    if (candidate.isUnit !== element.isUnit || !candidate.name.startsWith(prefix)) continue
    const suffix = candidate.name.slice(prefix.length).trimEnd()
    if (/^\d+$/.test(suffix)) {
      const number = BigInt(suffix)
      if (number > last) last = number
    }
  }
  return `${prefix}${last + 1n}`
}
export function createElement(document: AngieDocument, input: CreateElementInput): DocumentElement {
  const name = resolveName(document, input.name, input.isUnit)
  const visual = normalizeVisual(input.visual)
  const requested = input.position === undefined ? { x: 500, y: 500 } : input.position
  const common = { ...normalizeNamePresentation(input), ...normalizePinAnchor(input.pinAnchor), id: crypto.randomUUID(), name, visual, information: input.information,
    position: requested ? clampPinPosition(requested, visual) : null, pinVisible: true, ...(input.nameHidden === undefined ? {} : { nameHidden: input.nameHidden }), nameFontSize: validateNameFontSize(input.nameFontSize ?? 16) }
  const element: DocumentElement = input.isUnit ? { ...common, isUnit: true, operational: { status: null, currentEntryId: null, notes: '', tags: [] } } :
    { ...common, isUnit: false, operational: null }
  document.elements.push(element)
  return element
}
export function updateElement(document: AngieDocument, id: string, patch: ElementPatch) {
  if (Object.keys(patch).some(key => !['name', 'visual', 'information', 'position', 'nameFontSize', 'nameHidden', 'nameOffset', 'nameColor', 'pinAnchor'].includes(key))) throw new Error('Solo se puede modificar la configuración común. Dotación es inmutable.')
  const element = findElement(document, id)
  const name = resolveName(document, patch.name ?? element.name, element.isUnit, id)
  const visual = normalizeVisual(patch.visual ?? element.visual)
  const requested = patch.position === undefined ? element.position : patch.position
  const position = requested ? clampPinPosition(requested, visual) : null
  const nameFontSize = patch.nameFontSize === undefined ? element.nameFontSize : validateNameFontSize(patch.nameFontSize)
  Object.assign(element, { ...normalizeNamePresentation(patch), ...normalizePinAnchor(patch.pinAnchor), ...(patch.nameHidden === undefined ? {} : { nameHidden: patch.nameHidden }), ...(nameFontSize === undefined ? {} : { nameFontSize }), name, visual, information: patch.information ?? element.information, position })
}
export function duplicateElement(document: AngieDocument, id: string) {
  const element = findElement(document, id)
  const copy = createElement(document, { name: duplicateName(document, element), visual: element.visual, information: element.information,
    isUnit: element.isUnit, nameOffset: element.nameOffset, nameColor: element.nameColor, nameHidden: element.nameHidden, nameFontSize: element.nameFontSize, pinAnchor: element.pinAnchor, position: element.position ? { x: element.position.x + 24, y: element.position.y + 24 } : null })
  copy.pinVisible = element.pinVisible
  return copy
}
export function updateElements(document: AngieDocument, ids: readonly string[], patch: ElementBatchPatch) {
  for (const id of ids) {
    const element = findElement(document, id)
    const { visual, ...common } = patch
    if (!visual) { updateElement(document, id, common); continue }
    const { icon, ...changes } = visual
    const current = element.visual
    const representation = icon ?? (current.type === 'asset' ? { type: 'asset', assetId: current.assetId } as const : { type: 'emoji', value: current.value } as const)
    updateElement(document, id, { ...common, visual: { ...representation, scale: current.scale,
      ...(current.rotation === undefined ? {} : { rotation: current.rotation }),
      ...(current.flipX === undefined ? {} : { flipX: current.flipX }),
      ...(current.flipY === undefined ? {} : { flipY: current.flipY }), ...changes } })
  }
}
export function deleteElement(document: AngieDocument, id: string) {
  document.elements = document.elements.filter(element => element.id !== id)
  if (document.plan) document.plan.pins = document.plan.pins.filter(pin => pin.elementId.toLowerCase() !== id.toLowerCase())
}

export function togglePinVisibility(document: AngieDocument, id: string) {
  const element = findElement(document, id)
  element.pinVisible = !element.pinVisible
}
