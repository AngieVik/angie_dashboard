import { useRef, type Ref } from 'react'
import { MousePointer, Pointer, Undo, Redo, Pencil, Waypoints, DraftingCompass, Eraser, StickyNote, NotebookPen, ImagePlus, Pin, Layers, SquarePi, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toolbar from '@/layout/moduleToolbar.module.css'
import { DrawingControls } from './DrawingControls'
import styles from './drawing.module.css'

const tools = [
  { mode: 'pan', name: 'Desplazar vista', icon: MousePointer },
  { mode: 'select', name: 'Seleccionar/mover', icon: Pointer },
  { mode: 'pen', name: 'Lápiz', icon: Pencil },
  { mode: 'polyline', name: 'Polilínea', icon: Waypoints },
  { mode: 'circle', name: 'Circunferencia', icon: DraftingCompass },
  { mode: 'eraser', name: 'Goma', icon: Eraser },
  { mode: 'label', name: 'Etiqueta de texto', icon: NotebookPen },
] as const
export type DrawingTool = typeof tools[number]['mode']
const panels = [{ id: 'resources', name: 'Pines', icon: Pin }, { id: 'edit', name: 'Edición', icon: SlidersHorizontal }, { id: 'groups', name: 'Grupos', icon: Layers }, { id: 'src', name: 'SRC', icon: SquarePi }] as const
export type Panel = typeof panels[number]['id']
export function DrawingToolbar({ toolbarRef, ...props }: React.ComponentProps<typeof DrawingControls> & {
  toolbarRef?: Ref<HTMLDivElement>; module: 'plan' | 'board'; mode: string
  fixed: boolean | null; onFixed: (fixed: boolean) => void
  onMode: (mode: DrawingTool) => void; canUndo: boolean; canRedo: boolean; replay: (dir: 'undo' | 'redo') => void
  onAddNote: () => void; onImage: (file: File) => void; panels: Panel[]; toggle: (panel: Panel) => void
}) {
  const file = useRef<HTMLInputElement>(null)
  function tool(item: typeof tools[number]) {
    const Icon = item.icon
    const setting = item.mode === 'eraser' ? 'Pasa por encima para borrar; las figuras se borran al tocar su línea' : item.mode === 'pan' ? 'Solo mueve la vista; ignora figuras, pines y notas' : undefined
    return <Button key={item.mode} data-board-mode={item.mode} aria-label={item.name} title={[item.name, setting].filter(Boolean).join(' · ')}
      aria-description={setting} disabled={props.blocked} aria-pressed={props.mode === item.mode} onClick={() => props.onMode(item.mode)}><Icon /></Button>
  }
  return <div ref={toolbarRef} data-drawing-toolbar className={props.module + '-toolbar ' + toolbar.base + ' ' + styles.toolbar}
    role="toolbar" aria-label={props.module === 'board' ? 'Herramientas de Pizarra' : 'Herramientas del Plano operativo'}
    onKeyDown={e => {
      const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const at = buttons.indexOf(e.target as HTMLButtonElement)
      if (at < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
      e.preventDefault()
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (at + (e.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length
      buttons[next]?.focus()
    }}>
    <div className={styles.toolGroup} role="group" aria-label="Selección e historial">
      {tool(tools[0])}
      {tool(tools[1])}
      <Button disabled={props.blocked || !props.canUndo} aria-label="Deshacer" title="Deshacer" onClick={() => props.replay('undo')}><Undo /></Button>
      <Button disabled={props.blocked || !props.canRedo} aria-label="Rehacer" title="Rehacer" onClick={() => props.replay('redo')}><Redo /></Button>
    </div>
    <div className={styles.toolGroup} role="group" aria-label="Dibujo">
      {tools.slice(2, 6).map(tool)}
      <DrawingControls {...props} />
    </div>
    <div className={styles.toolGroup} role="group" aria-label="Anotaciones">
      <Button disabled={props.blocked} aria-label="Nota rápida" title="Nota rápida · Haz clic donde quieras crearla" aria-pressed={props.mode === 'note'}
        onClick={props.onAddNote}><StickyNote /></Button>
      {tool(tools[6])}
      <Button disabled={props.blocked} aria-label="Insertar imagen" title="Insertar imagen" onClick={() => file.current?.click()}><ImagePlus /></Button>
      <input type="file" hidden ref={file} accept="image/png,image/jpeg" onChange={e => { const image = e.target.files?.[0]; e.target.value = ''; if (image) props.onImage(image) }} />
    </div>
    <div className={styles.toolGroup} role="group" aria-label="Paneles">
      {panels.map(({ id, name, icon: Icon }) => <Button key={id} disabled={props.blocked} aria-label={name} title={name} aria-pressed={props.panels.includes(id)}
        onClick={() => props.toggle(id)}><Icon /></Button>)}
    </div>
    <div className={styles.unitGroup} role="group" aria-label="Tamaño de Trazo, Polilínea y Circunferencia">
      <Button variant="icon" disabled={props.blocked} aria-pressed={props.fixed === false} aria-label="Metros a escala"
        title="Metros a escala" onClick={() => props.onFixed(false)}>m</Button>
      <Button variant="icon" disabled={props.blocked} aria-pressed={props.fixed === true} aria-label="Píxeles de pantalla"
        title="Píxeles de pantalla" onClick={() => props.onFixed(true)}>px</Button>
    </div>
  </div>
}

