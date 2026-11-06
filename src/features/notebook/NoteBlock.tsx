import { Textarea } from '@/components/ui/textarea'
import { useState } from 'react'
import type { NotebookBlock } from '../../domain/document/types'
import { useAutoGrowingTextarea } from './useAutoGrowingTextarea'
import styles from './NoteBlock.module.css'

export function NoteBlock({ block, disabled, onEdit }: {
  block: Extract<NotebookBlock, { type: 'note' }>; disabled: boolean; onEdit: (text: string) => boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? block.text
  const ref = useAutoGrowingTextarea(text)
  return <Textarea ref={ref} className={styles.note} aria-label="Texto de nota" rows={1} value={text}
    disabled={disabled} onChange={event => {
      const value = event.target.value
      setDraft(onEdit(value) ? null : value)
    }} />
}
