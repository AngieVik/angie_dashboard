import labelStyles from '@/layout/controlValueLabel.module.css'
import { useRef, useState } from 'react'
import { GitCommitVertical, PaintBucket } from 'lucide-react'
import { DrawingColorPicker } from './DrawingColorPicker'
import styles from './drawing.module.css'
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
  return <>
    <Popover open={open && !blocked} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button ref={trigger} disabled={blocked} aria-label="Abrir deslizador: Grosor" title="Grosor"><GitCommitVertical aria-hidden="true" /></Button></PopoverTrigger>
      <PopoverContent hideWhenDetached side="bottom" aria-label="Grosor" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
        <div className={labelStyles.base}><span>Grosor</span><output>{width}</output></div>
        <Slider label="Grosor" value={width} min={1} max={40} step={1} disabled={blocked} onValueChange={onWidth} />
      </PopoverContent>
    </Popover>
    <Popover open={palette && !blocked} onOpenChange={value => { setTarget('ink'); setPalette(value) }}>
      <PopoverTrigger asChild><Button title="Selector de color" aria-label={onBackground ? 'Color de herramientas o fondo' : 'Color de herramientas'} disabled={blocked}>
        <InkPaletteIcon color={color}
          icon={palette && target === 'background' ? PaintBucket : undefined} />
      </Button></PopoverTrigger>
      <PopoverContent hideWhenDetached side="bottom" aria-label="Selector de color" className={styles.palette}>
        {onBackground && <button type="button" role="switch" className={styles.colorTarget}
          aria-label="Editar el color del fondo" aria-checked={target === 'background'} disabled={blocked}
          onClick={() => setTarget(target === 'ink' ? 'background' : 'ink')}>
          <span data-current={target === 'ink'}>Herramientas</span>
          <span data-current={target === 'background'}>Fondo</span>
        </button>}
        <DrawingColorPicker key={target} value={target === 'background' && background ? background : color} disabled={blocked}
          apply={value => { (target === 'ink' ? onColor : onBackground)?.(value); setPalette(false) }} />
      </PopoverContent>
    </Popover>
  </>
}
