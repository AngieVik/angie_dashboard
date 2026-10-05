import { useRef, useState } from 'react'
import type { DocumentStore } from '../document/documentStore'
import { addUnitTag, editUnitTag, removeUnitTag } from '../../domain/operations/unitAnnotations'
import type { AngieDocument } from '../../domain/document/types'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { useViewportInteraction } from '../../layout/ViewportContext'

export function UnitTags({ store, unitId, tags }: { store: DocumentStore; unitId: string; tags: string[] }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const newTagInput = useRef<HTMLInputElement>(null)
  function finishEditing() { newTagInput.current?.focus(); setEditing(null) }
  function mutate(action: (document: AngieDocument) => void, success: () => void) {
    if (blockedRef.current) return
    try { store.mutateDocument(action); setError(null); success() }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo modificar la etiqueta.') }
  }
  return <div className="operations-tags">
    <div className="operations-tag-list" aria-label="Etiquetas">
      {tags.map((tag, index) => editing?.index === index ? <form key={index} aria-label="Editar etiqueta" className="unit-tag-editor" onSubmit={event => {
        event.preventDefault()
        mutate(document => editUnitTag(document, unitId, index, editing.text), finishEditing)
      }}>
        <Input aria-label="Editar etiqueta" autoFocus value={editing.text} disabled={blocked} onChange={event => setEditing({ index, text: event.target.value })}
          onKeyDown={event => { if (event.key === 'Escape') { finishEditing(); setError(null) } }} />
        <Button type="submit" aria-label="Guardar etiqueta" disabled={blocked}>✓</Button>
        <Button aria-label="Cancelar edición de etiqueta" disabled={blocked} onClick={() => { finishEditing(); setError(null) }}>×</Button>
      </form> : <span className="unit-tag-actions" key={index}>
        <Button aria-label={`Editar etiqueta ${tag}`} disabled={blocked} onClick={() => {
          if (!blockedRef.current) { setEditing({ index, text: tag }); setError(null) }
        }}><Badge>{tag}</Badge></Button>
        <Button aria-label={`Eliminar etiqueta ${tag}`} disabled={blocked} onClick={() => mutate(document => removeUnitTag(document, unitId, index), finishEditing)}>×</Button>
      </span>)}
    </div>
    <form aria-label="Nueva etiqueta" className="unit-tag-add" onSubmit={event => {
      event.preventDefault()
      mutate(document => addUnitTag(document, unitId, text), () => setText(''))
    }}>
      <Input ref={newTagInput} aria-label="Nueva etiqueta" placeholder="Nueva etiqueta" value={text} disabled={blocked} onChange={event => { setText(event.target.value); setError(null) }} />
      <Button type="submit" disabled={blocked}>Añadir</Button>
    </form>
    {error && <p className="operations-error" role="alert">{error}</p>}
  </div>
}
