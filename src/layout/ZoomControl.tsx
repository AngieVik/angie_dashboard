import { useState } from 'react'

export function ZoomControl({ scale, onChange, label, disabled = false }: {
  scale: number; onChange: (scale: number) => void; label: string; disabled?: boolean
}) {
  const percent = Math.round(scale * 100)
  const [draft, setDraft] = useState<string | null>(null)
  function commit() {
    if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) {
      onChange(Math.min(400, Math.max(25, Number(draft))) / 100)
    }
    setDraft(null)
  }
  return <label className="zoom-control technical-data">
    <input type="number" inputMode="decimal" aria-label={label} title={label} min={25} max={400} step={1}
      disabled={disabled} value={draft ?? percent} onChange={event => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); commit() }
        if (event.key === 'Escape') { event.preventDefault(); setDraft(null) }
      }} /><span aria-hidden="true">%</span>
  </label>
}
