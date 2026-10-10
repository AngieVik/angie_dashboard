import { createContext } from 'react'
import type { Size } from './layoutTypes'

export const ModuleSizeContext = createContext<(minimum: Size, options?: { fitHeight?: boolean }) => void>(() => {})
