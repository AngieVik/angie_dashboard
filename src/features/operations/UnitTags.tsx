import { useState } from 'react'
import type { DocumentStore } from '../document/documentStore'
import { addUnitTag, editUnitTag, removeUnitTag } from '../../domain/operations/unitAnnotations'
import type { AngieDocumentV1 } from '../../domain/document/types'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useViewportInteraction } from '../../layout/ViewportContext'

export function UnitTags({ store, unitId, tags }: { store: DocumentStore; unitId: string; tags: string[] }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  function mutate(action: (document: AngieDocumentV1) => void, success: () => void) {
    if (blockedRef.current) return
    try { store.mutateDocument(action); setError(null); success() }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo modificar la etiqueta.') }
  }
  return <div className="operations-tags">
    <div className="operations-tag-list" aria-label="Etiquetas">
      {tags.map((tag, index) => editing?.index === index ? <form key={index} aria-label="Editar etiqueta" className="unit-tag-editor" onSubmit={event => {
        event.preventDefault()
        mutate(document => editUnitTag(document, unitId, index, editing.text), () => setEditing(null))
      }}>
        <Input aria-label="Editar etiqueta" autoFocus value={editing.text} disabled={blocked} onChange={event => setEditing({ index, text: event.target.value })}
          onKeyDown={event => { if (event.key === 'Escape') { setEditing(null); setError(null) } }} />
        <Button type="submit" aria-label="Guardar etiqueta" disabled={blocked}>✓</Button>
        <Button aria-label="Cancelar edición de etiqueta" disabled={blocked} onClick={() => { setEditing(null); setError(null) }}>×</Button>
      </form> : <span className="unit-tag" key={index}>
        <Button aria-label={`Editar etiqueta ${tag}`} disabled={blocked} onClick={() => {
          if (!blockedRef.current) { setEditing({ index, text: tag }); setError(null) }
        }}>{tag}</Button>
        <Button aria-label={`Eliminar etiqueta ${tag}`} disabled={blocked} onClick={() => mutate(document => removeUnitTag(document, unitId, index), () => setEditing(null))}>×</Button>
      </span>)}
    </div>
    <form aria-label="Nueva etiqueta" className="unit-tag-add" onSubmit={event => {
      event.preventDefault()
      mutate(document => addUnitTag(document, unitId, text), () => setText(''))
    }}>
      <Input aria-label="Nueva etiqueta" placeholder="Nueva etiqueta" value={text} disabled={blocked} onChange={event => { setText(event.target.value); setError(null) }} />
      <Button type="submit" disabled={blocked}>Añadir</Button>
    </form>
    {error && <p className="operations-error" role="alert">{error}</p>}
  </div>
}
