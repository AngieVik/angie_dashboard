import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { DocumentStore } from '../document/documentStore'
import { addUnitTag } from '../../domain/operations/unitAnnotations'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { HelpTooltip } from '../../components/ui/tooltip'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { Check, Info, Pencil } from 'lucide-react'
import { useViewportInteraction } from '../../layout/ViewportContext'

export function UnitTags({ store, unitId }: { store: DocumentStore; unitId?: string }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const editControl = useRef<HTMLButtonElement>(null)
  const [error, setError] = useValidationNotice(null, 0, 3000)
  const errorId = useId()
  useLayoutEffect(() => { if (editing) input.current?.focus() }, [editing])
  return <div className="operations-tags" data-disabled={blocked || !unitId}>
    <form aria-label="Nueva etiqueta" className="unit-tag-add" onSubmit={event => {
      event.preventDefault()
      if (blockedRef.current || !unitId) return
      try {
        store.mutateDocument(document => addUnitTag(document, unitId, text))
        setText(''); setEditing(false); setError(null); editControl.current?.focus()
      } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo añadir la etiqueta.') }
    }}>
      {editing && <Info className="operations-tag-icon" aria-hidden="true" />}
      <Button type="submit" className="operations-activate" aria-label="Añadir etiqueta" title={text || 'Etiqueta'} hidden={editing} aria-describedby={error ? errorId : undefined} disabled={blocked || !unitId}><Info className="operations-tag-icon" aria-hidden="true" /><span className="operations-state-name" aria-hidden="true">{text || 'Etiqueta'}</span><span className="operations-state-abbr technical-data" aria-hidden="true">ETQ</span></Button>
      <Input ref={input} aria-label="Nueva etiqueta" placeholder="Etiqueta" hidden={!editing} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} value={text} disabled={blocked || !unitId} onKeyDown={event => {
        if (event.key === 'Escape' && !blockedRef.current) { event.preventDefault(); setEditing(false); editControl.current?.focus() }
      }} onChange={event => { setText(event.target.value); setError(null) }} />
      <HelpTooltip text={editing ? 'Agregar etiqueta' : 'Editar etiqueta'}><Button ref={editControl} type={editing ? 'submit' : 'button'} className="operations-edit" aria-label={editing ? 'Agregar etiqueta' : 'Editar etiqueta'} aria-expanded={editing} disabled={blocked || !unitId} onClick={event => {
        if (!editing) { event.preventDefault(); if (!blockedRef.current) setEditing(true) }
      }}>{editing ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}</Button></HelpTooltip>
    </form>
    {error && <p id={errorId} className="operations-error" role="alert">{error}</p>}
  </div>
}
