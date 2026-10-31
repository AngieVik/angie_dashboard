import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import type { DocumentStore } from '../document/documentStore'
import { useDocumentStore } from '../document/documentStore'
import { OPERATIONAL_STATUSES } from '../../domain/operations/statuses'
import { changeElementStatus } from '../../domain/operations/changeStatus'
import { setUnitNotes, setUnitNotesColor } from '../../domain/operations/unitAnnotations'
import { Button } from '@/components/ui/button'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { OperationalStatusIcon } from './OperationalStatusIcon'

import { Textarea } from '@/components/ui/textarea'
import styles from './OperationsModule.module.css'
import buttonStyles from '@/components/ui/button/button.module.css'

export function OperationsModule({ store, selectedId }: { store: DocumentStore; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { document } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const [, setError] = useValidationNotice(null, 0, 3000)
  const selected = document.elements.find(element => element.id === selectedId)
  const unit = selected?.isUnit ? selected : null
  const currentEntry = document.timeline.find(entry => entry.id.toLowerCase() === unit?.operational.currentEntryId?.toLowerCase())
  const custom = unit?.operational.status === 'Personalizada' && currentEntry?.type === 'status-change' ? currentEntry : undefined
  return <div data-slot="operations-module" className={`${styles.base} operations-module`}>
    <div className="operations-cards">
      <div className="operations-states" role="group" aria-label="Estado operativo">
        {OPERATIONAL_STATUSES.map(({ status, icon, abbreviation }) => <Button key={status} className="operations-state" aria-label={status} aria-pressed={unit?.operational.status === status} disabled={blocked || !unit}
          onClick={() => {
            if (blockedRef.current || !unit || unit.operational.status === status) return
            try {
              store.mutateDocument(document => Object.assign(document, changeElementStatus(document, unit.id, status, new Date())))
              setError(null)
            } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cambiar el estado.') }
          }}><OperationalStatusIcon icon={icon} /><span className="operations-state-name" aria-hidden="true">{status}</span><span className="operations-state-abbr technical-data" aria-hidden="true">{abbreviation}</span></Button>)}
        {[1, 2].map(index => <UnitNotes key={index} store={store} unitId={unit?.id} index={index} activeLabel={custom?.customLabel} activeColor={custom?.customColor} />)}
      </div>
    </div>

  </div>
}

function UnitNotes({ store, unitId, index, activeLabel, activeColor }: { store: DocumentStore; unitId?: string; index: number; activeLabel?: string; activeColor?: string }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [notes, setNotes] = useState('')
  const [draftNotes, setDraftNotes] = useState('')
  const [draftColor, setDraftColor] = useState('#d63a3a')
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const editControl = useRef<HTMLButtonElement>(null)
  const acceptControl = useRef<HTMLButtonElement>(null)
  const cancelControl = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState(false)
  const [, setError] = useValidationNotice(null, 0, 3000)
  const active = Boolean(notes && activeLabel === notes && activeColor === draftColor)
  useLayoutEffect(() => { if (editing) notesRef.current?.focus() }, [editing, notesRef])
  useEffect(() => {
    if (!editing) return
    function cancelOutside(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node) || notesRef.current?.contains(target) || acceptControl.current?.contains(target) || cancelControl.current?.contains(target)) return
      setEditing(false)
    }
    window.addEventListener('pointerdown', cancelOutside, true)
    return () => window.removeEventListener('pointerdown', cancelOutside, true)
  }, [editing])
  function finish(accept: boolean) {
    if (blockedRef.current) return
    if (accept) setNotes(draftNotes.trim())
    setEditing(false)
    requestAnimationFrame(() => editControl.current?.focus())
  }
  function apply() {
    if (blockedRef.current || !unitId || !notes) return
    try {
      store.mutateDocument(document => {
        setUnitNotes(document, unitId, notes)
        setUnitNotesColor(document, unitId, draftColor)
        Object.assign(document, changeElementStatus(document, unitId, 'Personalizada', new Date()))
      })
      setError(null)
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo aplicar el estado personalizado.') }
  }
  return <div className={`operations-notes ${!editing && (blocked || !notes) ? buttonStyles.disabled : ''}`} data-active={active} data-disabled={blocked || !notes}>
    <div className="operations-custom-row">
      <label className="operations-note-color">
        <OperationalStatusIcon color={draftColor} />
        <input type="color" aria-label="Color de anotación" value={draftColor} disabled={blocked} onChange={event => {
          if (blockedRef.current) return
          setDraftColor(event.target.value); setError(null)
        }} />
      </label>
      <Button appearance="integrated" variant="text" className="operations-activate" aria-label={notes ? 'Aplicar ' + notes : 'Estado personalizado ' + index + ' no disponible'} aria-pressed={active} hidden={editing} disabled={blocked || !unitId || !notes} onClick={apply}><span className="operations-custom-name" aria-hidden="true">{notes}</span></Button>
      <Textarea ref={notesRef} className={styles.annotation} rows={1} wrap="off" aria-label={'Nombre del estado personalizado ' + index} hidden={!editing} value={draftNotes} disabled={blocked} onKeyDown={event => {
        if (blockedRef.current) return
        if (event.key === 'Escape' || event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault(); finish(event.key === 'Enter')
        }
      }} onChange={event => {
        if (blockedRef.current) return
        setDraftNotes(event.target.value); setError(null)
      }} />
      {editing ? <>
        <Button ref={acceptControl} className="operations-edit" aria-label={'Aceptar estado personalizado ' + index} disabled={blocked} onClick={() => finish(true)}><Check aria-hidden="true" /></Button>
        <Button ref={cancelControl} className="operations-edit" aria-label={'Cancelar edición del estado personalizado ' + index} disabled={blocked} onClick={() => finish(false)}><X aria-hidden="true" /></Button>
      </> : <Button ref={editControl} className="operations-edit" aria-label={'Editar estado personalizado ' + index} aria-expanded={editing} disabled={blocked} onClick={() => {
        if (blockedRef.current) return
        setDraftNotes(notes); setError(null); setEditing(true)
      }}><Pencil aria-hidden="true" /></Button>}
    </div>

  </div>
}
