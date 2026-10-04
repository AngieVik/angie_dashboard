import { useEffect, useRef } from 'react'
import { useViewportInteraction } from './ViewportContext'

export function WindowResize({ label }: { label: string }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const gesture = useRef<{ id: number; node: HTMLElement; x: number; y: number; width: number; height: number; scale: number; originalWidth: string; originalHeight: string; originalLeft: string; originalTop: string; originalTransform: string } | null>(null)
  function cancel() {
    const current = gesture.current
    if (current) {
      Object.assign(current.node.style, { width: current.originalWidth, height: current.originalHeight, left: current.originalLeft, top: current.originalTop, transform: current.originalTransform })
      gesture.current = null
    }
  }
  useEffect(() => { if (blocked) cancel() }, [blocked])
  return <button type="button" className="window-resize" aria-label={label} title={label} disabled={blocked}
    onPointerDown={event => {
      const node = event.currentTarget.parentElement
      if (!node || event.button !== 0 || blockedRef.current) return
      event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId)
      gesture.current = { id: event.pointerId, node, x: event.clientX, y: event.clientY, width: node.offsetWidth, height: node.offsetHeight,
        scale: node.getBoundingClientRect().width / node.offsetWidth || 1, originalWidth: node.style.width, originalHeight: node.style.height,
        originalLeft: node.style.left, originalTop: node.style.top, originalTransform: node.style.transform }
      // A centered modal must keep its top-left corner while its handle moves.
      if (getComputedStyle(node).position === 'fixed') {
        const rect = node.getBoundingClientRect()
        Object.assign(node.style, { left: `${rect.left}px`, top: `${rect.top}px`, transform: 'none' })
      }
    }} onPointerMove={event => {
      const current = gesture.current
      if (!current || event.pointerId !== current.id) return
      if (blockedRef.current) { cancel(); return }
      event.preventDefault(); event.stopPropagation()
      current.node.style.width = `${Math.max(1, current.width + (event.clientX - current.x) / current.scale)}px`
      current.node.style.height = `${Math.max(1, current.height + (event.clientY - current.y) / current.scale)}px`
    }} onPointerUp={event => { if (gesture.current?.id === event.pointerId) { if (blockedRef.current) cancel(); else gesture.current = null } }}
    onPointerCancel={cancel} onLostPointerCapture={cancel} />
}
