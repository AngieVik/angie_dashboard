import { createContext } from 'react'

export type ContentSizeRequest = 'minimum' | { timerHeightDelta: number } | { agendaDelta: { width: number; height: number } }
export const ModuleSizeContext = createContext<(request: ContentSizeRequest) => void>(() => {})
