import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { serializeDocument } from '../../domain/document/serializeDocument'
import { validateDocument } from '../../domain/document/validateDocument'
import { createDatabase } from '../../storage/db'
import { DocumentRepository } from '../../storage/documentRepository'
import { createDocumentStore } from '../document/documentStore'
import { addNotebookBlock, editNotebookNote, deleteNotebookBlock, reorderNotebookBlock, addChecklistItem, editChecklistItem, setChecklistItemChecked, deleteChecklistItem } from './notebookCommands'

describe('comandos del Cuaderno', () => {
  it('añade bloques vacíos independientes al final con UUID y solo los campos aprobados', () => {
    const document = createEmptyDocument()
    const note = addNotebookBlock(document, 'note')
    const checklist = addNotebookBlock(document, 'checklist')
    const last = addNotebookBlock(document, 'note')
    expect(document.notebook).toEqual([
      { id: note.id, type: 'note', title: 'Nota', text: '' },
      { id: checklist.id, type: 'checklist', title: 'Checklist', items: [] },
      { id: last.id, type: 'note', title: 'Nota', text: '' },
    ])
    expect(new Set(document.notebook.map(block => block.id)).size).toBe(3)
    expect(validateDocument(document).success).toBe(true)
  })

  it('edita texto multilínea, símbolos y emojis sin recortarlo ni modificar su título o formato', () => {
    const document = createEmptyDocument()
    const note = addNotebookBlock(document, 'note')
    editNotebookNote(document, note.id, '  Preparación\n⚠ Acceso norte → sur\n📻 Radio  ')
    expect(document.notebook).toEqual([{ id: note.id, type: 'note', title: 'Nota', text: '  Preparación\n⚠ Acceso norte → sur\n📻 Radio  ' }])
    editNotebookNote(document, note.id, '')
    expect(document.notebook[0]).toEqual({ id: note.id, type: 'note', title: 'Nota', text: '' })
  })

  it('añade, edita, marca, desmarca y elimina ítems por ID conservando el orden', () => {
    const document = createEmptyDocument()
    const block = addNotebookBlock(document, 'checklist')
    const a = addChecklistItem(document, block.id)
    const b = addChecklistItem(document, block.id)
    expect(a.id).not.toBe(b.id)
    expect(a).toEqual({ id: a.id, text: '', checked: false })
    editChecklistItem(document, block.id, a.id, '📻 Comprobar radio')
    editChecklistItem(document, block.id, b.id, 'Acceso norte')
    setChecklistItemChecked(document, block.id, b.id, true)
    expect(document.notebook[0]).toEqual({ id: block.id, type: 'checklist', title: 'Checklist', items: [
      { id: a.id, text: '📻 Comprobar radio', checked: false },
      { id: b.id, text: 'Acceso norte', checked: true },
    ] })
    setChecklistItemChecked(document, block.id, b.id, false)
    deleteChecklistItem(document, block.id, a.id)
    expect(document.notebook[0]).toEqual({ id: block.id, type: 'checklist', title: 'Checklist', items: [{ id: b.id, text: 'Acceso norte', checked: false }] })
    editChecklistItem(document, block.id, b.id, '')
    deleteChecklistItem(document, block.id, b.id)
    expect(document.notebook[0]).toEqual({ id: block.id, type: 'checklist', title: 'Checklist', items: [] })
  })

  it('reordena por ID en ambos sentidos, conserva contenido y elimina solo el bloque elegido', () => {
    const document = createEmptyDocument()
    const a = addNotebookBlock(document, 'note'), b = addNotebookBlock(document, 'checklist'), c = addNotebookBlock(document, 'note')
    editNotebookNote(document, a.id, 'Conservar')
    const item = addChecklistItem(document, b.id)
    setChecklistItemChecked(document, b.id, item.id, true)
    reorderNotebookBlock(document, a.id, c.id)
    expect(document.notebook.map(block => block.id)).toEqual([b.id, c.id, a.id])
    reorderNotebookBlock(document, a.id, b.id)
    expect(document.notebook.map(block => block.id)).toEqual([a.id, b.id, c.id])
    reorderNotebookBlock(document, b.id, b.id)
    deleteNotebookBlock(document, c.id)
    expect(document.notebook).toEqual([{ id: a.id, type: 'note', title: 'Nota', text: 'Conservar' }, { id: b.id, type: 'checklist', title: 'Checklist', items: [{ id: item.id, text: '', checked: true }] }])
  })

  it('rechaza IDs y tipos incorrectos sin mutación parcial', () => {
    const document = createEmptyDocument()
    const a = addNotebookBlock(document, 'note'), b = addNotebookBlock(document, 'checklist')
    const item = addChecklistItem(document, b.id), before = structuredClone(document)
    for (const action of [
      () => editNotebookNote(document, b.id, 'No'),
      () => addChecklistItem(document, a.id),
      () => editChecklistItem(document, b.id, a.id, 'No'),
      () => setChecklistItemChecked(document, a.id, item.id, true),
      () => deleteChecklistItem(document, b.id, 'missing'),
      () => deleteNotebookBlock(document, 'missing'),
      () => reorderNotebookBlock(document, a.id, 'missing'),
      () => reorderNotebookBlock(document, 'missing', b.id),
    ]) {
      expect(action).toThrow()
      expect(document).toEqual(before)
    }
  })

  it('autoguarda, recupera y exporta texto, marcas y orden a través del almacén y Dexie reales', async () => {
    const db = createDatabase('notebook-test', { indexedDB: new IDBFactory(), IDBKeyRange })
    try {
      const repository = new DocumentRepository(db)
      const store = createDocumentStore(repository, { platform: { download: () => {} } })
      await store.initialize()
      let a = '', b = '', item = ''
      store.mutateDocument(document => {
        a = addNotebookBlock(document, 'note').id
        b = addNotebookBlock(document, 'checklist').id
        editNotebookNote(document, a, 'Preparación\n⚠ Acceso norte')
        item = addChecklistItem(document, b).id
        editChecklistItem(document, b, item, '📻 Comprobar radio')
        setChecklistItemChecked(document, b, item, true)
        reorderNotebookBlock(document, b, a)
      })
      await store.flushAutosave()
      db.close()
      const recovered = createDocumentStore(repository, { platform: { download: () => {} } })
      await recovered.initialize()
      const exported = JSON.parse(serializeDocument(recovered.getSnapshot().document))
      expect(exported.notebook).toEqual([
        { id: b, type: 'checklist', title: 'Checklist', items: [{ id: item, text: '📻 Comprobar radio', checked: true }] },
        { id: a, type: 'note', title: 'Nota', text: 'Preparación\n⚠ Acceso norte' },
      ])
      expect(Object.keys(exported)).toHaveLength(8)
      const unchanged = recovered.getSnapshot().document
      recovered.mutateDocument(document => reorderNotebookBlock(document, a, a))
      expect(recovered.getSnapshot().document).toBe(unchanged)
      await recovered.loadDocument({ text: async () => JSON.stringify(exported) })
      expect(recovered.getSnapshot().document.notebook).toEqual(exported.notebook)
      recovered.newDocument()
      expect(recovered.getSnapshot().document.notebook).toEqual([])
      await recovered.flushAutosave()
    } finally { db.close() }
  })
})
