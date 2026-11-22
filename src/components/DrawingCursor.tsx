import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import styles from './DrawingCursor.module.css'

export function DrawingCursor({ diameter, color, exclude, children }: {
  children?: ReactNode
  diameter: number
  color?: string
  exclude?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const cursor = ref.current, surface = cursor?.parentElement
    if (!cursor || !surface) return
    const hide = () => { cursor.hidden = true }
    const track = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || (exclude && event.target instanceof Element && event.target.closest(exclude))) {
        hide()
        return
      }
      const rect = surface.getBoundingClientRect()
      if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX >= rect.right ||
        event.clientY < rect.top || event.clientY >= rect.bottom) {
        hide()
        return
      }
      const pixel = surface.clientWidth / rect.width
      cursor.style.left = `${(event.clientX - rect.left) * pixel}px`
      cursor.style.top = `${(event.clientY - rect.top) * surface.clientHeight / rect.height}px`
      cursor.style.setProperty('--cursor-pixel', `${pixel}px`)
      cursor.hidden = false
    }
    surface.addEventListener('pointerenter', track)
    surface.addEventListener('pointermove', track, true)
    surface.addEventListener('pointerdown', track, true)
    surface.addEventListener('pointerleave', hide)
    surface.addEventListener('pointercancel', hide)
    window.addEventListener('blur', hide)
    return () => {
      surface.removeEventListener('pointerenter', track)
      surface.removeEventListener('pointermove', track, true)
      surface.removeEventListener('pointerdown', track, true)
      surface.removeEventListener('pointerleave', hide)
      surface.removeEventListener('pointercancel', hide)
      window.removeEventListener('blur', hide)
    }
  }, [exclude])
  return <span ref={ref} className={styles.base} data-slot="drawing-cursor" hidden aria-hidden="true"
    style={{ width: diameter, height: diameter, backgroundColor: color ?? 'transparent', boxShadow: children ? 'none' : undefined }}>{children}</span>
}
