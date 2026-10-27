import { useId, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Size, ViewportState } from './layoutTypes'
import { useViewportGestures } from './useViewportGestures'
import { ViewportContext } from './ViewportContext'
import styles from './mobileViewport.module.css'

export function MobileViewport({ children, state, size, bounds = size, headerHeight = 0, onChange }: {
  children: ReactNode; state: ViewportState; size: Size; bounds?: Size; headerHeight?: number; onChange: (state: ViewportState) => void
}) {
  const element = useRef<HTMLDivElement>(null)
  const vertical = useRef<HTMLDivElement>(null), horizontal = useRef<HTMLDivElement>(null)
  const workspaceId = useId()
  const { blocked, blockedRef, moduleNavigationRef, handlers } = useViewportGestures(state, size, bounds, onChange, element, headerHeight)
  const maximumX = Math.max(0, bounds.width * state.scale - size.width)
  const maximumY = Math.max(0, bounds.height * state.scale - size.height)
  useLayoutEffect(() => {
    const x = horizontal.current, y = vertical.current
    if (x) x.scrollLeft = maximumX ? -state.offsetX / maximumX * (x.scrollWidth - x.clientWidth) : 0
    if (y) y.scrollTop = maximumY ? -state.offsetY / maximumY * (y.scrollHeight - y.clientHeight) : 0
  }, [state.offsetX, state.offsetY, state.scale, maximumX, maximumY, size.width, size.height, blocked])
  return (
    <div ref={element} data-slot="mobile-viewport" className={styles.base} data-testid="mobile-viewport" data-gesturing={blocked}
      data-scale={state.scale} data-offset-x={state.offsetX} data-offset-y={state.offsetY} {...handlers}>
      <ViewportContext.Provider value={{ blocked, blockedRef, moduleNavigationRef }}>
        <div id={workspaceId} className={`${styles.workspace} logical-workspace`} style={{ width: bounds.width, height: bounds.height, transform: `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})` }}>
          {children}
        </div>
      </ViewportContext.Provider>
      {maximumY > 0 && <div ref={vertical} className={`${styles.scrollbar} ${styles.vertical} viewport-scrollbar`} style={{ bottom: maximumX > 0 ? 12 : 0 }}
        role="scrollbar" aria-label="Desplazamiento vertical del dashboard" aria-controls={workspaceId} aria-orientation="vertical"
        aria-valuemin={0} aria-valuemax={maximumY} aria-valuenow={Math.max(0, -state.offsetY)} tabIndex={0}
        onClick={event => event.stopPropagation()} onScroll={event => {
          const node = event.currentTarget, range = node.scrollHeight - node.clientHeight
          if (blockedRef.current || range <= 0) return
          const offsetY = -node.scrollTop / range * maximumY
          if (Math.abs(offsetY - state.offsetY) > .5) onChange({ ...state, offsetY })
        }}><div style={{ width: 1, height: bounds.height * state.scale }} /></div>}
      {maximumX > 0 && <div ref={horizontal} className={`${styles.scrollbar} ${styles.horizontal} viewport-scrollbar`} style={{ right: maximumY > 0 ? 12 : 0 }}
        role="scrollbar" aria-label="Desplazamiento horizontal del dashboard" aria-controls={workspaceId} aria-orientation="horizontal"
        aria-valuemin={0} aria-valuemax={maximumX} aria-valuenow={Math.max(0, -state.offsetX)} tabIndex={0}
        onClick={event => event.stopPropagation()} onScroll={event => {
          const node = event.currentTarget, range = node.scrollWidth - node.clientWidth
          if (blockedRef.current || range <= 0) return
          const offsetX = -node.scrollLeft / range * maximumX
          if (Math.abs(offsetX - state.offsetX) > .5) onChange({ ...state, offsetX })
        }}><div style={{ width: bounds.width * state.scale, height: 1 }} /></div>}
    </div>
  )
}
