import { createContext, useContext } from 'react'
import type { RefObject } from 'react'
import type { Size } from './layoutTypes'
import type { ModuleGesture } from './ViewportContext'
export const ModuleZoomContext = createContext<{ scale: number; navigationKey?: string; fitContentRef?: RefObject<(() => Size) | null>; beginGestureRef?: RefObject<(() => ModuleGesture | null) | null> }>({ scale: 1 })
export function useModuleZoom() { return useContext(ModuleZoomContext) }
