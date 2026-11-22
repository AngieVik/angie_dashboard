import labelStyles from '@/layout/controlValueLabel.module.css'
import { useEffect, useRef, useState } from 'react'
import { GitCommitVertical } from 'lucide-react'
import { InkPaletteIcon } from '@/components/InkPaletteIcon'
import { Button } from '@/components/ui/button'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'

export function DrawingControls({ color, width, blocked, onColor, onWidth, background, onBackground }: {
  background?: string; onBackground?: (color: string) => void
  color: string; width: number; blocked: boolean
  onColor: (color: string) => void; onWidth: (width: number) => void
}) {
  const [palette, setPalette] = useState(false)
  const [target, setTarget] = useState<'ink' | 'background'>('ink')
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    let frame: number
    function check() {
      const node = trigger.current, rect = node?.getBoundingClientRect()
      const clips = [node?.closest('[data-drawing-toolbar]'), node?.closest('.module-content')]
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
      <PopoverTrigger asChild><Button ref={trigger} disabled={blocked} aria-label="Abrir deslizador: Grosor"><GitCommitVertical aria-hidden="true" /></Button></PopoverTrigger>
      <PopoverContent side="bottom" aria-label="Grosor" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
        <div className={labelStyles.base}><span>Grosor</span><output>{width}</output></div>
        <Slider label="Grosor" value={width} min={1} max={40} step={1} disabled={blocked} onValueChange={onWidth} />
      </PopoverContent>
    </Popover>
    <Popover open={palette && !blocked} onOpenChange={value => { setTarget('ink'); setPalette(value) }}>
      <PopoverTrigger asChild><Button aria-label={onBackground ? 'Color de herramientas o fondo' : 'Color de herramientas'} disabled={blocked}><InkPaletteIcon color={color} /></Button></PopoverTrigger>
      <PopoverContent side="bottom" aria-label="Selector de color">
        {onBackground && <div role="group" aria-label="Aplicar color a">
          <Button aria-pressed={target === 'ink'} onClick={() => setTarget('ink')}>Herramientas</Button>
          <Button aria-pressed={target === 'background'} onClick={() => setTarget('background')}>Fondo</Button>
        </div>}
        <input type="color" aria-label={target === 'ink' ? 'Tinta de herramientas' : 'Color de fondo'} value={target === 'ink' ? color : background}
          disabled={blocked} onChange={event => (target === 'ink' ? onColor : onBackground)?.(event.target.value.toUpperCase())} />
      </PopoverContent>
    </Popover>
  </>
}
