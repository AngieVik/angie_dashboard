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
      <HelpTooltip text="Añadir elemento"><Button className="notebook-item-control" aria-label={`Añadir elemento después de ${index + 1}`} disabled={disabled} onClick={() => { pendingFocus.current = index + 1; onAdd(item.id) }}><Plus aria-hidden="true" /></Button></HelpTooltip>
      <HelpTooltip text="Eliminar elemento"><Button className="notebook-item-control" aria-label={`Eliminar elemento ${index + 1}`} disabled={disabled} onClick={() => { pendingFocus.current = Math.min(index, block.items.length - 2); onDelete(item.id) }}><Minus aria-hidden="true" /></Button></HelpTooltip>
    </li>)}</ul>
    {block.items.length === 0 && <HelpTooltip text="Añadir elemento"><Button className="notebook-item-control" ref={addControl} aria-label="Añadir elemento" disabled={disabled} onClick={() => { pendingFocus.current = 0; onAdd() }}><Plus aria-hidden="true" /></Button></HelpTooltip>}
  </div>
}
