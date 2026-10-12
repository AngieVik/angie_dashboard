import { createContext, useContext } from 'react'
import type { RefObject } from 'react'
import type { Size } from './layoutTypes'
export const ModuleZoomContext = createContext<{ scale: number; navigationKey?: string; fitContentRef?: RefObject<(() => Size) | null> }>({ scale: 1 })
export function useModuleZoom() { return useContext(ModuleZoomContext) }
