import { useRef, useState } from 'react'
import type { DocumentElement } from '../../domain/document/types'
import { Button } from '../../components/ui/button'
import { useViewportInteraction } from '../../layout/ViewportContext'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { createElement, updateElement, duplicateElement, deleteElement } from './elementCommands'
import { ElementEditor } from './ElementEditor'
import { ICON_CATALOG } from './iconCatalog'
import './elements.css'
export interface ElementsModuleProps { store: DocumentStore; selectedId: string | null; onSelect: (id: string | null) => void }
export function ElementsModule({ store, selectedId, onSelect }: ElementsModuleProps) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [configure, setConfigure] = useState(false)
  const [editor, setEditor] = useState<'create' | 'edit' | null>(null)
  const configureControl = useRef<HTMLButtonElement>(null)
  const selected = document.elements.find(element => element.id === selectedId)
  function list(elements: DocumentElement[]) {
    return elements.map(element => <Button key={element.id} aria-label={`Seleccionar ${element.name}`} aria-pressed={element.id === selectedId} disabled={blocked}
      onClick={() => { if (!blockedRef.current) onSelect(element.id) }}>
      {element.visual.type === 'asset' ? <img src={ICON_CATALOG[element.visual.assetId].path} alt="" /> : <span aria-hidden="true">{element.visual.value}</span>}
      <span>{element.name}</span>
    </Button>)
  }
  const editing = editor === 'create' || (editor === 'edit' && selected)
  return <div className="elements-module">
    <div className="elements-configure"><Button ref={configureControl} aria-label="Configurar elementos" aria-expanded={configure} disabled={blocked} onClick={() => setConfigure(!configure)}>⚙</Button>
      {configure && <div role="region" aria-label="Configuración de elementos" className="elements-configure-actions">
        <Button disabled={blocked} onClick={() => { setEditor('create'); setConfigure(false) }}>Añadir</Button>
        <Button disabled={blocked || !selected} onClick={() => { setEditor('edit'); setConfigure(false) }}>Modificar</Button>
        <Button disabled={blocked || !selected} onClick={() => {
          if (!selected || blockedRef.current) return
          let copyId = ''
          store.mutateDocument(document => { copyId = duplicateElement(document, selected.id).id })
          configureControl.current?.focus()
          onSelect(copyId); setEditor(null); setConfigure(false)
        }}>Duplicar</Button>
        <Button disabled={blocked || !selected} onClick={() => {
          if (!selected || blockedRef.current) return
          store.mutateDocument(document => deleteElement(document, selected.id))
          configureControl.current?.focus()
          onSelect(null); setEditor(null); setConfigure(false)
        }}>Quitar</Button>
      </div>}
    </div>
    {editing ? <ElementEditor key={editor === 'edit' ? selected?.id : 'create'} element={editor === 'edit' ? selected : undefined}
      onCancel={() => { configureControl.current?.focus(); setEditor(null) }} onScale={scale => {
        if (selected?.visual.type !== 'asset' || blockedRef.current) return
        store.mutateDocument(document => updateElement(document, selected.id, { visual: { ...selected.visual, scale } as typeof selected.visual }))
      }} onSave={input => {
        if (blockedRef.current) return
        let id = selectedId
        store.mutateDocument(document => {
          if (editor === 'edit' && selected) updateElement(document, selected.id, { name: input.name, information: input.information, visual: input.visual })
          else id = createElement(document, input).id
        })
        configureControl.current?.focus()
        onSelect(id); setEditor(null)
      }} /> : <div className="elements-list">
      <section aria-label="Dotaciones"><h3>Dotaciones</h3>
        <div className="element-rows">{list(document.elements.filter(element => element.isUnit))}</div>
      </section>
      <section aria-label="Generales"><h3>Generales</h3><div className="element-rows">{list(document.elements.filter(element => !element.isUnit))}</div></section>
    </div>}
  </div>
}
