import type { AngieDocument } from '../document/types'
import { commandResult } from '../document/documentCommand'

function operational(document: AngieDocument, id: string) {
  const unit = document.elements.find(element => element.id === id)
  if (!unit?.isUnit) throw new Error('La dotación ya no existe.')
  return unit.operational
}
export function setUnitNotes(document: AngieDocument, id: string, text: string) {
  return updateOperational(document, id, { notes: text })
}

export function setUnitNotesColor(document: AngieDocument, id: string, color: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Color de anotación no válido.')
  return updateOperational(document, id, { notesColor: color })
}

function updateOperational(document: AngieDocument, id: string, patch: Partial<ReturnType<typeof operational>>) {
  const current = operational(document, id)
  if (Object.entries(patch).every(([key, value]) => current[key as keyof typeof current] === value)) return commandResult(document, document)
  return commandResult(document, { ...document, elements: document.elements.map(element => element.id === id && element.isUnit
    ? { ...element, operational: { ...current, ...patch } } : element) })
}
