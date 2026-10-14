import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { Position } from '../../domain/document/types'
import { Button } from '../../components/ui/button'
import { HelpTooltip } from '../../components/ui/tooltip'
import { CopyPlus, Eye, EyeOff, Trash, Wrench } from 'lucide-react'
import { useViewportInteraction } from '../../layout/ViewportContext'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { createElement, updateElement, duplicateElement, deleteElement, togglePinVisibility } from './elementCommands'
import { ElementEditor } from './ElementEditor'
import { ICON_CATALOG } from './iconCatalog'
import { pinNameLines } from './pinPresentation'
import './elements.css'
export interface ElementsModuleProps { store: DocumentStore; selectedId: string | null; onSelect: (id: string | null) => void; placementPosition?: Position; editRequest?: { id: string } }
type Props = ElementsModuleProps & { isUnit?: boolean }
export function ElementsModule(props: Props) {
  const { documentGeneration } = useDocumentStore(props.store)
  return <ElementsContent key={documentGeneration} {...props} />
}
function ElementsContent({ store, selectedId, onSelect, placementPosition, editRequest, isUnit = false }: Props) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const formId = useId()
  const [editor, setEditor] = useState<{ kind: 'create' | 'edit'; id: string | null } | null>(null)
  const [handledEdit, setHandledEdit] = useState<typeof editRequest>(undefined)
  const cardPointer = useRef<{ id: number; elementId: string; x: number; y: number } | null>(null)
  const lastCardTap = useRef<{ id: string; time: number; x: number; y: number } | null>(null)
  const emptyPointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const dragged = useRef(false)
  const addControl = useRef<HTMLButtonElement>(null)
  const selected = document.elements.find(element => element.id === selectedId && element.isUnit === isUnit)
  const edited = editor?.id ? document.elements.find(element => element.id === editor.id && element.isUnit === isUnit) : undefined
  if (editor?.kind === 'edit' && editor.id !== selected?.id) setEditor(null)
  if (editRequest !== handledEdit) {
    setHandledEdit(editRequest)
    if (editRequest && document.elements.some(element => element.id === editRequest.id && element.isUnit === isUnit)) setEditor({ kind: 'edit', id: editRequest.id })
  }
  const focusList = useRef(false)
  useLayoutEffect(() => {
    if (!editor && focusList.current) { addControl.current?.focus(); focusList.current = false }
  }, [editor])
  function back() { focusList.current = true; onSelect(null); setEditor(null) }
  useLayoutEffect(() => {
    if (blocked) { cardPointer.current = null; lastCardTap.current = null }
  }, [blocked])
  function edit(id: string) {
    if (blockedRef.current) return
    lastCardTap.current = null
    onSelect(id); setEditor({ kind: 'edit', id })
  }
  return <div className="elements-module">
    <div className="elements-configure-actions">
      <Button ref={addControl} type={editor ? 'submit' : 'button'} form={editor ? formId : undefined} disabled={blocked} onClick={event => {
        if (!editor) {
          event.preventDefault()
          if (!blockedRef.current) setEditor({ kind: 'create', id: null })
        }
      }}>{editor?.kind === 'edit' ? 'Guardar' : 'Crear'}</Button>
      {editor && <>
        <Button type="submit" form={formId} name="action" value="apply" disabled={blocked}>Aplicar</Button>
        <Button disabled={blocked} onClick={() => { if (!blockedRef.current) back() }}>Atrás</Button>
      </>}
    </div>
    {editor ? <ElementEditor key={editor.kind === 'create' ? 'create' : editor.id} element={edited} creating={editor.kind === 'create'} isUnit={isUnit}
      formId={formId} onSave={(input, keepOpen) => {
        if (blockedRef.current) return
        let id: string | null = null
        store.mutateDocument(document => {
          if (edited) {
            updateElement(document, edited.id, { name: input.name, information: input.information, visual: input.visual, nameFontSize: input.nameFontSize, nameHidden: input.nameHidden, nameOffset: input.nameOffset, nameColor: input.nameColor })
            id = edited.id
          } else id = createElement(document, { ...input, position: placementPosition }).id
        })
        onSelect(id)
        if (keepOpen) setEditor({ kind: editor.kind, id })
        else { focusList.current = true; setEditor(null) }
      }} /> : <>
      <div className="elements-list" onPointerDown={event => {
        dragged.current = false
        emptyPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
      }} onPointerUp={event => {
        const pointer = emptyPointer.current
        dragged.current = Boolean(pointer && pointer.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4)
        emptyPointer.current = null
      }} onPointerCancel={() => { emptyPointer.current = null; dragged.current = true }} onClick={event => {
        if (dragged.current) { dragged.current = false; return }
        if (!blockedRef.current && !(event.target as HTMLElement).closest('.element-row, button, input, textarea, select')) onSelect(null)
      }}>
        <section aria-label={isUnit ? 'Dotaciones' : 'Generales'}>
          <div className="element-rows">{document.elements.filter(element => element.isUnit === isUnit).map(element => {
            return <div className="element-row" key={element.id} data-selected={element.id === selectedId} data-unit={element.isUnit}>
              <Button className="document-button element-select" aria-label={`Seleccionar ${element.name}`} aria-pressed={element.id === selectedId} disabled={blocked}
                onClick={() => { if (!blockedRef.current) onSelect(element.id) }} onDoubleClick={() => edit(element.id)}
                onPointerDown={event => {
                  if (blockedRef.current) { lastCardTap.current = null; return }
                  cardPointer.current = { id: event.pointerId, elementId: element.id, x: event.clientX, y: event.clientY }
                }} onPointerMove={event => {
                  const pointer = cardPointer.current
                  if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4) {
                    cardPointer.current = null; lastCardTap.current = null
                  }
                }} onPointerUp={event => {
                  const pointer = cardPointer.current
                  cardPointer.current = null
                  if (blockedRef.current || event.pointerType !== 'touch' || pointer?.id !== event.pointerId || pointer.elementId !== element.id ||
                    Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4) { lastCardTap.current = null; return }
                  const previous = lastCardTap.current, time = Date.now()
                  if (previous?.id === element.id && time - previous.time <= 350 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 24) {
                    event.preventDefault(); edit(element.id)
                  } else lastCardTap.current = { id: element.id, time, x: event.clientX, y: event.clientY }
                }} onPointerCancel={() => { cardPointer.current = null; lastCardTap.current = null }}>
                {element.visual.type === 'asset' ? <img src={ICON_CATALOG[element.visual.assetId].path} alt="" /> : <span className="element-row-emoji" aria-hidden="true">{element.visual.value}</span>}
                <span className="element-row-text"><strong title={element.name}>{pinNameLines(element.name).map((line, index) => <span key={index}>{line}</span>)}</strong></span>
              </Button>
              <div className="element-row-actions" role="group" aria-label={`Acciones de ${element.name}`}>
                <HelpTooltip text="Modificar"><Button aria-label="Modificar" disabled={blocked} onClick={() => {
                  if (blockedRef.current) return
                  onSelect(element.id); setEditor({ kind: 'edit', id: element.id })
                }}><Wrench aria-hidden="true" /></Button></HelpTooltip>
                <HelpTooltip text="Duplicar"><Button aria-label="Duplicar" disabled={blocked} onClick={() => {
                  if (blockedRef.current) return
                  let id = ''
                  store.mutateDocument(document => { id = duplicateElement(document, element.id).id })
                  addControl.current?.focus(); onSelect(id)
                }}><CopyPlus aria-hidden="true" /></Button></HelpTooltip>
                <HelpTooltip text="Quitar"><Button aria-label="Quitar" disabled={blocked} onClick={() => {
                  if (blockedRef.current) return
                  store.mutateDocument(document => deleteElement(document, element.id))
                  if (selectedId === element.id) onSelect(null)
                  addControl.current?.focus()
                }}><Trash aria-hidden="true" /></Button></HelpTooltip>
                <HelpTooltip text={element.pinVisible ? 'Ocultar pin' : 'Mostrar pin'}><Button aria-label={`${element.pinVisible ? 'Ocultar' : 'Mostrar'} pin de ${element.name}`} disabled={blocked} onClick={() => {
                  if (!blockedRef.current) store.mutateDocument(document => togglePinVisibility(document, element.id))
                }}>{element.pinVisible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</Button></HelpTooltip>
              </div>
            </div>
          })}</div>
          {!document.elements.some(element => element.isUnit === isUnit) && <p className="elements-empty">{isUnit ? 'Sin dotaciones' : 'Sin elementos'}</p>}
        </section>
      </div>
    </>}
  </div>
}
