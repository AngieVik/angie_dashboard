import { useLayoutEffect, useRef } from 'react'
import type { NotebookBlock } from '../../domain/document/types'
import { Textarea } from '../../components/ui/textarea'
import { HelpTooltip } from '../../components/ui/tooltip'
import { Button } from '../../components/ui/button'
import { Minus, Plus } from 'lucide-react'
import { useAutoGrowingTextarea } from './useAutoGrowingTextarea'

function ItemText({ text, index, disabled, onEdit }: { text: string; index: number; disabled: boolean; onEdit: (text: string) => void }) {
  const ref = useAutoGrowingTextarea(text)
  return <Textarea ref={ref} aria-label={`Texto del elemento ${index + 1}`} rows={1} value={text} disabled={disabled}
    onChange={event => onEdit(event.target.value)} />
}

export function ChecklistBlock({ block, disabled, onAdd, onEdit, onCheck, onDelete }: {
  block: Extract<NotebookBlock, { type: 'checklist' }>; disabled: boolean
  onAdd: (afterItemId?: string, initial?: { text: string; checked: boolean }) => void; onEdit: (id: string, text: string) => void
  onCheck: (id: string, checked: boolean) => void; onDelete: (id: string) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<number | null>(null)
  useLayoutEffect(() => {
    const index = pendingFocus.current
    if (index === null) return
    pendingFocus.current = null
    root.current?.querySelectorAll('textarea')[index]?.focus()
  }, [block.items])
  return <div ref={root} className="notebook-checklist">
    <ul aria-label="Elementos del checklist">{(block.items.length ? block.items : [undefined]).map((item, index) => <li key={item?.id ?? 'empty'} data-item-id={item?.id} data-checked={item?.checked ?? false}>
      <input type="checkbox" aria-label={`Marcar elemento ${index + 1}`} checked={item?.checked ?? false} disabled={disabled}
        onChange={event => {
          if (item) onCheck(item.id, event.target.checked)
          else { pendingFocus.current = 0; onAdd(undefined, { text: '', checked: event.target.checked }) }
        }} />
      <div className="notebook-item-field">
        <ItemText text={item?.text ?? ''} index={index} disabled={disabled} onEdit={text => {
          if (item) onEdit(item.id, text)
          else { pendingFocus.current = 0; onAdd(undefined, { text, checked: false }) }
        }} />
        <div className="notebook-item-actions">
          <HelpTooltip text="Eliminar elemento"><Button className="notebook-item-control" aria-label={`Eliminar elemento ${index + 1}`} disabled={disabled || !item} onClick={() => {
            if (!item) return
            pendingFocus.current = Math.max(0, Math.min(index, block.items.length - 2))
            onDelete(item.id)
          }}><Minus aria-hidden="true" /></Button></HelpTooltip>
          <HelpTooltip text="Añadir elemento"><Button className="notebook-item-control" aria-label={item ? `Añadir elemento después de ${index + 1}` : 'Añadir elemento'} disabled={disabled} onClick={() => {
            pendingFocus.current = item ? index + 1 : 0
            onAdd(item?.id)
          }}><Plus aria-hidden="true" /></Button></HelpTooltip>
        </div>
      </div>
    </li>)}</ul>
  </div>
}
