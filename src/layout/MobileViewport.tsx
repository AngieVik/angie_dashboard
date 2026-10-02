import { useRef } from 'react'
import type { ReactNode } from 'react'
import type { Size, ViewportState } from './layoutTypes'
import { useViewportGestures } from './useViewportGestures'
import { ViewportContext } from './ViewportContext'

export function MobileViewport({ children, state, size, bounds = size, onChange }: {
  children: ReactNode; state: ViewportState; size: Size; bounds?: Size; onChange: (state: ViewportState) => void
}) {
  const element = useRef<HTMLDivElement>(null)
  const { blocked, blockedRef, boardNavigationRef, handlers } = useViewportGestures(state, size, bounds, onChange, element)
  return (
    <div ref={element} className="mobile-viewport" data-testid="mobile-viewport" data-gesturing={blocked}
      data-scale={state.scale} data-offset-x={state.offsetX} data-offset-y={state.offsetY} {...handlers}>
      <ViewportContext.Provider value={{ blocked, blockedRef, boardNavigationRef }}>
        <div className="logical-workspace" style={{ width: bounds.width, height: bounds.height, transform: `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})` }}>
          {children}
        </div>
      </ViewportContext.Provider>
    </div>
  )
}
