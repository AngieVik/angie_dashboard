import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent, PointerEvent, RefObject } from 'react'
import type { ReportMapArea as Area } from './reportMapFraming'
import styles from './ReportMapArea.module.css'

type Action = 'move' | 'nw' | 'ne' | 'sw' | 'se'
const corners = { nw: 'superior izquierda', ne: 'superior derecha', sw: 'inferior izquierda', se: 'inferior derecha' } as const

function adjust(area: Area, action: Action, dx: number, dy: number, minimum: { x: number; y: number }): Area {
  if (action === 'move') return { ...area, x: Math.max(0, Math.min(1 - area.width, area.x + dx)), y: Math.max(0, Math.min(1 - area.height, area.y + dy)) }
  let left = area.x, top = area.y, right = area.x + area.width, bottom = area.y + area.height
  if (action.includes('w')) left = Math.max(0, Math.min(right - minimum.x, left + dx))
  if (action.includes('e')) right = Math.min(1, Math.max(left + minimum.x, right + dx))
  if (action.includes('n')) top = Math.max(0, Math.min(bottom - minimum.y, top + dy))
  if (action.includes('s')) bottom = Math.min(1, Math.max(top + minimum.y, bottom + dy))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function ReportMapArea({ area, disabled, busyRef, onChange }: { area: Area; disabled: boolean; busyRef: RefObject<boolean>; onChange: (area: Area) => void }) {
  const root = useRef<HTMLDivElement>(null), update = useRef(onChange)
  const gesture = useRef<{ id: number; node: HTMLButtonElement; action: Action; area: Area; x: number; y: number; rect: DOMRect; minimum: { x: number; y: number } } | null>(null)
  useLayoutEffect(() => { update.current = onChange }, [onChange])
  const cancel = useCallback(() => {
    const current = gesture.current
    gesture.current = null; busyRef.current = false
    if (!current) return
    update.current(current.area)
    if (current.node.hasPointerCapture(current.id)) current.node.releasePointerCapture(current.id)
  }, [busyRef])
  useEffect(() => {
    function interrupt(event: globalThis.PointerEvent) { if (gesture.current && event.pointerId !== gesture.current.id) cancel() }
    function escape(event: globalThis.KeyboardEvent) { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel() } }
    document.addEventListener('pointerdown', interrupt, true)
    document.addEventListener('keydown', escape, true)
    window.addEventListener('blur', cancel)
    return () => {
      document.removeEventListener('pointerdown', interrupt, true); document.removeEventListener('keydown', escape, true); window.removeEventListener('blur', cancel)
      const current = gesture.current
      gesture.current = null; busyRef.current = false
      if (current?.node.hasPointerCapture(current.id)) current.node.releasePointerCapture(current.id)
    }
  }, [busyRef, cancel])
  useEffect(() => { if (disabled) cancel() }, [disabled, cancel])
  function start(event: PointerEvent<HTMLButtonElement>, action: Action) {
    const parent = root.current?.parentElement, rect = parent?.getBoundingClientRect()
    if (disabled || !event.isPrimary || event.button !== 0 || !parent || !rect?.width || !rect.height) return
    event.preventDefault(); event.stopPropagation()
    gesture.current = { id: event.pointerId, node: event.currentTarget, action, area, x: event.clientX, y: event.clientY, rect,
      minimum: { x: 1 / Math.max(1, parent.clientWidth), y: 1 / Math.max(1, parent.clientHeight) } }
    busyRef.current = true
    event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    event.preventDefault(); event.stopPropagation()
    if (disabled) { cancel(); return }
    onChange(adjust(current.area, current.action, (event.clientX - current.x) / current.rect.width, (event.clientY - current.y) / current.rect.height, current.minimum))
  }
  function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    event.preventDefault(); event.stopPropagation()
    gesture.current = null; busyRef.current = false
    if (current.node.hasPointerCapture(current.id)) current.node.releasePointerCapture(current.id)
  }
  function key(event: KeyboardEvent<HTMLButtonElement>, action: Action) {
    const parent = root.current?.parentElement
    if (disabled || !parent || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault(); event.stopPropagation()
    const step = event.shiftKey ? 10 : 1, minimum = { x: 1 / Math.max(1, parent.clientWidth), y: 1 / Math.max(1, parent.clientHeight) }
    onChange(adjust(area, action, event.key === 'ArrowLeft' ? -step * minimum.x : event.key === 'ArrowRight' ? step * minimum.x : 0,
      event.key === 'ArrowUp' ? -step * minimum.y : event.key === 'ArrowDown' ? step * minimum.y : 0, minimum))
  }
  const handlers = { onPointerMove: move, onPointerUp: finish, onPointerCancel: cancel, onLostPointerCapture: cancel }
  return <div ref={root} className={`reports-map-area ${styles.base}`} role="group" aria-label="Área seleccionada del informe"
    style={{ left: area.x * 100 + '%', top: area.y * 100 + '%', width: area.width * 100 + '%', height: area.height * 100 + '%' }}>
    <button type="button" className="reports-map-area-move" disabled={disabled} aria-label="Mover área del informe" onPointerDown={event => start(event, 'move')} onKeyDown={event => key(event, 'move')} {...handlers} />
    {(Object.entries(corners) as [Exclude<Action, 'move'>, string][]).map(([action, label]) => <button type="button" key={action} className="reports-map-area-corner" data-corner={action}
      disabled={disabled} aria-label={'Redimensionar área: esquina ' + label} onPointerDown={event => start(event, action)} onKeyDown={event => key(event, action)} {...handlers} />)}
  </div>
}
