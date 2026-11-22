import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ComponentProps } from 'react'
import { addDays, addMonths, format, isSameDay, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { MonthCaption } from 'react-day-picker'
import type { DayButtonProps } from 'react-day-picker'
import { Check, ChevronLeft, ChevronRight, PenLine, Plus, RefreshCw, Trash, X } from 'lucide-react'
import { Switch } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { useViewportInteraction } from '@/layout/ViewportContext'
import { ModuleSizeContext } from '@/layout/ModuleSizeContext'
import { ModuleZoomContext } from '@/layout/ModuleZoomContext'
import { syncCalendarAgendaLayout } from '@/layout/windowContentSize'
import { calendarDateKey as dateKey, createCalendarEvent, eventsOnDate } from './calendarEvents'
import type { CalendarEvent, CalendarEventInput } from './calendarEvents'
import type { CalendarStore } from './calendarStore'
import styles from './calendar.module.css'
import { MoonPhase } from '../astronomy/MoonPhase'
import { useSettings } from '../settings/useSettings'
import { formatClockTime, formatDateKey } from '@/platform/formatting'

const EventsContext = createContext<readonly CalendarEvent[]>([])
const dayLabel = (date: Date) => format(date, 'EEEE d MMMM', { locale: es })
function HiddenMonthCaption(props: ComponentProps<typeof MonthCaption>) { return <MonthCaption {...props} className="visually-hidden" /> }
function EventDayButton(props: DayButtonProps) {
  const events = eventsOnDate(useContext(EventsContext), dateKey(props.day.date))
  return <CalendarDayButton {...props} className={`${props.className ?? ''} ${styles.day}`} aria-label={`${props['aria-label']}${events.length ? `, ${events.length} eventos` : ''}`}>
    {props.children}
    {events.length > 0 && <span className={styles.dots} aria-hidden="true">{events.slice(0, 3).map(event => <i key={event.id} style={{ backgroundColor: event.color }} />)}</span>}
  </CalendarDayButton>
}

export function CalendarModule({ store }: { store: CalendarStore }) {
  const { events, selectedDate, ready, busy, error } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const { settings } = useSettings()
  const { blocked, blockedRef } = useViewportInteraction()
  const requestSpace = useContext(ModuleSizeContext)
  const { scale } = useContext(ModuleZoomContext)
  const calendarRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<HTMLDivElement>(null)
  const datesRef = useRef<HTMLElement>(null)
  const agendaRef = useRef<HTMLElement>(null)
  const toggleSize = useRef<{ side: boolean; width: number; height: number } | null>(null)
  const closedCalendar = useRef<{ side: boolean; width: number; height: number } | null>(null)
  const selected = useMemo(() => parseISO(selectedDate), [selectedDate])
  const [month, setMonth] = useState(() => parseISO(store.getSnapshot().selectedDate))
  const [view, setView] = useState<'month' | 'week'>('month')
  const [showEvents, setShowEvents] = useState(true)
  const [editing, setEditing] = useState<{ original: CalendarEvent | null; input: CalendarEventInput } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [, notice] = useValidationNotice()
  const disabled = blocked || !ready || busy
  const selectedKey = dateKey(selected), daily = eventsOnDate(events, selectedKey)
  const editorOpen = editing !== null
  useLayoutEffect(() => {
    const calendar = calendarRef.current
    if (!calendar) return
    const synchronize = () => {
      syncCalendarAgendaLayout(calendar)
      requestSpace('minimum')
    }
    const toggle = toggleSize.current
    const agenda = agendaRef.current, layout = layoutRef.current
    if (toggle && layout && agenda) {
      toggleSize.current = null
      const style = getComputedStyle(layout)
      const gap = parseFloat(toggle.side ? style.columnGap : style.rowGap) || 0
      if (showEvents) agenda.dataset.measurePosition = toggle.side ? 'right' : 'below'
      const width = toggle.width + (showEvents && toggle.side ? agenda.offsetWidth + gap : 0)
      const height = toggle.height + (showEvents && !toggle.side ? agenda.offsetHeight + gap : 0)
      delete agenda.dataset.measurePosition
      requestSpace({ agendaDelta: { width: width - calendar.clientWidth, height: height - calendar.clientHeight } })
      if (!showEvents) closedCalendar.current = { side: toggle.side, width, height }
    } else synchronize()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(synchronize)
    observer.observe(calendar)
    return () => observer.disconnect()
  }, [requestSpace, events, selectedDate, month, view, showEvents, editorOpen, deleting, blocked, scale])
  function toggleEvents(open: boolean) {
    const calendar = calendarRef.current, layout = layoutRef.current, dates = datesRef.current
    if (blockedRef.current || !calendar || !layout || !dates) return
    const style = getComputedStyle(calendar)
    const previous = closedCalendar.current
    const sameSize = previous && Math.abs(previous.width - calendar.clientWidth) <= 1 && Math.abs(previous.height - calendar.clientHeight) <= 1
    const side = open && sameSize ? previous.side : getComputedStyle(layout).getPropertyValue('--calendar-agenda-position').trim() === 'right'
    const agendaHeight = showEvents && !side
      ? (agendaRef.current?.offsetHeight ?? 0) + parseFloat(getComputedStyle(layout).rowGap)
      : 0
    const height = layout.offsetHeight - agendaHeight
    toggleSize.current = { side, width: dates.offsetWidth + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
      height: height + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) }
    setShowEvents(open)
  }
  function choose(date: Date) { if (!blockedRef.current) { store.selectDate(dateKey(date)); setMonth(date); setDeleting(null) } }
  function navigate(direction: number) {
    if (view === 'week') choose(addDays(selected, direction * 7))
    else { const next = addMonths(month, direction); setMonth(next); store.selectDate(dateKey(next)) }
  }
  function edit(event?: CalendarEvent) {
    setDeleting(null)
    setEditing({ original: event ?? null, input: event ? { ...event } : { title: '', startDate: selectedKey, endDate: selectedKey, time: null, color: '#d63a3a' } })
  }
  function change(patch: Partial<CalendarEventInput>) { setEditing(current => current ? { ...current, input: { ...current.input, ...patch } } : null) }
  async function save() {
    if (!editing || disabled || blockedRef.current) return
    try {
      const original = editing.original
      if (original && JSON.stringify(store.getSnapshot().events.find(event => event.id === original.id)) !== JSON.stringify(original)) throw new Error('El evento cambió. Vuelve a abrirlo antes de guardar.')
      const event = createCalendarEvent(editing.input, original?.id)
      if (await store.save(event)) { choose(parseISO(event.startDate)); setEditing(null); notice(null) }
    } catch (error) { notice(error instanceof Error ? error.message : 'No se pudo guardar el evento.') }
  }
  const week = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selected, { weekStartsOn: 1 }), index))
  return <div ref={calendarRef} className={styles.base} data-slot="calendar-module">
    <div ref={layoutRef} className={styles.layout} data-slot="calendar-layout" data-minimum-scroll-content data-events-open={showEvents}>
      <header className={styles.toolbar}>
        <div className={styles.selectedDate}>
          <Input type="date" aria-label="Fecha seleccionada" value={selectedKey} disabled={disabled}
            onKeyDown={event => {
              if ((event.key === 'Enter' || event.key === ' ') && !blockedRef.current && event.currentTarget.showPicker) {
                event.preventDefault()
                if (!event.repeat) event.currentTarget.showPicker()
              }
            }}
            onClick={event => { if (!disabled && !blockedRef.current && typeof event.currentTarget.showPicker === 'function') { event.preventDefault(); event.currentTarget.showPicker() } }}
            onChange={event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) choose(parseISO(event.target.value)) }} />
          <span aria-hidden="true" data-disabled={disabled}>{formatDateKey(selectedDate, settings.formats.date)}</span>
        </div>
        <Switch.Root className={styles.eventsSwitch} disabled={blocked} aria-label="Mostrar eventos" checked={showEvents}
          onCheckedChange={toggleEvents}><Switch.Thumb /></Switch.Root>
        {error && <Button disabled={busy} aria-label="Recargar agenda" onClick={() => { void store.reload() }}><RefreshCw aria-hidden="true" /></Button>}
      </header>
      <div className={styles.views} role="group" aria-label="Navegación y vista del calendario">
        <Button variant="text" disabled={disabled} aria-label={view === 'month' ? 'Mes anterior' : 'Semana anterior'} onClick={() => navigate(-1)}><ChevronLeft aria-hidden="true" /></Button>
        <Button disabled={disabled} onClick={() => choose(new Date())}>Hoy</Button>
        <Button disabled={disabled} aria-pressed={view === 'week'} onClick={() => setView('week')}>Semana</Button>
        <Button disabled={disabled} aria-pressed={view === 'month'} onClick={() => setView('month')}>Mes</Button>
        <Button variant="text" disabled={disabled} aria-label={view === 'month' ? 'Mes siguiente' : 'Semana siguiente'} onClick={() => navigate(1)}><ChevronRight aria-hidden="true" /></Button>
      </div>
      <section ref={datesRef} className={styles.dates} aria-label={view === 'month' ? 'Calendario mensual' : 'Calendario semanal'}>
        {view === 'month' ? <EventsContext value={events}>
          <Calendar mode="single" required selected={selected} onSelect={choose} month={month} onMonthChange={setMonth} hideNavigation fixedWeeks
            components={{ MonthCaption: HiddenMonthCaption, DayButton: EventDayButton }} disabled={disabled} />
        </EventsContext> : <div className={styles.week}>
          {week.map(date => {
            const items = eventsOnDate(events, dateKey(date))
            return <Button key={dateKey(date)} className={styles.weekDay} disabled={disabled} aria-label={dayLabel(date)} aria-pressed={isSameDay(date, selected)} data-today={isSameDay(date, new Date())} onClick={() => choose(date)}>
              <span>{format(date, 'EEE', { locale: es })}</span><time dateTime={dateKey(date)}>{format(date, 'd')}</time>
              {items.slice(0, 3).map(event => <span key={event.id} className={styles.weekEvent} style={{ borderColor: event.color }}>{event.title}</span>)}
              {items.length > 3 && <span>+{items.length - 3}</span>}
            </Button>
          })}
        </div>}
      </section>
      <section ref={agendaRef} className={styles.agenda} aria-label="Agenda del día" hidden={!showEvents}>
        <header className={styles.agendaHeader}><h3>{dayLabel(selected)}</h3><Button disabled={disabled || Boolean(error)} aria-label="Nuevo evento" onClick={() => edit()}><Plus aria-hidden="true" /></Button></header>
        <MoonPhase day={selectedKey} />
        {editing ? <form className={styles.form} aria-label={editing.original ? 'Editar evento' : 'Nuevo evento'} onSubmit={event => { event.preventDefault(); void save() }}>
          <label>Título<Input autoFocus aria-label="Título del evento" required maxLength={120} value={editing.input.title} disabled={disabled || Boolean(error)} onChange={event => change({ title: event.target.value })} /></label>
          <div className={styles.fields}>
            <label>Desde<Input type="date" aria-label="Fecha inicial" required value={editing.input.startDate} disabled={disabled || Boolean(error)} onChange={event => change({ startDate: event.target.value, ...(event.target.value > editing.input.endDate ? { endDate: event.target.value } : {}) })} /></label>
            <label>Hasta<Input type="date" aria-label="Fecha final" required min={editing.input.startDate} value={editing.input.endDate} disabled={disabled || Boolean(error)} onChange={event => change({ endDate: event.target.value })} /></label>
          </div>
          <div className={styles.fields}>
            <label>Hora<Input type="time" aria-label="Hora opcional" value={editing.input.time ?? ''} disabled={disabled || Boolean(error)} onChange={event => change({ time: event.target.value || null })} /></label>
            <label>Color<Input type="color" aria-label="Color del evento" value={editing.input.color} disabled={disabled || Boolean(error)} onChange={event => change({ color: event.target.value })} /></label>
          </div>
          <div className={styles.actions}><Button type="submit" disabled={disabled || Boolean(error)}><Check aria-hidden="true" />Guardar</Button><Button disabled={busy || blocked} onClick={() => setEditing(null)}><X aria-hidden="true" />Cancelar</Button></div>
        </form> : <>
          {!daily.length && <p className={styles.empty}>Sin eventos</p>}
          <ol className={styles.events}>{daily.map(event => <li key={event.id} className={styles.event} style={{ borderLeftColor: event.color }}>
            <div className={styles.eventText}><span className={styles.eventTitle}>{event.title}</span>
              <span className={styles.eventTime}>{event.time ? formatClockTime(event.time, settings.formats.time) : 'Sin hora'}{event.endDate !== event.startDate && ` · ${formatDateKey(event.startDate, settings.formats.date)}–${formatDateKey(event.endDate, settings.formats.date)}`}</span>
            </div>
            {deleting === event.id ? <div className={styles.actions}><Button disabled={disabled || Boolean(error)} aria-label={'Confirmar eliminación de ' + event.title} onClick={() => { if (!blockedRef.current) void store.remove(event.id).then(removed => { if (removed) setDeleting(null) }) }}><Check aria-hidden="true" /></Button><Button disabled={disabled} aria-label="Cancelar eliminación" onClick={() => setDeleting(null)}><X aria-hidden="true" /></Button></div> : <div className={styles.actions}>
              <Button disabled={disabled || Boolean(error)} aria-label={'Editar ' + event.title} onClick={() => edit(event)}><PenLine aria-hidden="true" /></Button>
              <Button disabled={disabled || Boolean(error)} aria-label={'Eliminar ' + event.title} onClick={() => setDeleting(event.id)}><Trash aria-hidden="true" /></Button>
            </div>}
          </li>)}</ol>
        </>}
      </section>
    </div>
  </div>
}
