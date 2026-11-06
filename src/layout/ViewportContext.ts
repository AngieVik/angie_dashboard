import { createContext, useContext } from 'react'
import type { RefObject } from 'react'
import type { Position } from '../domain/document/types'

export type ModuleGesture = (scale: number, translation: Position) => void

export interface ModuleNavigation {
  element: HTMLElement
  scale: number
  zoom: (scale: number, point: Position) => void
  beginGesture?: () => ModuleGesture | null
}

export const ViewportContext = createContext<{ blocked: boolean; blockedRef: RefObject<boolean>; moduleNavigationsRef?: RefObject<Map<HTMLElement, ModuleNavigation>> }>({ blocked: false, blockedRef: { current: false } })
export function useViewportInteraction() { return useContext(ViewportContext) }
