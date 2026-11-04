import type { AngieDocument, ChecklistItem, NotebookBlock } from '../../domain/document/types'
import { commandResult } from '../../domain/document/documentCommand'

function findBlock(document: AngieDocument, id: string) {
  const block = document.notebook.find(block => block.id === id)
  if (!block) throw new Error('El bloque ya no existe.')
  return block
}
function findChecklist(document: AngieDocument, id: string) {
  const block = findBlock(document, id)
  if (block.type !== 'checklist') throw new Error('El bloque no es un checklist.')
  return block
}
function findItem(document: AngieDocument, blockId: string, itemId: string) {
  const item = findChecklist(document, blockId).items.find(item => item.id === itemId)
  if (!item) throw new Error('El elemento del checklist ya no existe.')
  return item
}
export function addNotebookBlock(document: AngieDocument, type: NotebookBlock['type']) {
  const id = crypto.randomUUID()
  const block: NotebookBlock = type === 'note' ? { id, type, title: 'Nota', text: '' } : { id, type, title: 'Checklist', items: [] }
  return commandResult(document, { ...document, notebook: [...document.notebook, block] }, block)
}
export function editNotebookNote(document: AngieDocument, id: string, text: string) {
  const block = findBlock(document, id)
  if (block.type !== 'note') throw new Error('El bloque no es una nota.')
  return block.text === text ? commandResult(document, document) : replaceBlock(document, { ...block, text })
}
export function deleteNotebookBlock(document: AngieDocument, id: string) {
  findBlock(document, id)
  return commandResult(document, { ...document, notebook: document.notebook.filter(block => block.id !== id) })
}
// targetId is the block whose current array position the moved block will occupy.
export function reorderNotebookBlock(document: AngieDocument, id: string, targetId: string) {
  const block = findBlock(document, id)
  findBlock(document, targetId)
  if (id === targetId) return commandResult(document, document)
  const from = document.notebook.findIndex(block => block.id === id)
  const to = document.notebook.findIndex(block => block.id === targetId)
  const notebook = [...document.notebook]
  notebook.splice(from, 1)
  notebook.splice(to, 0, block)
  return commandResult(document, { ...document, notebook })
}
export function addChecklistItem(document: AngieDocument, blockId: string, afterItemId?: string, initial?: Pick<ChecklistItem, 'text' | 'checked'>) {
  const block = findChecklist(document, blockId)
  let index = block.items.length
  if (afterItemId !== undefined) {
    findItem(document, blockId, afterItemId)
    index = block.items.findIndex(item => item.id === afterItemId) + 1
  }
  const item = { id: crypto.randomUUID(), text: initial?.text ?? '', checked: initial?.checked ?? false }
  const items = [...block.items]
  items.splice(index, 0, item)
  return commandResult(document, replaceBlock(document, { ...block, items }).document, item)
}
export function editChecklistItem(document: AngieDocument, blockId: string, itemId: string, text: string) {
  const item = findItem(document, blockId, itemId)
  return item.text === text ? commandResult(document, document) : replaceItem(document, blockId, { ...item, text })
}
export function setChecklistItemChecked(document: AngieDocument, blockId: string, itemId: string, checked: boolean) {
  const item = findItem(document, blockId, itemId)
  return item.checked === checked ? commandResult(document, document) : replaceItem(document, blockId, { ...item, checked })
}
export function deleteChecklistItem(document: AngieDocument, blockId: string, itemId: string) {
  findItem(document, blockId, itemId)
  const block = findChecklist(document, blockId)
  return replaceBlock(document, { ...block, items: block.items.filter(item => item.id !== itemId) })
}

function replaceBlock(document: AngieDocument, block: NotebookBlock) {
  return commandResult(document, { ...document, notebook: document.notebook.map(item => item.id === block.id ? block : item) })
}
function replaceItem(document: AngieDocument, blockId: string, item: ChecklistItem) {
  const block = findChecklist(document, blockId)
  return replaceBlock(document, { ...block, items: block.items.map(current => current.id === item.id ? item : current) })
}
