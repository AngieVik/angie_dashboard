import { useRef } from 'react'
import { Button } from '../../components/ui/button'
import type { BoardMode } from './boardTypes'

const modes: { id: BoardMode; name: string }[] = [
  { id: 'select', name: 'Seleccionar/mover' }, { id: 'pen', name: 'Lápiz' },
  { id: 'eraser', name: 'Goma' }, { id: 'note', name: 'Nota rápida' },
]

export function BoardToolbar({ mode, onMode, background, onBackground, color, onColor, width, onWidth, onImage, busy, blocked }: {
  mode: BoardMode; onMode: (mode: BoardMode) => void; background: string; onBackground: (color: string) => void
  color: string; onColor: (color: string) => void; width: number; onWidth: (width: number) => void
  onImage: (file: File) => void; busy: boolean; blocked: boolean
}) {
  const file = useRef<HTMLInputElement>(null)
  return <div className="board-toolbar">
    <div className="board-modes" role="radiogroup" aria-label="Herramienta de pizarra" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || blocked) return
      event.preventDefault()
      const index = modes.findIndex(item => item.id === mode)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4
      onMode(modes[next]!.id)
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
    }}>
      {modes.map(item => <Button key={item.id} role="radio" aria-checked={mode === item.id} tabIndex={mode === item.id ? 0 : -1}
        disabled={blocked} title={item.name} onClick={() => onMode(item.id)}>{item.name}</Button>)}
    </div>
    <div className="board-options">
      <label title="Color de fondo">Fondo<input type="color" aria-label="Color de fondo" value={background} disabled={blocked} onChange={event => onBackground(event.target.value)} /></label>
      <Button title="Cargar imagen JPG o PNG" aria-label="Elegir imagen de fondo" disabled={blocked || busy} onClick={() => file.current?.click()}>JPG/PNG</Button>
      <input ref={file} type="file" aria-label="Cargar imagen de fondo" accept="image/png,image/jpeg,.png,.jpg,.jpeg" hidden onChange={event => {
        const selected = event.target.files?.[0]
        event.target.value = ''
        if (selected && !blocked) onImage(selected)
      }} />
      <label title="Color del lápiz">Lápiz<input type="color" aria-label="Color del lápiz" value={color} disabled={blocked} onChange={event => onColor(event.target.value)} /></label>
      <label title="Grosor">Grosor<input type="range" aria-label="Grosor" min="1" max="40" step="1" value={width} disabled={blocked} onChange={event => onWidth(Number(event.target.value))} /><output className="technical-data">{width}</output></label>
    </div>
  </div>
}
