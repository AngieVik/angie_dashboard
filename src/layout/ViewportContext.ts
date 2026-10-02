import { createContext, useContext } from 'react'
import type { RefObject } from 'react'
import type { Position } from '../domain/document/types'

export interface BoardNavigation {
  element: HTMLElement
  gesture: (points: [Position, Position] | null) => void
}

export const ViewportContext = createContext<{ blocked: boolean; blockedRef: RefObject<boolean>; boardNavigationRef?: RefObject<BoardNavigation | null> }>({ blocked: false, blockedRef: { current: false } })
export function useViewportInteraction() { return useContext(ViewportContext) }
