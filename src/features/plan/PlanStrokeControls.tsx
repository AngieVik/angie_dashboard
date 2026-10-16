import { useEffect, useRef, useState } from 'react'
import { GitCommitVertical, Palette } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { HelpTooltip } from '../../components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import { Slider } from '../../components/ui/slider'

export function PlanStrokeControls({ color, width, blocked, onColor, onWidth }: {
  color: string; width: number; blocked: boolean
  onColor: (color: string) => void; onWidth: (width: number) => void
}) {
  const penColor = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    let frame: number
    function check() {
      const node = trigger.current, rect = node?.getBoundingClientRect()
      const clips = [node?.closest('.plan-toolbar'), node?.closest('.module-content')]
      if (blocked || !rect || rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight ||
        clips.some(clip => {
          const box = clip?.getBoundingClientRect()
          return box && (rect.right <= box.left || rect.left >= box.right || rect.bottom <= box.top || rect.top >= box.bottom)
        })) setOpen(false)
    }
    function track() { check(); frame = requestAnimationFrame(track) }
    frame = requestAnimationFrame(track)
    document.addEventListener('scroll', check, true)
    window.addEventListener('resize', check)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('scroll', check, true); window.removeEventListener('resize', check) }
  }, [open, blocked])
  return <>
    <Popover open={open && !blocked} onOpenChange={setOpen}>
      <HelpTooltip text="Grosor"><PopoverTrigger asChild><Button ref={trigger} disabled={blocked} aria-label="Abrir deslizador: Grosor"><GitCommitVertical aria-hidden="true" /></Button></PopoverTrigger></HelpTooltip>
      <PopoverContent side="bottom" aria-label="Grosor" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
        <div className="zoom-popover-label"><span>Grosor</span><output>{width}</output></div>
        <Slider label="Grosor" value={width} min={1} max={40} step={1} disabled={blocked} onValueChange={onWidth} />
      </PopoverContent>
    </Popover>
    <span className="plan-color-control">
      <HelpTooltip text="Color del lápiz"><Button disabled={blocked} aria-label="Elegir color del lápiz" onClick={() => penColor.current?.click()}><Palette aria-hidden="true" /></Button></HelpTooltip>
      <input ref={penColor} type="color" aria-label="Color del lápiz" value={color} disabled={blocked} tabIndex={-1} onChange={event => onColor(event.target.value)} />
    </span>
  </>
}
