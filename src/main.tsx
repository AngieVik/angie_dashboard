import './styles/layers.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { GlobalErrorBoundary } from './app/recovery/GlobalErrorBoundary'
import { TimerRuntime } from './features/clock/TimerRuntime'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/global.css'
import './styles/integrations/leaflet.css'
import './styles/integrations/react-grid-layout.css'
import './styles/utilities.css'
import './styles/print.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TimerRuntime />
    <GlobalErrorBoundary><App /></GlobalErrorBoundary>
  </StrictMode>,
)
