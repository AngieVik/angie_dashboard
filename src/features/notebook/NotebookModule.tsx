import { useRef } from 'react'
import type { AngieDocument, NotebookBlock } from '../../domain/document/types'
import { HelpTooltip } from '../../components/ui/tooltip'
import { Button } from '../../components/ui/button'
import { X, GripVertical } from 'lucide-react'
import { useViewportInteraction } from '../../layout/ViewportContext'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { NoteBlock } from './NoteBlock'
import { ChecklistBlock } from './ChecklistBlock'
import { useNotebookReorder } from './useNotebookReorder'
import { addNotebookBlock, editNotebookNote, deleteNotebookBlock, reorderNotebookBlock, addChecklistItem, editChecklistItem, setChecklistItemChecked, deleteChecklistItem } from './notebookCommands'
import './notebook.css'

export function NotebookModule({ store }: { store: DocumentStore }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const list = useRef<HTMLOListElement>(null)
  const noteControl = useRef<HTMLButtonElement>(null)
  const checklistControl = useRef<HTMLButtonElement>(null)
  function mutate(command: (document: AngieDocument) => void) {
    if (!blockedRef.current) store.mutateDocument(command)
  }
  const reorder = useNotebookReorder(document.notebook, list, (id, targetId) => mutate(document => reorderNotebookBlock(document, id, targetId)))
  function add(type: NotebookBlock['type']) { mutate(document => { addNotebookBlock(document, type) }) }
  return <div className="notebook-module">
    <div className="notebook-toolbar">
      <Button ref={noteControl} disabled={blocked} onClick={() => add('note')}>Nota</Button>
      <Button ref={checklistControl} disabled={blocked} onClick={() => add('checklist')}>Checklist</Button>
    </div>
    <ol className="notebook-list" aria-label="Bloques del Cuaderno" ref={list}>
      {document.notebook.map((block, index) => <li key={block.id} className="notebook-block" data-block-id={block.id} data-block-type={block.type}
        data-dragging={reorder.preview?.id === block.id} data-drop-target={reorder.preview?.targetId === block.id && reorder.preview.id !== block.id}>
        <Button className="notebook-handle" aria-label={`Reordenar bloque ${index + 1}`} title="Reordenar bloque · ↑ / ↓" disabled={blocked} {...reorder.handleProps(block.id)}><GripVertical aria-hidden="true" /></Button>
        <HelpTooltip text="Eliminar bloque"><Button className="notebook-delete" aria-label="Eliminar bloque" disabled={blocked} onClick={() => {
          if (blockedRef.current) return
          const addControl = block.type === 'note' ? noteControl : checklistControl
          addControl.current?.focus()
          mutate(document => deleteNotebookBlock(document, block.id))
        }}><X aria-hidden="true" /></Button></HelpTooltip>
        {block.type === 'note' ? <NoteBlock block={block} disabled={blocked} onEdit={text => mutate(document => editNotebookNote(document, block.id, text))} /> :
          <ChecklistBlock block={block} disabled={blocked}
            onAdd={afterItemId => mutate(document => { addChecklistItem(document, block.id, afterItemId) })}
            onEdit={(id, text) => mutate(document => editChecklistItem(document, block.id, id, text))}
            onCheck={(id, checked) => mutate(document => setChecklistItemChecked(document, block.id, id, checked))}
            onDelete={id => mutate(document => deleteChecklistItem(document, block.id, id))} />}
      </li>)}
    </ol>
  </div>
}
