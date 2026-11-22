import { useState } from 'react'
import type { DrawingTool, DrawingSettings, Panel } from './DrawingToolbar'

export function useDrawingTools() {
  const [panels, setPanels] = useState<Panel[]>([])
  const [panelWidth, setPanelWidth] = useState(65)
  const [selected, select] = useState<string | null>(null)
  const [settings, setSettings] = useState<DrawingSettings>({ circle: false, polyline: false, eraser: false })
  function activate(current: string, next: DrawingTool) {
    if (next === 'circle' || next === 'polyline' || next === 'eraser') {
      setSettings(previous => ({ ...previous, [next]: current === next ? !previous[next] : false }))
    }
  }
  function toggle(panel: Panel) {
    setPanels(previous => previous.includes(panel) ? previous.filter(p => p !== panel) : [...previous, panel])
  }
  return { panels, toggle, panelWidth, setPanelWidth, selected, select, settings, activate }
}

