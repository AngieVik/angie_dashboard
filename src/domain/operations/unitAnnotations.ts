import type { AngieDocument } from '../document/types'

function operational(document: AngieDocument, id: string) {
  const unit = document.elements.find(element => element.id === id)
  if (!unit?.isUnit) throw new Error('La dotación ya no existe.')
  return unit.operational
}
export function setUnitNotes(document: AngieDocument, id: string, text: string) {
  operational(document, id).notes = text
}

export function setUnitNotesColor(document: AngieDocument, id: string, color: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Color de anotación no válido.')
  operational(document, id).notesColor = color
}
