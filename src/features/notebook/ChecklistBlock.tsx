import type { NotebookBlock } from '../../domain/document/types'
import { Button } from '../../components/ui/button'

export function ChecklistBlock({ block, disabled, onAdd, onEdit, onCheck, onDelete }: {
  block: Extract<NotebookBlock, { type: 'checklist' }>; disabled: boolean
  onAdd: () => void; onEdit: (id: string, text: string) => void
  onCheck: (id: string, checked: boolean) => void; onDelete: (id: string) => void
}) {
  return <div className="notebook-checklist">
    <ul aria-label="Elementos del checklist">{block.items.map((item, index) => <li key={item.id} data-item-id={item.id} data-checked={item.checked}>
      <input type="checkbox" aria-label={`Marcar elemento ${index + 1}`} checked={item.checked} disabled={disabled}
        onChange={event => onCheck(item.id, event.target.checked)} />
      <textarea aria-label={`Texto del elemento ${index + 1}`} rows={2} value={item.text} disabled={disabled}
        onChange={event => onEdit(item.id, event.target.value)} />
      <Button aria-label={`Eliminar elemento ${index + 1}`} title="Eliminar elemento" disabled={disabled} onClick={() => onDelete(item.id)}>×</Button>
    </li>)}</ul>
    <Button aria-label="Añadir elemento" disabled={disabled} onClick={onAdd}>+ Elemento</Button>
  </div>
}
