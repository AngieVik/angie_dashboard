import { useRef, useState } from 'react'
import type { DocumentElement, Position } from '../../domain/document/types'
import { Button } from '../../components/ui/button'
import { useViewportInteraction } from '../../layout/ViewportContext'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { createElement, updateElement, duplicateElement, deleteElement } from './elementCommands'
import { ElementEditor } from './ElementEditor'
import { ICON_CATALOG } from './iconCatalog'
import './elements.css'
export interface ElementsModuleProps { store: DocumentStore; selectedId: string | null; onSelect: (id: string | null) => void; placementPosition?: Position }
export function ElementsModule({ store, selectedId, onSelect, placementPosition, isUnit = false }: ElementsModuleProps & { isUnit?: boolean }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [editor, setEditor] = useState<'create' | 'edit' | null>(null)
  const addControl = useRef<HTMLButtonElement>(null), modifyControl = useRef<HTMLButtonElement>(null)
  function focusAction() { (editor === 'edit' ? modifyControl : addControl).current?.focus() }
  const selected = document.elements.find(element => element.id === selectedId && element.isUnit === isUnit)
  function list(elements: DocumentElement[]) {
    return elements.map(element => <Button key={element.id} aria-label={`Seleccionar ${element.name}`} aria-pressed={element.id === selectedId} disabled={blocked}
      onClick={() => { if (!blockedRef.current) onSelect(element.id) }}>
      {element.visual.type === 'asset' ? <img src={ICON_CATALOG[element.visual.assetId].path} alt="" /> : <span aria-hidden="true">{element.visual.value}</span>}
      <span>{element.name}</span>
    </Button>)
  }
  const editing = editor === 'create' || (editor === 'edit' && selected)
  return <div className="elements-module">
    <div className="elements-configure-actions" role="group" aria-label="Acciones de elementos">
        <Button ref={addControl} disabled={blocked} onClick={() => { if (!blockedRef.current) setEditor('create') }}>Añadir</Button>
        <Button ref={modifyControl} disabled={blocked || !selected} onClick={() => { if (!blockedRef.current) setEditor('edit') }}>Modificar</Button>
        <Button disabled={blocked || !selected} onClick={() => {
          if (!selected || blockedRef.current) return
          let copyId = ''
          store.mutateDocument(document => { copyId = duplicateElement(document, selected.id).id })
          addControl.current?.focus()
          onSelect(copyId); setEditor(null)
        }}>Duplicar</Button>
        <Button disabled={blocked || !selected} onClick={() => {
          if (!selected || blockedRef.current) return
          store.mutateDocument(document => deleteElement(document, selected.id))
          addControl.current?.focus()
          onSelect(null); setEditor(null)
        }}>Quitar</Button>
    </div>
    {editing ? <ElementEditor key={editor === 'edit' ? selected?.id : 'create'} element={editor === 'edit' ? selected : undefined} isUnit={isUnit}
      onCancel={() => { focusAction(); setEditor(null) }} onSave={input => {
        if (blockedRef.current) return
        let id = selectedId
        store.mutateDocument(document => {
          if (editor === 'edit' && selected) updateElement(document, selected.id, { name: input.name, information: input.information, visual: input.visual })
          else id = createElement(document, { ...input, position: placementPosition }).id
        })
        focusAction()
        onSelect(id); setEditor(null)
      }} /> : <div className="elements-list">
      <section aria-label={isUnit ? 'Dotaciones' : 'Generales'}><h3>{isUnit ? 'Dotaciones' : 'Generales'}</h3>
        <div className="element-rows">{list(document.elements.filter(element => element.isUnit === isUnit))}</div>
      </section>
    </div>}
  </div>
}
