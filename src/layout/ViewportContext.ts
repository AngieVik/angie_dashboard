import { createContext, useContext } from 'react'
import type { RefObject } from 'react'
import type { Position } from '../domain/document/types'

export interface ModuleNavigation {
  element: HTMLElement
  scale: number
  zoom: (scale: number, point: Position) => void
}

export const ViewportContext = createContext<{ blocked: boolean; blockedRef: RefObject<boolean>; moduleNavigationRef?: RefObject<ModuleNavigation | null> }>({ blocked: false, blockedRef: { current: false } })
export function useViewportInteraction() { return useContext(ViewportContext) }
