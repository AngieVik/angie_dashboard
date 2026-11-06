import { Checkbox } from '@/components/ui/checkbox'
import { useState } from 'react'
import type { NotebookBlock } from '../../domain/document/types'
import { Textarea } from '@/components/ui/textarea'
import { useAutoGrowingTextarea } from './useAutoGrowingTextarea'
import styles from './ChecklistBlock.module.css'

function ItemText({ text, index, checked, disabled, onEdit }: { text: string; index: number; checked: boolean; disabled: boolean; onEdit: (text: string) => boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? text
  const ref = useAutoGrowingTextarea(value)
  return <Textarea ref={ref} className={`${styles.field} ${checked ? styles.checked : ''}`.trim()} aria-label={`Texto del elemento ${index + 1}`} rows={1} value={value} disabled={disabled}
    onChange={event => {
      const value = event.target.value
      setDraft(onEdit(value) ? null : value)
    }} />
}

export function ChecklistBlock({ block, selectedItemId, disabled, onAdd, onEdit, onCheck }: {
  block: Extract<NotebookBlock, { type: 'checklist' }>; selectedItemId?: string; disabled: boolean
  onAdd: (initial: { text: string; checked: boolean }) => boolean; onEdit: (id: string, text: string) => boolean
  onCheck: (id: string, checked: boolean) => void
}) {
  return <div className={`${styles.base} notebook-checklist`}>
    <ul aria-label="Elementos del checklist">{(block.items.length ? block.items : [undefined]).map((item, index) => <li key={item?.id ?? 'empty'} data-item-id={item?.id} data-checked={item?.checked ?? false} data-selected={Boolean(item && item.id === selectedItemId)}>
      <Checkbox aria-label={`Marcar elemento ${index + 1}`} checked={item?.checked ?? false} disabled={disabled}
        onCheckedChange={nextChecked => {
          if (item) onCheck(item.id, nextChecked)
          else onAdd({ text: '', checked: nextChecked })
        }} />
      <ItemText text={item?.text ?? ''} index={index} checked={item?.checked ?? false} disabled={disabled} onEdit={text => {
        return item ? onEdit(item.id, text) : onAdd({ text, checked: false })
      }} />
    </li>)}</ul>
  </div>
}
