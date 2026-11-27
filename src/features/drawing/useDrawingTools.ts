import { useState } from 'react'
import type { DrawingTool, DrawingSettings, Panel } from './DrawingToolbar'

export function useDrawingTools() {
  const [panels, setPanels] = useState<Panel[]>([])
  const [panelWidth, setPanelWidth] = useState(65)
  const [selected, select] = useState<string | null>(null)
  const [settings, setSettings] = useState<DrawingSettings>({ circle: false, polyline: false })
  function setOption(tool: keyof DrawingSettings, enabled: boolean) {
    setSettings(previous => previous[tool] === enabled ? previous : { ...previous, [tool]: enabled })
  }
  function activate(current: string, next: DrawingTool) {
    if (current === next && (next === 'circle' || next === 'polyline')) {
      setSettings(previous => ({ ...previous, [next]: !previous[next] }))
    }
  }
  function toggle(panel: Panel) {
    setPanels(previous => previous.includes(panel) ? previous.filter(p => p !== panel) : [...previous, panel])
  }
  return { panels, toggle, panelWidth, setPanelWidth, selected, select, settings, activate, setOption }
}

