import { useId, useState } from 'react'
import type { DocumentStore } from '../document/documentStore'
import { addUnitTag } from '../../domain/operations/unitAnnotations'
import { Input } from '../../components/ui/input'
import { useValidationNotice } from '../../components/ui/useValidationNotice'
import { Info } from 'lucide-react'
import { useViewportInteraction } from '../../layout/ViewportContext'

export function UnitTags({ store, unitId }: { store: DocumentStore; unitId?: string }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [text, setText] = useState('')
  const [error, setError] = useValidationNotice()
  const errorId = useId()
  return <div className="operations-tags">
    <form aria-label="Nueva etiqueta" className="unit-tag-add" onSubmit={event => {
      event.preventDefault()
      if (blockedRef.current || !unitId) return
      try {
        store.mutateDocument(document => addUnitTag(document, unitId, text))
        setText(''); setError(null)
      } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo añadir la etiqueta.') }
    }}>
      <Info aria-hidden="true" />
      <Input aria-label="Nueva etiqueta" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} value={text} disabled={blocked || !unitId} onChange={event => { setText(event.target.value); setError(null) }} />
    </form>
    {error && <p id={errorId} className="operations-error" role="alert">{error}</p>}
  </div>
}
