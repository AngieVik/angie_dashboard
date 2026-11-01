import { useRef } from 'react'
import type { NotebookBlock } from '../../domain/document/types'

import { Button } from '@/components/ui/button'
import { ListChecks, StickyNote, Trash } from 'lucide-react'
import { useViewportInteraction } from '../../layout/ViewportContext'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import type { DocumentCommand } from '../../domain/document/documentCommand'
import { NoteBlock } from './NoteBlock'
import { ChecklistBlock } from './ChecklistBlock'
import { useNotebookReorder } from './useNotebookReorder'
import { addNotebookBlock, editNotebookNote, deleteNotebookBlock, reorderNotebookBlock, addChecklistItem, editChecklistItem, setChecklistItemChecked, deleteChecklistItem } from './notebookCommands'
import styles from './notebook.module.css'
import toolbarStyles from '@/layout/moduleToolbar.module.css'

export function NotebookModule({ store }: { store: DocumentStore }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLOListElement>(null)
  const noteControl = useRef<HTMLButtonElement>(null)
  const checklistControl = useRef<HTMLButtonElement>(null)
  function mutate(command: DocumentCommand) {
    if (!blockedRef.current) store.applyDocumentCommand(command)
  }
  const reorder = useNotebookReorder(document.notebook, list, (id, targetId) => mutate(document => reorderNotebookBlock(document, id, targetId)))
  function add(type: NotebookBlock['type']) {
    mutate(document => {
      const result = addNotebookBlock(document, type)
      return result.value.type === 'checklist' ? addChecklistItem(result.document, result.value.id) : result
    })
  }
  return <div ref={root} data-slot="notebook-module" className={`${styles.base} notebook-module`}>
    <div className={`notebook-toolbar ${toolbarStyles.base}`}>
      <Button ref={noteControl} aria-label="Nota" disabled={blocked} onClick={() => add('note')}><StickyNote aria-hidden="true" /></Button>
      <Button ref={checklistControl} aria-label="Checklist" disabled={blocked} onClick={() => add('checklist')}><ListChecks aria-hidden="true" /></Button>
    </div>
    <ol className="notebook-list" aria-label="Bloques del Cuaderno" ref={list}>
      {document.notebook.map((block, index) => <li key={block.id} className="notebook-block" data-block-id={block.id} data-block-type={block.type}
        data-dragging={reorder.preview?.id === block.id} data-drop-target={reorder.preview?.targetId === block.id && reorder.preview.id !== block.id}>
        <Button appearance="integrated" className="notebook-handle" aria-label={`Reordenar bloque ${index + 1}`} disabled={blocked} {...reorder.handleProps(block.id)} />
        <div className="notebook-block-content">
          <Button appearance="integrated" className="notebook-delete" aria-label="Eliminar bloque" disabled={blocked} onClick={() => {
            if (blockedRef.current) return
            const addControl = block.type === 'note' ? noteControl : checklistControl
            addControl.current?.focus()
            mutate(document => deleteNotebookBlock(document, block.id))
          }}><Trash aria-hidden="true" /></Button>
          {block.type === 'note' ? <NoteBlock block={block} disabled={blocked} onEdit={text => mutate(document => editNotebookNote(document, block.id, text))} /> :
            <ChecklistBlock block={block} disabled={blocked}
              onAdd={(afterItemId, initial) => mutate(document => addChecklistItem(document, block.id, afterItemId, initial))}
              onEdit={(id, text) => mutate(document => editChecklistItem(document, block.id, id, text))}
              onCheck={(id, checked) => mutate(document => setChecklistItemChecked(document, block.id, id, checked))}
              onDelete={id => mutate(document => deleteChecklistItem(document, block.id, id))} />}
        </div>
      </li>)}
    </ol>
  </div>
}
