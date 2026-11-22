import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import { QuickNote } from '../board/QuickNote'
import { findQuickNotePlacement } from '../board/findQuickNotePlacement'
import type { QuickNote as Note } from '@/domain/document/types'
import type { DocumentStore } from '../document/documentStore'
import styles from '../drawing/drawing.module.css'

export function PlanNotes({ notes, enabled, actions, save, store, generation, activate, selected, select }: {
  notes: Note[]; enabled: boolean; actions: Ref<{ add: () => void }>; save: (update: (notes: Note[]) => Note[]) => boolean
  store: DocumentStore; generation: number; selected: string | null; select: (id: string) => void; activate: () => void
}) {
  const surface = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState<string | null>(null)
  useImperativeHandle(actions, () => ({ add() {
    const node = surface.current
    if (!node) return
    const size = { width: Math.min(180, node.clientWidth), height: 64 }
    const { position } = findQuickNotePlacement({ x: 0, y: 0, width: node.clientWidth, height: node.clientHeight }, size,
      notes.map(n => ({ x: n.position.x - n.width / 2, y: n.position.y - n.height / 2, width: n.width, height: n.height })))
    const id = crypto.randomUUID()
    if (save(current => [...current, { id, position, title: '', text: '', scale: 1, ...size }])) { activate(); select(id); setFocus(id) }
  } }))
  const update = (id: string, patch: Partial<Note>) => save(current => current.map(note => note.id === id ? { ...note, ...patch } : note))
  return <div className={styles.notes} ref={surface}>{notes.map(note => <QuickNote key={note.id} note={note} enabled={enabled} selected={selected === note.id}
    surface={surface} focusBody={focus === note.id} onSelect={() => select(note.id)} onMove={position => update(note.id, { position })}
    onResize={size => update(note.id, size)} onEdit={patch => update(note.id, patch)} onDelete={() => save(current => current.filter(n => n.id !== note.id))}
    initialDraft={store.getQuickNoteDraft(note.id, generation)} onDraftChange={text => store.setQuickNoteDraft(note.id, text, generation)} />)}</div>
}

