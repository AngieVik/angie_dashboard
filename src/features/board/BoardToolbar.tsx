import labelStyles from '@/layout/controlValueLabel.module.css'
import { useEffect, useRef, useState } from 'react'
import type { Ref, RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import { Separator } from '@/components/ui/separator'
import type { BoardMode } from './boardTypes'
import styles from './BoardToolbar.module.css'
import toolbarStyles from '@/layout/moduleToolbar.module.css'
import { Pointer, Pencil, Eraser, StickyNote, Ambulance, Package, GitCommitVertical, Palette, PaintRoller, FileImage, ImageOff, SquareDimensions, MopSparkles } from 'lucide-react'

const modes = [
  { id: 'select', name: 'Seleccionar/mover', icon: Pointer }, { id: 'pen', name: 'Lápiz', icon: Pencil },
  { id: 'eraser', name: 'Goma', icon: Eraser }, { id: 'image', name: 'Mover y redimensionar imagen', icon: SquareDimensions },
] as const

export function BoardToolbar({ mode, onMode, background, onBackground, color, onColor, width, onWidth, onImage, onClearImage, onClearStrokes, hasStrokes, hasImage, onOpenModule, onAddNote, busy, blocked, toolbarRef, imageInputRef: file }: {
  mode: BoardMode; onMode: (mode: BoardMode) => void; background: string; onBackground: (color: string) => void
  color: string; onColor: (color: string) => void; width: number; onWidth: (width: number) => void
  onImage: (file: File) => void; onClearImage: () => void; onClearStrokes: () => void; hasStrokes: boolean; hasImage: boolean
  onOpenModule?: (id: 'dotations' | 'elements') => void; onAddNote: () => void; busy: boolean; blocked: boolean
  toolbarRef?: Ref<HTMLDivElement>
  imageInputRef: RefObject<HTMLInputElement | null>
}) {
  const penColor = useRef<HTMLInputElement>(null), backgroundColor = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    let frame: number
    function check() {
      const node = trigger.current, rect = node?.getBoundingClientRect()
      const clips = [node?.closest('.board-toolbar'), node?.closest('.module-content')]
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
  function tool(index: number) {
    const item = modes[index]!
    return <Button role="radio" aria-checked={mode === item.id} tabIndex={mode === item.id ? 0 : -1}
      disabled={blocked || (item.id === 'image' && (!hasImage || busy))} aria-label={item.name} onClick={() => onMode(item.id)}><item.icon aria-hidden="true" /></Button>
  }
  return <div ref={toolbarRef} className={`board-toolbar ${toolbarStyles.base}`} role="radiogroup" aria-label="Herramienta de pizarra" onKeyDown={event => {
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'radio' ||
      !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || blocked) return
    event.preventDefault()
    const available = modes.filter(item => item.id !== 'image' || (hasImage && !busy))
    const index = available.findIndex(item => item.id === mode)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 :
      (index + (event.key === 'ArrowRight' ? 1 : available.length - 1)) % available.length
    const item = available[next]!
    onMode(item.id)
    event.currentTarget.querySelector<HTMLButtonElement>('[aria-label="' + item.name + '"]')?.focus()
  }}>
    {tool(0)}
    <Separator orientation="vertical" />
    {tool(1)}{tool(2)}
    <Button aria-label="Borrar todos los trazos" disabled={blocked || !hasStrokes} onClick={onClearStrokes}><MopSparkles aria-hidden="true" /></Button>
    <Popover open={open && !blocked} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button ref={trigger} disabled={blocked} aria-label="Abrir deslizador: Grosor"><GitCommitVertical aria-hidden="true" /></Button></PopoverTrigger>
      <PopoverContent side="bottom" aria-label="Grosor" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
        <div className={labelStyles.base}><span>Grosor</span><output>{width}</output></div>
        <Slider label="Grosor" value={width} min={1} max={40} step={1} disabled={blocked} onValueChange={onWidth} />
      </PopoverContent>
    </Popover>
    <span className={`board-color-control ${styles.colorControl}`}>
      <Button disabled={blocked} aria-label="Elegir color del lápiz" onClick={() => penColor.current?.click()}><Palette aria-hidden="true" /></Button>
      <input ref={penColor} type="color" aria-label="Color del lápiz" value={color} disabled={blocked} tabIndex={-1} onChange={event => onColor(event.target.value)} />
    </span>
    <Separator orientation="vertical" />
    <Button disabled={blocked} aria-label="Nota rápida" onClick={onAddNote}><StickyNote aria-hidden="true" /></Button>
    <Button disabled={blocked} aria-label="Abrir Dotaciones" onClick={() => onOpenModule?.('dotations')}><Ambulance aria-hidden="true" /></Button>
    <Button disabled={blocked} aria-label="Abrir Elementos" onClick={() => onOpenModule?.('elements')}><Package aria-hidden="true" /></Button>
    <Separator orientation="vertical" />
    <span className={`board-color-control ${styles.colorControl}`}>
      <Button disabled={blocked} aria-label="Elegir color de fondo" onClick={() => backgroundColor.current?.click()}><PaintRoller aria-hidden="true" /></Button>
      <input ref={backgroundColor} type="color" aria-label="Color de fondo" value={background} disabled={blocked} tabIndex={-1} onChange={event => onBackground(event.target.value)} />
    </span>
    <Button aria-label="Elegir imagen de fondo" disabled={blocked || busy} onClick={() => file.current?.click()}><FileImage aria-hidden="true" /></Button>
    {tool(3)}
    <Button aria-label="Borrar imagen de fondo" disabled={blocked || (!hasImage && !busy)} onClick={onClearImage}><ImageOff aria-hidden="true" /></Button>
    <input ref={file} type="file" aria-label="Cargar imagen de fondo" accept="image/png,image/jpeg,.png,.jpg,.jpeg" hidden onChange={event => {
      const selected = event.target.files?.[0]
      event.target.value = ''
      if (selected && !blocked) onImage(selected)
    }} />
  </div>
}
