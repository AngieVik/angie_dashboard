import { ALargeSmall, Check, FlipHorizontal2, FlipVertical2, Highlighter, MapPinOff, PaintBucket, Palette, Pencil, RotateCw, Trash2, Unlink } from 'lucide-react'
import labelStyles from '@/layout/controlValueLabel.module.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import type { DocumentElement, DrawingLabel, DrawingObjects, ElementVisual, QuickNote } from '@/domain/document/types'
import { INPUT_BUDGETS } from '@/domain/input/inputBudgets'
import { DrawingColorPicker } from './DrawingColorPicker'
import { useState } from 'react'
import styles from './drawing.module.css'

// Default label size, the same as the interface text.
const labelSize = 13
type Operation = 'rotate' | 'flipX' | 'flipY'
const operations = [['rotate', 'Girar 90°', RotateCw], ['flipX', 'Voltear horizontal', FlipHorizontal2], ['flipY', 'Voltear vertical', FlipVertical2]] as const

// Figures and strokes are edited on the canvas and with the toolbar; this panel keeps notes, labels and pins.
export function SelectionEditor<S extends { id: string }>({ objects, selected, selection = [], pin, modifyPin, editPin, removePin, clear, change, focusText = false, textFocused }: {
  objects: DrawingObjects & { strokes: S[]; quickNotes?: QuickNote[] }; selected: string | null; selection?: string[]; pin?: DocumentElement
  modifyPin: (visual: ElementVisual) => void; editPin: () => void; removePin?: () => void; clear: () => void
  change: (patch: Partial<DrawingObjects & { strokes: S[]; quickNotes: QuickNote[] }>) => boolean
  /** A label that was just created: its text is ready to type. */
  focusText?: boolean; textFocused?: () => void
}) {
  const [palette, setPalette] = useState(false), [backgroundPalette, setBackgroundPalette] = useState(false)
  const shape = objects.shapes?.find(s => s.id === selected), stroke = objects.strokes.find(s => s.id === selected)
  const note = objects.quickNotes?.find(n => n.id === selected), label = objects.labels?.find(l => l.id === selected)
  const drawn = shape ?? stroke
  const image = objects.images?.find(i => i.id === selected)
  if (selection.length > 1) return <strong>{selection.length} objetos</strong>
  if (image) return <strong>{image.source.name}</strong>
  if (!pin && !drawn && !note && !label) return <p className={styles.empty}>Ningún objeto seleccionado</p>
  const shapeName = shape && { line: 'Polilínea', rectangle: 'Rectángulo', polygon: 'Polígono', ellipse: 'Elipse' }[shape.kind]
  const name = pin?.name ?? (note ? 'Nota rápida' : label ? 'Etiqueta' : shapeName ?? 'Trazo')
  if (drawn) return <strong>{name}</strong>
  function transform(op: Operation) {
    if (!pin) return
    const v = pin.visual
    modifyPin(op === 'rotate' ? { ...v, rotation: ((v.rotation ?? 0) + 90) % 360 } : { ...v, [op]: !v[op] })
  }
  function restyleLabel(patch: Partial<DrawingLabel>) {
    change({ labels: objects.labels?.map(l => l === label ? { ...l, ...patch } : l) })
  }
  function remove() {
    if (pin) { removePin?.(); return }
    if (label) { if (change({ labels: objects.labels?.filter(l => l !== label) })) clear(); return }
    if (note && change({ quickNotes: objects.quickNotes?.filter(n => n !== note) })) clear()
  }
  const removeName = pin ? 'Retirar pin' : 'Eliminar ' + name.toLowerCase()
  return <div className={styles.objectEditor}>
    <strong>{name}</strong>
    <div className={styles.actions}>
      {pin && <>{operations.map(([op, title, Icon]) =>
        <Button key={op} title={title} aria-label={title} onClick={() => transform(op)}><Icon /></Button>)}
        <Button title="Editar recurso" aria-label="Editar recurso" onClick={editPin}><Pencil /></Button></>}
      {label && <>
        <Popover><PopoverTrigger asChild><Button aria-label="Abrir deslizador: Tamaño de letra" title="Tamaño de letra"><ALargeSmall /></Button></PopoverTrigger>
          <PopoverContent hideWhenDetached side="bottom" aria-label="Tamaño de letra">
            <div className={labelStyles.base}><span>Tamaño de letra</span><output>{label.size ?? labelSize}</output></div>
            <Slider label="Tamaño de letra" min={8} max={48} step={1} value={label.size ?? labelSize} onValueChange={size => restyleLabel({ size })} />
          </PopoverContent></Popover>
        <Popover open={palette} onOpenChange={setPalette}><PopoverTrigger asChild><Button aria-label="Color del texto" title="Color del texto"><Palette /></Button></PopoverTrigger>
          <PopoverContent className={styles.palette}><DrawingColorPicker key={selected + '-text'} value={label.color ?? '#FFFFFF'} disabled={false}
            apply={color => { restyleLabel({ color }); setPalette(false) }} /></PopoverContent></Popover>
        <Button aria-label="Fondo" title="Fondo" aria-pressed={!!label.background}
          onClick={() => restyleLabel(label.background ? { background: undefined } : { background: '#FFFFFF', color: label.color ?? '#292C32' })}><Highlighter /></Button>
        {label.background && <Popover open={backgroundPalette} onOpenChange={setBackgroundPalette}><PopoverTrigger asChild>
          <Button aria-label="Color del fondo" title="Color del fondo"><PaintBucket /></Button></PopoverTrigger>
          <PopoverContent className={styles.palette}><DrawingColorPicker key={selected + '-background'} value={label.background} disabled={false}
            apply={background => { restyleLabel({ background }); setBackgroundPalette(false) }} /></PopoverContent></Popover>}
        {label.owner && <Button aria-label="Soltar de la figura" title="Soltar de la figura" onClick={() => restyleLabel({ owner: undefined })}><Unlink /></Button>}
      </>}
      <Button disabled={!!pin && !removePin} aria-label={removeName} title={removeName} onClick={remove}>{pin ? <MapPinOff /> : <Trash2 />}</Button>
    </div>
    {(label || note) && <form className={styles.inlineForm} key={selected + (label?.text ?? note?.text ?? '')} onSubmit={e => {
      e.preventDefault(); const text = String(new FormData(e.currentTarget).get('text') ?? '')
      if (label && text.trim()) change({ labels: objects.labels?.map(l => l === label ? { ...l, text: text.trim() } : l) })
      if (note) change({ quickNotes: objects.quickNotes?.map(n => n === note ? { ...n, title: '', text } : n) })
    }}>
      {note ? <textarea aria-label="Texto de la nota" name="text" defaultValue={[note.title, note.text].filter(Boolean).join('\n')} maxLength={INPUT_BUDGETS.textCharacters} /> :
        <Input ref={input => { if (input && focusText) { input.focus({ preventScroll: true }); input.select(); textFocused?.() } }} aria-label="Texto de la etiqueta" name="text" defaultValue={label?.text} maxLength={INPUT_BUDGETS.textCharacters} required />}
      <Button type="submit" aria-label="Guardar texto" title="Guardar texto"><Check /></Button>
    </form>}
  </div>
}
