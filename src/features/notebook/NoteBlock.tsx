import type { NotebookBlock } from '../../domain/document/types'

export function NoteBlock({ block, disabled, onEdit }: {
  block: Extract<NotebookBlock, { type: 'note' }>; disabled: boolean; onEdit: (text: string) => void
}) {
  return <textarea className="notebook-note" aria-label="Texto de nota" rows={4} value={block.text}
    disabled={disabled} onChange={event => onEdit(event.target.value)} />
}
