import { useLayoutEffect, useRef, useState } from 'react'
import type { NotebookBlock } from '../../domain/document/types'
import { Button } from '@/components/ui/button'
import { ListChecks, Minus, Plus, StickyNote, Trash } from 'lucide-react'
import { useValidationNotice } from '@/hooks/useValidationNotice'
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

type Selection = { blockId: string; itemId?: string }

export function NotebookModule({ store }: { store: DocumentStore }) {
  const { documentGeneration } = useDocumentStore(store)
  return <NotebookContent key={documentGeneration} store={store} />
}

function NotebookContent({ store }: { store: DocumentStore }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [, setError] = useValidationNotice()
  const list = useRef<HTMLOListElement>(null)
  const noteControl = useRef<HTMLButtonElement>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const pendingFocus = useRef<Selection | null>(null)
  const selected = document.notebook.find(block => block.id === selection?.blockId)
  const checklist = selected?.type === 'checklist' ? selected : undefined
  const item = checklist?.items.find(item => item.id === selection?.itemId)
  function mutate(command: DocumentCommand) {
    if (blockedRef.current) return false
    try {
      if (!store.applyDocumentCommand(command)) { setError(store.getSnapshot().fileMessage ?? 'No se pudo modificar el Cuaderno.'); return false }
      setError(null); return true
    }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo modificar el Cuaderno.'); return false }
  }
  function focus(target: Selection | null) {
    setSelection(target); pendingFocus.current = target
    if (!target) noteControl.current?.focus({ preventScroll: true })
  }
  useLayoutEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    const block = Array.from(list.current?.children ?? []).find(node => (node as HTMLElement).dataset.blockId === target.blockId)
    const row = target.itemId ? Array.from(block?.querySelectorAll<HTMLElement>('[data-item-id]') ?? []).find(node => node.dataset.itemId === target.itemId) : block
    const field = row?.querySelector<HTMLElement>('textarea') ?? row?.querySelector<HTMLElement>('[role="checkbox"], button')
    field?.focus()
  }, [document.notebook])
  function selectTarget(target: EventTarget) {
    if (blockedRef.current || !(target instanceof Element)) return
    const blockId = target.closest<HTMLElement>('[data-block-id]')?.dataset.blockId
    if (blockId) setSelection({ blockId, itemId: target.closest<HTMLElement>('[data-item-id]')?.dataset.itemId })
  }
  const reorder = useNotebookReorder(document.notebook, list, (id, targetId) => mutate(document => reorderNotebookBlock(document, id, targetId)))
  function add(type: NotebookBlock['type']) {
    let target: Selection | null = null
    if (mutate(document => {
      const result = addNotebookBlock(document, type)
      target = { blockId: result.value.id }
      if (result.value.type !== 'checklist') return result
      const withItem = addChecklistItem(result.document, result.value.id)
      target.itemId = withItem.value.id
      return withItem
    })) focus(target)
  }
  return <div data-slot="notebook-module" className={`${styles.base} notebook-module`}>
    <div className={`notebook-toolbar ${toolbarStyles.base}`} role="group" aria-label="Acciones del Cuaderno">
      <Button ref={noteControl} aria-label="Crear nota" disabled={blocked} onClick={() => add('note')}><StickyNote aria-hidden="true" /></Button>
      <Button aria-label="Crear checklist" disabled={blocked} onClick={() => add('checklist')}><ListChecks aria-hidden="true" /></Button>
      <Button aria-label="Eliminar bloque seleccionado" disabled={blocked || !selected} onClick={() => {
        if (!selected || blockedRef.current) return
        const index = document.notebook.indexOf(selected)
        const next = document.notebook[index + 1] ?? document.notebook[index - 1]
        if (mutate(document => deleteNotebookBlock(document, selected.id))) focus(next ? { blockId: next.id } : null)
      }}><Trash aria-hidden="true" /></Button>
      <div className="notebook-checklist-actions" role="group" aria-label="Filas del checklist seleccionado">
        <Button aria-label="Añadir fila al checklist" disabled={blocked || !checklist} onClick={() => {
          if (!checklist || blockedRef.current) return
          let itemId: string | undefined
          if (mutate(document => {
            const result = addChecklistItem(document, checklist.id, item?.id)
            itemId = result.value.id
            return result
          })) focus({ blockId: checklist.id, itemId })
        }}><Plus aria-hidden="true" /></Button>
        <Button aria-label="Eliminar fila seleccionada" disabled={blocked || !checklist || !item} onClick={() => {
          if (!checklist || !item || blockedRef.current) return
          const index = checklist.items.indexOf(item)
          const next = checklist.items[index + 1] ?? checklist.items[index - 1]
          if (mutate(document => deleteChecklistItem(document, checklist.id, item.id))) focus({ blockId: checklist.id, itemId: next?.id })
        }}><Minus aria-hidden="true" /></Button>
      </div>
    </div>
    <ol className="notebook-list" aria-label="Bloques del Cuaderno" ref={list}
      onPointerDownCapture={event => selectTarget(event.target)} onFocusCapture={event => selectTarget(event.target)}>
      {document.notebook.map((block, index) => <li key={block.id} className="notebook-block" data-block-id={block.id} data-block-type={block.type} data-selected={block.id === selected?.id}
        data-dragging={reorder.preview?.id === block.id} data-drop-target={reorder.preview?.targetId === block.id && reorder.preview.id !== block.id}>
        <Button appearance="integrated" className="notebook-handle" aria-label={`Reordenar bloque ${index + 1}`} disabled={blocked} {...reorder.handleProps(block.id)} />
        <div className="notebook-block-content">
          {block.type === 'note' ? <NoteBlock block={block} disabled={blocked} onEdit={text => mutate(document => editNotebookNote(document, block.id, text))} /> :
            <ChecklistBlock block={block} selectedItemId={block.id === selected?.id ? item?.id : undefined} disabled={blocked}
              onAdd={initial => {
                let itemId: string | undefined
                const accepted = mutate(document => {
                  const result = addChecklistItem(document, block.id, undefined, initial)
                  itemId = result.value.id
                  return result
                })
                if (accepted) focus({ blockId: block.id, itemId })
                return accepted
              }}
              onEdit={(id, text) => mutate(document => editChecklistItem(document, block.id, id, text))}
              onCheck={(id, checked) => mutate(document => setChecklistItemChecked(document, block.id, id, checked))} />}
        </div>
      </li>)}
    </ol>
  </div>
}
