import { useEffect, useRef, useState } from 'react'
import { GitCommitHorizontal, GitCommitVertical } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Slider } from '../components/ui/slider'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { HelpTooltip } from '../components/ui/tooltip'

export function ZoomControl({ scale, onChange, label, disabled = false, side = 'bottom' }: {
  scale: number; onChange: (scale: number) => void; label: string; disabled?: boolean; side?: 'bottom' | 'right'
}) {
  const percent = Math.round(scale * 100)
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const Icon = side === 'right' ? GitCommitHorizontal : GitCommitVertical
  useEffect(() => {
    if (!open) return
    function check() {
      const node = trigger.current, rect = node?.getBoundingClientRect()
      const clip = node?.closest('.module-controls,.app-header')?.getBoundingClientRect()
      if (disabled || !rect || rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight ||
        (clip && (rect.right <= clip.left || rect.left >= clip.right || rect.bottom <= clip.top || rect.top >= clip.bottom))) setOpen(false)
    }
    let frame: number
    function track() { check(); frame = requestAnimationFrame(track) }
    frame = requestAnimationFrame(track)
    document.addEventListener('scroll', check, true)
    window.addEventListener('resize', check)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('scroll', check, true); window.removeEventListener('resize', check) }
  }, [open, disabled, scale])
  function commit() {
    if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) {
      onChange(Math.min(400, Math.max(25, Number(draft))) / 100)
    }
    setDraft(null)
  }
  return <div className="zoom-control technical-data">
    <input type="number" inputMode="decimal" aria-label={label} title={label} min={25} max={400} step={1}
      disabled={disabled} value={draft ?? percent} onChange={event => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); commit() }
        if (event.key === 'Escape') { event.preventDefault(); setDraft(null) }
      }} /><span aria-hidden="true">%</span>
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <HelpTooltip text={label}><PopoverTrigger asChild><Button ref={trigger} className="zoom-trigger" disabled={disabled}
        aria-label={`Abrir deslizador: ${label}`}><Icon aria-hidden="true" /></Button></PopoverTrigger></HelpTooltip>
      <PopoverContent side={side} aria-label={label} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
        <div className="zoom-popover-label"><span>{label}</span><output>{percent} %</output></div>
        <Slider label={label} value={percent} min={25} max={400} disabled={disabled} onValueChange={value => { setDraft(null); onChange(value / 100) }} />
      </PopoverContent>
    </Popover>
  </div>
}
