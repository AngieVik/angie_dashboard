import { useLayoutEffect, useRef } from 'react'
import type { NotebookBlock } from '../../domain/document/types'
import { Button } from '../../components/ui/button'
import { useAutoGrowingTextarea } from './useAutoGrowingTextarea'

function ItemText({ text, index, disabled, onEdit }: { text: string; index: number; disabled: boolean; onEdit: (text: string) => void }) {
  const ref = useAutoGrowingTextarea(text)
  return <textarea ref={ref} aria-label={`Texto del elemento ${index + 1}`} rows={1} value={text} disabled={disabled}
    onChange={event => onEdit(event.target.value)} />
}

export function ChecklistBlock({ block, disabled, onAdd, onEdit, onCheck, onDelete }: {
  block: Extract<NotebookBlock, { type: 'checklist' }>; disabled: boolean
  onAdd: (afterItemId?: string) => void; onEdit: (id: string, text: string) => void
  onCheck: (id: string, checked: boolean) => void; onDelete: (id: string) => void
}) {
  const addControl = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<number | null>(null)
  useLayoutEffect(() => {
    const index = pendingFocus.current
    if (index === null) return
    pendingFocus.current = null
    if (index < 0) addControl.current?.focus()
    else root.current?.querySelectorAll('textarea')[index]?.focus()
  }, [block.items])
  return <div ref={root} className="notebook-checklist">
    <ul aria-label="Elementos del checklist">{block.items.map((item, index) => <li key={item.id} data-item-id={item.id} data-checked={item.checked}>
      <input type="checkbox" aria-label={`Marcar elemento ${index + 1}`} checked={item.checked} disabled={disabled}
        onChange={event => onCheck(item.id, event.target.checked)} />
      <ItemText text={item.text} index={index} disabled={disabled} onEdit={text => onEdit(item.id, text)} />
      <Button aria-label={`Añadir elemento después de ${index + 1}`} title="Añadir elemento" disabled={disabled} onClick={() => { pendingFocus.current = index + 1; onAdd(item.id) }}>+</Button>
      <Button aria-label={`Eliminar elemento ${index + 1}`} title="Eliminar elemento" disabled={disabled} onClick={() => { pendingFocus.current = Math.min(index, block.items.length - 2); onDelete(item.id) }}>×</Button>
    </li>)}</ul>
    {block.items.length === 0 && <Button ref={addControl} aria-label="Añadir elemento" title="Añadir elemento" disabled={disabled} onClick={() => { pendingFocus.current = 0; onAdd() }}>+</Button>}
  </div>
}
