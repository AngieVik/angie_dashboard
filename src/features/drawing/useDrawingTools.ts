import { useCallback, useState } from 'react'
import type { Panel } from './DrawingToolbar'

export function useDrawingTools() {
  const [panels, setPanels] = useState<Panel[]>([])
  const [panelWidth, setPanelWidth] = useState(65)
  // Several figures and strokes can be selected; `selected` is the only one when there is just one.
  const [selection, setSelection] = useState<string[]>([])
  const [fixed, setFixed] = useState(false)
  const select = useCallback((id: string | null) => setSelection(id ? [id] : []), [])
  const selectMany = useCallback((ids: string[]) => setSelection([...new Set(ids)]), [])
  function show(panel: Panel) { setPanels(previous => previous.includes(panel) ? previous : [...previous, panel]) }
  function toggle(panel: Panel) {
    setPanels(previous => previous.includes(panel) ? previous.filter(p => p !== panel) : [...previous, panel])
  }
  const selected = selection.length === 1 ? selection[0]! : null
  return { panels, show, toggle, panelWidth, setPanelWidth, selected, select, selection, selectMany, fixed, setFixed }
}
