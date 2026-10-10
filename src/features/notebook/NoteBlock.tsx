import { Textarea } from '../../components/ui/textarea'
import type { NotebookBlock } from '../../domain/document/types'
import { useAutoGrowingTextarea } from './useAutoGrowingTextarea'

export function NoteBlock({ block, disabled, onEdit }: {
  block: Extract<NotebookBlock, { type: 'note' }>; disabled: boolean; onEdit: (text: string) => void
}) {
  const ref = useAutoGrowingTextarea(block.text)
  return <Textarea ref={ref} className="notebook-note" aria-label="Texto de nota" rows={1} value={block.text}
    disabled={disabled} onChange={event => onEdit(event.target.value)} />
}
