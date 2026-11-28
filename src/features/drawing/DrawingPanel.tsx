import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Check, Eye, EyeOff, Focus, MapPin, Plus, Trash2, Square, SquareCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { PinThumbnail } from '../elements/PinThumbnail'
import type { DocumentElement, DrawingGroup, Position } from '@/domain/document/types'
import { INPUT_BUDGETS } from '@/domain/input/inputBudgets'
import { ReportSelectionResize } from '../document/ReportSelectionResize'
import type { Panel } from './DrawingToolbar'
import styles from './drawing.module.css'

interface Props {
  panels: Panel[]; container: RefObject<HTMLDivElement | null>; width: number; setWidth: (value: number) => void
  elements: DocumentElement[]; placed: Map<string, boolean>; selected: string | null; select: (id: string) => void
  place: (id: string, client?: Position) => void; center: (id: string) => void; pins: (ids: string[], visible: boolean | null) => void
  groups: DrawingGroup[]; members: { id: string; name: string }[]; saveGroups: (groups: DrawingGroup[]) => boolean
  fit: (ids: string[]) => void; editor: ReactNode; src: ReactNode; blocked: boolean
}
// Narrowest panel: a row of four icon buttons.
const panelMinimum = 180

export function DrawingPanel(p: Props) {
  const id = useId()
  const [multi, setMulti] = useState<string[] | null>(null)
  const [name, setName] = useState('')
  const [active, setActive] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const gesture = useRef<{ id: string; x: number; y: number; dragged: boolean; held: boolean } | null>(null)
  const skipClick = useRef(false)
  useEffect(() => () => clearTimeout(timer.current), [])
  const resourceIds = new Set(p.elements.map(e => e.id))
  const selection = (multi ?? (p.selected ? [p.selected] : [])).filter(key => resourceIds.has(key))
  const selectedIds = new Set(selection)
  const single = selection.length === 1 ? selection[0] : undefined
  const placed = selection.filter(key => p.placed.has(key))
  const visible = placed.some(key => p.placed.get(key))
  const group = p.groups.find(g => g.id === active)
  return <>
    <ReportSelectionResize container={p.container} value={p.width} onChange={p.setWidth} controls={id} disabled={p.blocked} label="Cambiar ancho del lienzo" keep={panelMinimum} />
    <aside className={styles.panel} id={id} aria-label="Panel de dibujo" inert={p.blocked}>
      {p.panels.includes('edit') && <section aria-label="Edición"><strong>Edición</strong>{p.editor}</section>}
      {p.panels.includes('resources') && <>
        <section aria-label="Pines"><strong>Pines</strong>
          <div className={styles.actions}>
            <Button aria-label="Colocar pin" title="Colocar pin" disabled={!single || p.placed.has(single)} onClick={() => single && p.place(single)}><MapPin /></Button>
            <Button aria-label={visible ? 'Ocultar pines' : 'Mostrar pines'} title={visible ? 'Ocultar pines' : 'Mostrar pines'} disabled={!placed.length} onClick={() => p.pins(placed, !visible)}>{visible ? <EyeOff /> : <Eye />}</Button>
            <Button aria-label="Centrar pin" title="Centrar pin" disabled={!single || !p.placed.has(single)} onClick={() => single && p.center(single)}><Focus /></Button>
            <Button aria-label="Retirar pines" title="Retirar pines" disabled={!placed.length} onClick={() => p.pins(placed, null)}><Trash2 /></Button>
            {multi && <Button aria-label="Terminar selección" title="Terminar selección" onClick={() => setMulti(null)}><Check /></Button>}
          </div>
          {p.elements.length === 0 && <p className={styles.empty}>Ningún elemento/dotación creado</p>}
          {p.elements.map(e => <button type="button" key={e.id} className={styles.row} aria-pressed={selectedIds.has(e.id)}
            onPointerDown={event => {
              if (!event.isPrimary || event.button !== 0) return
              skipClick.current = false
              gesture.current = { id: e.id, x: event.clientX, y: event.clientY, dragged: false, held: false }
              event.currentTarget.setPointerCapture(event.pointerId)
              clearTimeout(timer.current)
              timer.current = setTimeout(() => { if (gesture.current) { gesture.current.held = true; setMulti([e.id]); p.select(e.id) } }, 2000)
            }} onPointerMove={event => {
              const g = gesture.current
              if (!g || g.id !== e.id || g.held) return
              const dx = Math.abs(event.clientX - g.x), dy = Math.abs(event.clientY - g.y)
              if (Math.max(dx, dy) <= 5) return
              clearTimeout(timer.current)
              if (dx > dy && !g.dragged && !p.placed.has(e.id)) { g.dragged = true; setMulti(null); p.select(e.id) }
            }} onPointerUp={event => {
              const g = gesture.current
              clearTimeout(timer.current); gesture.current = null
              skipClick.current = Boolean(g?.dragged || g?.held)
              if (g?.dragged) p.place(e.id, { x: event.clientX, y: event.clientY })
            }} onPointerCancel={() => { clearTimeout(timer.current); gesture.current = null; skipClick.current = true }}
            onClick={() => {
              if (skipClick.current) { skipClick.current = false; return }
              p.select(e.id)
              if (multi) setMulti(multi.includes(e.id) ? multi.filter(key => key !== e.id) : [...multi, e.id])
            }}>
            {multi && (selectedIds.has(e.id) ? <SquareCheck aria-hidden="true" /> : <Square aria-hidden="true" />)}
            <PinThumbnail visual={e.visual} />
            <span className={styles.resourceText}><strong>{e.name}</strong>{e.information && <span>{e.information}</span>}</span>
            {p.placed.has(e.id) && <span className={styles.placement} role="img" aria-label="Pin colocado" title="Pin colocado"><MapPin /></span>}
          </button>)}
        </section>
      </>}
      {p.panels.includes('groups') && <section aria-label="Grupos"><strong>Grupos</strong>
        <form className={styles.inlineForm} onSubmit={event => {
          event.preventDefault()
          if (!name.trim()) return
          const item = { id: crypto.randomUUID(), name: name.trim(), visible: true, members: [] }
          if (p.saveGroups([...p.groups, item])) { setName(''); setActive(item.id) }
        }}><Input aria-label="Nombre del grupo" placeholder="Nombre del grupo" value={name} maxLength={INPUT_BUDGETS.textCharacters} onChange={e => setName(e.target.value)} />
          <Button type="submit" disabled={!name.trim()} aria-label="Crear grupo" title="Crear grupo"><Plus /></Button></form>
        {p.groups.map(g => <div className={styles.groupRow} key={g.id}>
          <Button aria-pressed={g.id === active} onClick={() => setActive(g.id)}>{g.name}</Button>
          <Button aria-label={(g.visible ? 'Ocultar ' : 'Mostrar ') + g.name} title={g.visible ? 'Ocultar grupo' : 'Mostrar grupo'} onClick={() => p.saveGroups(p.groups.map(item => item === g ? { ...g, visible: !g.visible } : item))}>{g.visible ? <Eye /> : <EyeOff />}</Button>
          <Button aria-label={'Encuadrar ' + g.name} title="Encuadrar grupo" disabled={!g.members.length} onClick={() => p.fit(g.members)}><Focus /></Button>
          <Button aria-label={'Borrar ' + g.name} title={'Borrar grupo; sus objetos se conservan'} onClick={() => toast.warning(`¿Borrar el grupo «${g.name}»? Sus objetos se conservan.`, { id: 'drawing-remove-group', requiredAction: true,
            action: { label: 'Borrar', onClick: () => { if (p.saveGroups(p.groups.filter(item => item.id !== g.id)) && active === g.id) setActive('') } },
            cancel: { label: 'Cancelar', onClick: () => {} } })}><Trash2 /></Button>
        </div>)}
        {group && <fieldset><legend>{group.name}</legend>{p.members.map(m => <label key={m.id}>
          <Checkbox aria-label={m.name} checked={group.members.includes(m.id)} onCheckedChange={checked => p.saveGroups(p.groups.map(item => item === group
            ? { ...group, members: checked ? [...group.members, m.id] : group.members.filter(key => key !== m.id) } : item))} />{m.name}
        </label>)}</fieldset>}
      </section>}
      {p.panels.includes('src') && <section aria-label="SRC"><strong>SRC</strong>{p.src}</section>}
    </aside>
  </>
}

