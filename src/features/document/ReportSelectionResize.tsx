import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent, RefObject } from 'react'
import { useViewportInteraction } from '@/layout/ViewportContext'
import styles from '@/components/ui/resizable/resizable.module.css'

const MIN_WIDTH = 25
const MAX_WIDTH = 75
const clamp = (value: number) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value))

export function ReportSelectionResize({ value, onChange, container, controls, disabled, className = '' }: {
  value: number; onChange: (value: number) => void; container: RefObject<HTMLDivElement | null>; controls: string; disabled: boolean; className?: string
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  const gesture = useRef<{ id: number; node: HTMLButtonElement; x: number; width: number; value: number } | null>(null)
  const cancel = useCallback(() => {
    const current = gesture.current
    gesture.current = null
    if (!current) return
    onChange(current.value)
    if (current.node.hasPointerCapture(current.id)) current.node.releasePointerCapture(current.id)
  }, [onChange])
  useEffect(() => { if (disabled || blocked) cancel() }, [disabled, blocked, cancel])
  useEffect(() => {
    function interrupt(event: globalThis.PointerEvent) {
      if (gesture.current && gesture.current.id !== event.pointerId) cancel()
    }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || !gesture.current) return
      event.preventDefault(); event.stopPropagation(); cancel()
    }
    window.addEventListener('pointerdown', interrupt, true)
    window.addEventListener('keydown', escape, true)
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('pointerdown', interrupt, true)
      window.removeEventListener('keydown', escape, true)
      window.removeEventListener('blur', cancel)
      const current = gesture.current
      gesture.current = null
      if (current?.node.hasPointerCapture(current.id)) current.node.releasePointerCapture(current.id)
    }
  }, [cancel])
  function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    event.preventDefault(); event.stopPropagation()
    if (disabled || blockedRef.current) { cancel(); return }
    gesture.current = null
    if (current.node.hasPointerCapture(current.id)) current.node.releasePointerCapture(current.id)
  }
  return <button type="button" role="separator" aria-orientation="vertical" aria-label="Cambiar ancho del contenido del informe"
    aria-controls={controls} aria-valuemin={MIN_WIDTH} aria-valuemax={MAX_WIDTH} aria-valuenow={Math.round(value)}
    aria-valuetext={`${Math.round(value)} %`} disabled={disabled || blocked} aria-disabled={disabled || blocked}
    className={`${styles.handle} ${className}`} onPointerDown={event => {
      const rect = container.current?.getBoundingClientRect()
      if (disabled || blockedRef.current || !event.isPrimary || event.button !== 0 || !rect?.width) return
      event.preventDefault(); event.stopPropagation()
      gesture.current = { id: event.pointerId, node: event.currentTarget, x: event.clientX, width: rect.width, value }
      event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId)
    }} onPointerMove={event => {
      const current = gesture.current
      if (!current || current.id !== event.pointerId) return
      event.preventDefault(); event.stopPropagation()
      if (disabled || blockedRef.current) { cancel(); return }
      // Both the pointer delta and the container rect include the desktop's scale.
      onChange(clamp(current.value + (event.clientX - current.x) / current.width * 100))
    }} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}
    onClick={event => { event.preventDefault(); event.stopPropagation() }} onKeyDown={event => {
      if (disabled || blockedRef.current || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault(); event.stopPropagation()
      const step = event.shiftKey ? 10 : 2
      onChange(event.key === 'Home' ? MIN_WIDTH : event.key === 'End' ? MAX_WIDTH : clamp(value + (event.key === 'ArrowLeft' ? -step : step)))
    }} />
}
