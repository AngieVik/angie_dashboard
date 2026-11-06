import { createContext } from 'react'

export const ModuleSizeContext = createContext<(mode?: 'minimum') => void>(() => {})
