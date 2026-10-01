import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, RefObject } from 'react'
import type { NotebookBlock } from '../../domain/document/types'
import { useViewportInteraction } from '../../layout/ViewportContext'

export function useNotebookReorder(blocks: NotebookBlock[], list: RefObject<HTMLOListElement | null>, onReorder: (id: string, targetId: string) => void) {
  const { blocked, blockedRef } = useViewportInteraction()
  const drag = useRef<{ id: string; pointerId: number; targetId: string } | null>(null)
  const [preview, setPreview] = useState<{ id: string; targetId: string } | null>(null)
  const cancel = useCallback(() => { drag.current = null; setPreview(null) }, [])
  useEffect(() => {
    // The viewport owns two-finger gestures; discard the uncommitted reorder.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (blocked) cancel()
  }, [blocked, cancel])
  function start(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (blockedRef.current || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = { id, pointerId: event.pointerId, targetId: id }
    setPreview({ id, targetId: id })
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current, node = list.current
    if (!current || current.pointerId !== event.pointerId || blockedRef.current || !node) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = node.getBoundingClientRect()
    if (event.clientY < bounds.top + 24) node.scrollBy?.(0, -12)
    else if (event.clientY > bounds.bottom - 24) node.scrollBy?.(0, 12)
    // Screen-space midpoints include the dashboard zoom and internal scrolling.
    const others = Array.from(node.children).filter(child => (child as HTMLElement).dataset.blockId !== current.id)
    const index = others.filter(child => { const rect = child.getBoundingClientRect(); return event.clientY > rect.top + rect.height / 2 }).length
    const target = blocks[index]
    if (!target) return
    current.targetId = target.id
    setPreview({ id: current.id, targetId: target.id })
  }
  function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    event.stopPropagation()
    if (!blockedRef.current && current.id !== current.targetId) onReorder(current.id, current.targetId)
    cancel()
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (blockedRef.current || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const index = blocks.findIndex(block => block.id === id)
    const target = blocks[index + (event.key === 'ArrowUp' ? -1 : 1)]
    if (target) onReorder(id, target.id)
  }
  return { preview: blocked ? null : preview, handleProps: (id: string) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => start(event, id),
    onPointerMove: move, onPointerUp: finish, onPointerCancel: cancel, onLostPointerCapture: cancel,
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => keyDown(event, id),
  }) }
}
