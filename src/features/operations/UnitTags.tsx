import { useId, useRef, useState } from 'react'
import type { DocumentStore } from '../document/documentStore'
import { addUnitTag, editUnitTag, removeUnitTag } from '../../domain/operations/unitAnnotations'
import type { AngieDocument } from '../../domain/document/types'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { InputGroup } from '../../components/ui/input-group'
import { Badge } from '../../components/ui/badge'
import { useValidationNotice } from '../../components/ui/useValidationNotice'
import { Check, X, Trash } from 'lucide-react'
import { useViewportInteraction } from '../../layout/ViewportContext'

export function UnitTags({ store, unitId, tags }: { store: DocumentStore; unitId: string; tags: string[] }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null)
  const [error, setError] = useValidationNotice()
  const errorId = useId()
  const [errorField, setErrorField] = useState<'new' | 'edit' | null>(null)
  const newTagInput = useRef<HTMLInputElement>(null)
  function finishEditing() { newTagInput.current?.focus(); setEditing(null) }
  function mutate(action: (document: AngieDocument) => void, success: () => void, field: 'new' | 'edit' | null = null) {
    if (blockedRef.current) return
    try { store.mutateDocument(action); setError(null); success() }
    catch (error) { setErrorField(field); setError(error instanceof Error ? error.message : 'No se pudo modificar la etiqueta.') }
  }
  return <div className="operations-tags">
    <div className="operations-tag-list" aria-label="Etiquetas">
      {tags.map((tag, index) => editing?.index === index ? <form key={index} aria-label="Editar etiqueta" className="unit-tag-editor" onSubmit={event => {
        event.preventDefault()
        mutate(document => editUnitTag(document, unitId, index, editing.text), finishEditing, 'edit')
      }}>
        <Input aria-label="Editar etiqueta" aria-invalid={Boolean(error && errorField === 'edit')} aria-describedby={error && errorField === 'edit' ? errorId : undefined} autoFocus value={editing.text} disabled={blocked} onChange={event => setEditing({ index, text: event.target.value })}
          onKeyDown={event => { if (event.key === 'Escape') { finishEditing(); setError(null) } }} />
        <Button type="submit" aria-label="Guardar etiqueta" disabled={blocked}><Check aria-hidden="true" /></Button>
        <Button aria-label="Cancelar edición de etiqueta" disabled={blocked} onClick={() => { finishEditing(); setError(null) }}><X aria-hidden="true" /></Button>
      </form> : <span className="unit-tag-actions" key={index}>
        <Button aria-label={`Editar etiqueta ${tag}`} disabled={blocked} onClick={() => {
          if (!blockedRef.current) { setEditing({ index, text: tag }); setError(null) }
        }}><Badge>{tag}</Badge></Button>
        <Button aria-label={`Eliminar etiqueta ${tag}`} disabled={blocked} onClick={() => mutate(document => removeUnitTag(document, unitId, index), finishEditing)}><Trash aria-hidden="true" /></Button>
      </span>)}
    </div>
    <form aria-label="Nueva etiqueta" className="unit-tag-add" onSubmit={event => {
      event.preventDefault()
      mutate(document => addUnitTag(document, unitId, text), () => setText(''), 'new')
    }}>
      <InputGroup>
        <Input ref={newTagInput} aria-label="Nueva etiqueta" aria-invalid={Boolean(error && errorField === 'new')} aria-describedby={error && errorField === 'new' ? errorId : undefined} placeholder="Etiqueta" value={text} disabled={blocked} onChange={event => { setText(event.target.value); setError(null) }} />
        <Button type="submit" aria-label="Añadir etiqueta" disabled={blocked}><Check aria-hidden="true" /></Button>
      </InputGroup>
    </form>
    {error && <p id={errorId} className="operations-error" role="alert">{error}</p>}
  </div>
}
