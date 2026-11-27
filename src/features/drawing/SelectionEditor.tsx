import { FlipHorizontal2, FlipVertical2, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { removeDrawingReferences } from '@/domain/document/drawingReferences'
import type { DocumentElement, DrawingObjects, ElementVisual, Position, QuickNote } from '@/domain/document/types'
import { INPUT_BUDGETS } from '@/domain/input/inputBudgets'
import { DrawingColorPicker } from './DrawingColorPicker'
import { useState } from 'react'
import type { Projection } from './shapeGeometry'
import styles from './drawing.module.css'

type Operation = 'rotate' | 'flipX' | 'flipY'
const operations = [['rotate', 'Girar 90°', RotateCw], ['flipX', 'Voltear horizontal', FlipHorizontal2], ['flipY', 'Voltear vertical', FlipVertical2]] as const

export function SelectionEditor<P, S extends { id: string; color: string | null; width: number; points: P[] }>({ objects, selected, pin, modifyPin, editPin, removePin, clear, change, getProjection, toPoint, fromPoint }: {
  objects: DrawingObjects & { strokes: S[]; quickNotes?: QuickNote[] }; selected: string | null; pin?: DocumentElement
  modifyPin: (visual: ElementVisual) => void; editPin: () => void; removePin?: () => void; clear: () => void
  change: (patch: Partial<DrawingObjects & { strokes: S[]; quickNotes: QuickNote[] }>) => boolean
  getProjection: () => Projection | undefined; toPoint: (p: P) => Position; fromPoint: (p: Position) => P
}) {
  const [palette, setPalette] = useState(false)
  const shape = objects.shapes?.find(s => s.id === selected), stroke = objects.strokes.find(s => s.id === selected)
  const note = objects.quickNotes?.find(n => n.id === selected), label = objects.labels?.find(l => l.id === selected)
  const drawn = shape ?? stroke
  const image = objects.images?.find(i => i.id === selected)
  if (image) return <strong>{image.source.name}</strong>
  if (!pin && !drawn && !note && !label) return <p className={styles.empty}>Selecciona un objeto para editarlo.</p>
  const shapeName = shape && { line: 'Polilínea', rectangle: 'Rectángulo', polygon: 'Polígono', ellipse: 'Elipse' }[shape.kind]
  const name = pin?.name ?? (note ? 'Nota rápida' : label ? 'Etiqueta' : shapeName ?? 'Trazo')
  function transform(op: Operation) {
    if (pin) {
      const v = pin.visual
      modifyPin(op === 'rotate' ? { ...v, rotation: ((v.rotation ?? 0) + 90) % 360 } : { ...v, [op]: !v[op] })
      return
    }
    const projection = getProjection()
    if (!projection || !drawn) return
    const points = shape?.points ?? stroke!.points.map(toPoint)
    const screen = points.map(projection.screen)
    if (!screen.length) return
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
    for (const p of screen) { left = Math.min(left, p.x); right = Math.max(right, p.x); top = Math.min(top, p.y); bottom = Math.max(bottom, p.y) }
    const cx = (left + right) / 2, cy = (top + bottom) / 2
    function turn(p: Position) {
      const q = projection!.screen(p), dx = q.x - cx, dy = q.y - cy
      return projection!.world(op === 'rotate' ? { x: cx - dy, y: cy + dx } :
        { x: op === 'flipX' ? cx - dx : q.x, y: op === 'flipY' ? cy - dy : q.y })
    }
    const labels = objects.labels?.map(l => l.owner === selected ? { ...l, point: turn(l.point) } : l)
    if (shape) change({ labels, shapes: objects.shapes?.map(s => s === shape ? { ...s, points: s.points.map(turn),
      ...(op === 'rotate' && s.radii ? { radii: { x: s.radii.y, y: s.radii.x } } : {}) } : s) })
    else change({ labels, strokes: objects.strokes.map(s => s === stroke ? { ...s, points: points.map(turn).map(fromPoint) } : s) })
  }
  function style(patch: { width?: number; color?: string }) {
    if (shape) change({ shapes: objects.shapes?.map(s => s === shape ? { ...s, ...patch } : s) })
    else if (stroke) change({ strokes: objects.strokes.map(s => s === stroke ? { ...s, ...patch } : s) })
  }
  function remove() {
    if (pin) { removePin?.(); return }
    if (!selected) return
    const { groups, labels } = removeDrawingReferences(objects, new Set([selected]))
    if (change({ groups, labels: labels?.filter(l => l.id !== selected),
      ...(shape ? { shapes: objects.shapes?.filter(s => s !== shape) } : {}),
      ...(stroke ? { strokes: objects.strokes.filter(s => s !== stroke) } : {}),
      ...(note ? { quickNotes: objects.quickNotes?.filter(n => n !== note) } : {}) })) clear()
  }
  return <div className={styles.objectEditor}>
    <strong>{name}</strong>
    {(pin || drawn) && <div className={styles.actions}>{operations.map(([op, title, Icon]) =>
      <Button key={op} title={title} aria-label={title} onClick={() => transform(op)}><Icon /></Button>)}</div>}
    {pin && <Button onClick={editPin}>Editar recurso</Button>}
    {drawn && <>
      <Popover open={palette} onOpenChange={setPalette}><PopoverTrigger asChild><Button>Color del objeto</Button></PopoverTrigger>
        <PopoverContent className={styles.palette}><DrawingColorPicker key={selected} value={drawn.color ?? '#000000'} disabled={false}
          apply={color => { style({ color }); setPalette(false) }} /></PopoverContent></Popover>
      <label>Grosor · {drawn.width}<Slider label="Grosor del objeto" min={1} max={40} step={1} value={drawn.width} onValueChange={width => style({ width })} /></label>
    </>}
    {(label || note) && <form key={selected + (label?.text ?? note?.text ?? '')} onSubmit={e => {
      e.preventDefault(); const text = String(new FormData(e.currentTarget).get('text') ?? '')
      if (label && text.trim()) change({ labels: objects.labels?.map(l => l === label ? { ...l, text: text.trim() } : l) })
      if (note) change({ quickNotes: objects.quickNotes?.map(n => n === note ? { ...n, title: '', text } : n) })
    }}>
      {note ? <textarea aria-label="Texto de la nota" name="text" defaultValue={[note.title, note.text].filter(Boolean).join('\n')} maxLength={INPUT_BUDGETS.textCharacters} /> :
        <Input aria-label="Texto de la etiqueta" name="text" defaultValue={label?.text} maxLength={INPUT_BUDGETS.textCharacters} required />}
      <Button type="submit">Guardar texto</Button>
    </form>}
    <Button disabled={!!pin && !removePin} onClick={remove}>{pin ? 'Retirar pin' : 'Eliminar ' + name.toLowerCase()}</Button>
  </div>
}
