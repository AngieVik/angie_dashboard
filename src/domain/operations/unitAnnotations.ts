import type { AngieDocumentV1 } from '../document/types'

function operational(document: AngieDocumentV1, id: string) {
  const unit = document.elements.find(element => element.id === id)
  if (!unit?.isUnit) throw new Error('La dotación ya no existe.')
  return unit.operational
}
function normalizeTag(text: string, tags: string[], except?: number) {
  const tag = text.trim()
  if (!tag) throw new Error('La etiqueta no puede estar vacía.')
  if (tags.some((value, index) => index !== except && value.toLowerCase() === tag.toLowerCase())) throw new Error('Etiqueta duplicada.')
  return tag
}
export function setUnitNotes(document: AngieDocumentV1, id: string, text: string) {
  operational(document, id).notes = text
}
export function addUnitTag(document: AngieDocumentV1, id: string, text: string) {
  const data = operational(document, id)
  data.tags.push(normalizeTag(text, data.tags))
}
export function editUnitTag(document: AngieDocumentV1, id: string, index: number, text: string) {
  const data = operational(document, id)
  if (!Number.isInteger(index) || index < 0 || index >= data.tags.length) throw new Error('La etiqueta ya no existe.')
  data.tags[index] = normalizeTag(text, data.tags, index)
}
export function removeUnitTag(document: AngieDocumentV1, id: string, index: number) {
  const data = operational(document, id)
  if (!Number.isInteger(index) || index < 0 || index >= data.tags.length) throw new Error('La etiqueta ya no existe.')
  data.tags.splice(index, 1)
}
