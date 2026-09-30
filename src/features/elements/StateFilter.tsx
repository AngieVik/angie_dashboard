import { useRef, useState, useEffect } from 'react'
import { DOCUMENT_STATUSES } from '../../domain/document/types'
import type { OperationalStatus } from '../../domain/document/types'
import { Button } from '../../components/ui/button'
import { useViewportInteraction } from '../../layout/ViewportContext'

const icons = ['🟢', '🟡', '🔵', '🔴', '💠', '🟠', '🟢', '⚫']
export function StateFilter({ visible, onChange }: { visible: OperationalStatus[]; onChange: (statuses: OperationalStatus[]) => void }) {
  const { blocked, blockedRef } = useViewportInteraction()
  const [help, setHelp] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return <div className="element-state-filter" role="group" aria-label="Filtrar dotaciones por estado">
    {DOCUMENT_STATUSES.map((status, index) => <Button key={status} aria-label={status} title={status} aria-pressed={visible.includes(status)} disabled={blocked}
      onPointerDown={event => {
        clearTimeout(timer.current)
        if (event.pointerType === 'touch') timer.current = setTimeout(() => { if (!blockedRef.current) setHelp(status) }, 500)
      }} onPointerUp={() => { clearTimeout(timer.current); setHelp(null) }} onPointerCancel={() => { clearTimeout(timer.current); setHelp(null) }}
      onBlur={() => setHelp(null)} onClick={() => {
        if (blockedRef.current) return
        onChange(DOCUMENT_STATUSES.filter(value => value === status ? !visible.includes(value) : visible.includes(value)))
      }}>{icons[index]}</Button>)}
    {help && !blocked && <span role="tooltip" className="element-filter-help">{help}</span>}
  </div>
}
