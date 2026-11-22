import type { Ref } from 'react'
import { Pointer, Undo, Redo, Pencil, Waypoints, DraftingCompass, Eraser, StickyNote, NotebookPen, Pin, Layers, SquarePi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toolbar from '@/layout/moduleToolbar.module.css'
import { DrawingControls } from './DrawingControls'

const tools = [
  { mode: 'select', name: 'Seleccionar/mover', icon: Pointer },
  { mode: 'pen', name: 'Lápiz', icon: Pencil },
  { mode: 'polyline', name: 'Polilínea', icon: Waypoints },
  { mode: 'circle', name: 'Circunferencia', icon: DraftingCompass },
  { mode: 'eraser', name: 'Goma', icon: Eraser },
  { mode: 'label', name: 'Etiqueta de texto', icon: NotebookPen },
] as const
export type DrawingTool = typeof tools[number]['mode']
const panels = [{ id: 'resources', name: 'Recursos', icon: Pin }, { id: 'groups', name: 'Grupos', icon: Layers }, { id: 'src', name: 'SRC', icon: SquarePi }] as const
export type Panel = typeof panels[number]['id']
export interface DrawingSettings { polyline: boolean; circle: boolean; eraser: boolean }
export function DrawingToolbar({ toolbarRef, ...props }: React.ComponentProps<typeof DrawingControls> & {
  toolbarRef?: Ref<HTMLDivElement>; module: 'plan' | 'board'; mode: string; settings: DrawingSettings
  onMode: (mode: DrawingTool) => void; canUndo: boolean; canRedo: boolean; replay: (dir: 'undo' | 'redo') => void
  onAddNote: () => void; panels: Panel[]; toggle: (panel: Panel) => void
}) {
  function tool(item: typeof tools[number]) {
    const setting = item.mode === 'eraser' ? props.settings.eraser ? 'Borrar figuras y trazos' : 'Borrar trazos'
      : item.mode === 'circle' || item.mode === 'polyline' ? props.settings[item.mode] ? 'Fijo en pantalla' : 'A escala con el dibujo' : undefined
    return <Button key={item.mode} data-board-mode={item.mode} aria-label={item.name} title={[item.name, setting].filter(Boolean).join(' · ')}
      aria-description={setting} disabled={props.blocked} aria-pressed={props.mode === item.mode} onClick={() => props.onMode(item.mode)}><item.icon /></Button>
  }
  return <div ref={toolbarRef} data-drawing-toolbar className={props.module + '-toolbar ' + toolbar.base}
    role="toolbar" aria-label={props.module === 'board' ? 'Herramientas de Pizarra' : 'Herramientas del Plano operativo'}
    onKeyDown={e => {
      const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const at = buttons.indexOf(e.target as HTMLButtonElement)
      if (at < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
      e.preventDefault()
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (at + (e.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length
      buttons[next]?.focus()
    }}>
    {tool(tools[0])}
    <Button disabled={props.blocked || !props.canUndo} aria-label="Deshacer" onClick={() => props.replay('undo')}><Undo /></Button>
    <Button disabled={props.blocked || !props.canRedo} aria-label="Rehacer" onClick={() => props.replay('redo')}><Redo /></Button>
    {tools.slice(1, 5).map(tool)}
    <DrawingControls {...props} />
    <Button disabled={props.blocked} aria-label="Nota rápida" onClick={props.onAddNote}><StickyNote /></Button>
    {tool(tools[5])}
    {panels.map(({ id, name, icon: Icon }) => <Button key={id} disabled={props.blocked} aria-label={name} aria-pressed={props.panels.includes(id)}
      onClick={() => props.toggle(id)}><Icon /></Button>)}
  </div>
}

