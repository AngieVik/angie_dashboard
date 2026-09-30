import { createContext, useContext } from 'react'
import type { RefObject } from 'react'

export const ViewportContext = createContext<{ blocked: boolean; blockedRef: RefObject<boolean> }>({ blocked: false, blockedRef: { current: false } })
export function useViewportInteraction() { return useContext(ViewportContext) }
