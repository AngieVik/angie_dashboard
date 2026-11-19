import { useEffect, useRef, useState } from 'react'
import { useViewportInteraction } from './ViewportContext'
import { HandleBottomRight } from './HandleBottomRight'
import { keyboardResizeDelta, RESIZE_INSTRUCTIONS, resizeAnnouncement } from './keyboardResize'
import type { Size } from './layoutTypes'
import styles from './windowResize.module.css'

export function WindowResize({ label }: { label: string }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [announcement, setAnnouncement] = useState('')
  const gesture = useRef<{ id: number; node: HTMLElement; x: number; y: number; width: number; height: number; scale: number; originalWidth: string; originalHeight: string; originalLeft: string; originalTop: string; originalTransform: string } | null>(null)
  function cancel() {
    const current = gesture.current
    if (current) {
      Object.assign(current.node.style, { width: current.originalWidth, height: current.originalHeight, left: current.originalLeft, top: current.originalTop, transform: current.originalTransform })
      gesture.current = null
    }
  }
  useEffect(() => { if (blocked) cancel() }, [blocked])
  function anchor(node: HTMLElement) {
    // A centered modal keeps its top-left corner for both pointer and keyboard resizing.
    if (getComputedStyle(node).position === 'fixed') {
      const rect = node.getBoundingClientRect()
      Object.assign(node.style, { left: `${rect.left}px`, top: `${rect.top}px`, transform: 'none' })
    }
  }
  function resize(node: HTMLElement, size: Size) {
    // CSS min/max dimensions remain authoritative for either input method.
    node.style.width = `${Math.max(1, size.width)}px`
    node.style.height = `${Math.max(1, size.height)}px`
  }
  return <><button type="button" data-slot="window-resize" className={styles.base} aria-label={label} disabled={blocked}
    aria-description={RESIZE_INSTRUCTIONS} title={RESIZE_INSTRUCTIONS}
    onKeyDown={event => {
      const delta = keyboardResizeDelta(event), node = event.currentTarget.parentElement
      if (!delta || !node || blockedRef.current || gesture.current) return
      event.preventDefault(); event.stopPropagation()
      const size = { width: node.offsetWidth + delta.width, height: node.offsetHeight + delta.height }
      anchor(node); resize(node, size)
      setAnnouncement(resizeAnnouncement({ width: node.offsetWidth, height: node.offsetHeight }))
    }}
    onPointerDown={event => {
      const node = event.currentTarget.parentElement
      if (!node || event.button !== 0 || blockedRef.current) return
      event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId)
      gesture.current = { id: event.pointerId, node, x: event.clientX, y: event.clientY, width: node.offsetWidth, height: node.offsetHeight,
        scale: node.getBoundingClientRect().width / node.offsetWidth || 1, originalWidth: node.style.width, originalHeight: node.style.height,
        originalLeft: node.style.left, originalTop: node.style.top, originalTransform: node.style.transform }
      anchor(node)
    }} onPointerMove={event => {
      const current = gesture.current
      if (!current || event.pointerId !== current.id) return
      if (blockedRef.current) { cancel(); return }
      event.preventDefault(); event.stopPropagation()
      resize(current.node, { width: current.width + (event.clientX - current.x) / current.scale, height: current.height + (event.clientY - current.y) / current.scale })
    }} onPointerUp={event => { if (gesture.current?.id === event.pointerId) { if (blockedRef.current) cancel(); else gesture.current = null } }}
    onPointerCancel={cancel} onLostPointerCapture={cancel}><HandleBottomRight aria-hidden="true" /></button>
    <span className="visually-hidden" role="status">{announcement}</span></>
}
