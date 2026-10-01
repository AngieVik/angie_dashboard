import type { AngieDocumentV1, ChecklistItem, NotebookBlock } from '../../domain/document/types'

function findBlock(document: AngieDocumentV1, id: string) {
  const block = document.notebook.find(block => block.id === id)
  if (!block) throw new Error('El bloque ya no existe.')
  return block
}
function findChecklist(document: AngieDocumentV1, id: string) {
  const block = findBlock(document, id)
  if (block.type !== 'checklist') throw new Error('El bloque no es un checklist.')
  return block
}
function findItem(document: AngieDocumentV1, blockId: string, itemId: string) {
  const item = findChecklist(document, blockId).items.find(item => item.id === itemId)
  if (!item) throw new Error('El elemento del checklist ya no existe.')
  return item
}
export function addNotebookBlock(document: AngieDocumentV1, type: NotebookBlock['type']): NotebookBlock {
  const id = crypto.randomUUID()
  const block: NotebookBlock = type === 'note' ? { id, type, text: '' } : { id, type, items: [] }
  document.notebook.push(block)
  return block
}
export function editNotebookNote(document: AngieDocumentV1, id: string, text: string) {
  const block = findBlock(document, id)
  if (block.type !== 'note') throw new Error('El bloque no es una nota.')
  block.text = text
}
export function deleteNotebookBlock(document: AngieDocumentV1, id: string) {
  findBlock(document, id)
  document.notebook = document.notebook.filter(block => block.id !== id)
}
// targetId is the block whose current array position the moved block will occupy.
export function reorderNotebookBlock(document: AngieDocumentV1, id: string, targetId: string) {
  const block = findBlock(document, id)
  findBlock(document, targetId)
  if (id === targetId) return
  const from = document.notebook.findIndex(block => block.id === id)
  const to = document.notebook.findIndex(block => block.id === targetId)
  document.notebook.splice(from, 1)
  document.notebook.splice(to, 0, block)
}
export function addChecklistItem(document: AngieDocumentV1, blockId: string): ChecklistItem {
  const block = findChecklist(document, blockId)
  const item = { id: crypto.randomUUID(), text: '', checked: false }
  block.items.push(item)
  return item
}
export function editChecklistItem(document: AngieDocumentV1, blockId: string, itemId: string, text: string) {
  findItem(document, blockId, itemId).text = text
}
export function setChecklistItemChecked(document: AngieDocumentV1, blockId: string, itemId: string, checked: boolean) {
  findItem(document, blockId, itemId).checked = checked
}
export function deleteChecklistItem(document: AngieDocumentV1, blockId: string, itemId: string) {
  findItem(document, blockId, itemId)
  const block = findChecklist(document, blockId)
  block.items = block.items.filter(item => item.id !== itemId)
}
