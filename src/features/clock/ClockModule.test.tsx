import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModuleSizeContext } from '../../layout/ModuleSizeContext'
import { ClockModule } from './ClockModule'
import { createTimerStore } from './timerStore'
import { AlarmController } from './alarmController'
import { createTimer, startTimer } from './timerEngine'
import type { TimerRecord } from './timerTypes'
import { createDocumentStore } from '../document/documentStore'
import { createEmptyDocument } from '../../domain/document/defaultDocument'

const disconnect: (() => void)[] = []
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T12:00:00Z')) })
afterEach(() => { disconnect.splice(0).forEach(stop => stop()); vi.useRealTimers() })
async function setup(records: TimerRecord[] = []) {
  let saved = structuredClone(records)
  const repository = {
    loadTimers: vi.fn(async () => structuredClone(saved)),
    saveTimers: vi.fn(async (next: TimerRecord[]) => { saved = structuredClone(next) }),
  }
  const audio = { loop: false, currentTime: 0, play: vi.fn(async () => {}), pause: vi.fn() }
  const alarm = new AlarmController(audio), store = createTimerStore(repository, alarm)
  await store.initialize(); disconnect.push(store.connect())
  const view = render(<ClockModule store={store} />)
  return { store, alarm, audio, repository, view, saved: () => saved }
}
async function advance(ms: number) { await act(async () => { vi.advanceTimersByTime(ms) }) }
function row(name: string) { return within(screen.getByRole('group', { name })) }

describe('Módulo Reloj', () => {
  it('oculta el rótulo de estado y conserva el cierre por icono accesible', async () => {
    await setup([createTimer('tzero')])
    expect(screen.queryByText('Inactivo')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'T-Zero 1' })).toHaveAccessibleDescription('Inactivo')
    const close = row('T-Zero 1').getByRole('button', { name: 'Cerrar temporizador' })
    expect(close).toHaveClass('timer-close')
    expect(close.querySelector('svg')).toBeInTheDocument()
    fireEvent.click(close)
    expect(screen.queryByRole('group', { name: 'T-Zero 1' })).not.toBeInTheDocument()
  })
  it('oculta todas las anotaciones sin borrar notas guardadas', async () => {
    const records = [createTimer('tzero'), createTimer('tminus'), createTimer('advisory')].map(timer => ({ ...timer, note: 'Canal 4' }))
    const { store, saved } = await setup(records)
    expect(screen.queryAllByRole('textbox', { name: 'Nota' })).toHaveLength(0)
    fireEvent.click(row('T-Zero 1').getByRole('button', { name: 'Iniciar' }))
    await act(async () => store.flush())
    expect(saved().map(timer => timer.note)).toEqual(['Canal 4', 'Canal 4', 'Canal 4'])
  })
  it('solicita espacio al añadir cada tipo sin redimensionar en cada tick', async () => {
    const { store, view } = await setup()
    const requestSpace = vi.fn()
    view.rerender(<ModuleSizeContext value={requestSpace}><ClockModule store={store} /></ModuleSizeContext>)
    expect(requestSpace).not.toHaveBeenCalled()
    for (const name of ['T-Zero', 'T-Minus', 'Advisories']) fireEvent.click(screen.getByRole('button', { name }))
    expect(requestSpace).toHaveBeenCalledTimes(3)
    expect(requestSpace).toHaveBeenLastCalledWith(expect.objectContaining({ width: 300 }))
    await advance(2000)
    expect(requestSpace).toHaveBeenCalledTimes(3)
  })
  it('recoge altura al cerrar cada tipo incluido el último sin ajustar al hacer tick', async () => {
    const { store, view } = await setup([createTimer('tzero'), createTimer('tminus'), createTimer('advisory')])
    const requestSpace = vi.fn()
    view.rerender(<ModuleSizeContext value={requestSpace}><ClockModule store={store} /></ModuleSizeContext>)
    expect(requestSpace).not.toHaveBeenCalled()
    for (const name of ['T-Zero 1', 'T-Minus 1', 'Advisory 1']) {
      fireEvent.click(row(name).getByRole('button', { name: 'Cerrar temporizador' }))
      expect(requestSpace).toHaveBeenLastCalledWith(expect.objectContaining({ width: 0 }), { fitHeight: true })
    }
    expect(requestSpace).toHaveBeenCalledTimes(3)
    await advance(2000)
    expect(requestSpace).toHaveBeenCalledTimes(3)
    expect(view.container.querySelector('.clock-module')).not.toHaveAttribute('data-sizing')
  })
  it.each([
    ['2026-01-01T12:04:05Z', '13:04:05', 'WT'],
    ['2026-07-01T12:04:05Z', '14:04:05', 'ST'],
  ])('presenta referencias informativas y horas española/UTC en %s', async (instant, esp, season) => {
    vi.setSystemTime(new Date(instant)); await setup()
    expect(screen.getByText('Digital Watch', { exact: false }).closest('.clock-reference')).toHaveTextContent(/^Digital WatchUTC\+2 \[ST\] - UTC\+1 \[WT\]ESP$/)
    expect(screen.getByLabelText('Hora española')).toHaveTextContent(new RegExp(`^${esp}$`))
    expect(screen.getByLabelText('Hora Zulu')).toHaveTextContent(/^12:04:05$/)
    expect(screen.getByText('Zulu Time')).toBeInTheDocument()
    expect(screen.getByText(season === 'ST' ? 'UTC+2 [ST]' : 'UTC+1 [WT]')).toHaveClass('clock-season-active')
    for (const name of ['T-Zero', 'T-Minus', 'Advisories']) expect(screen.getByRole('button', { name })).toHaveTextContent(new RegExp(`^${name}$`))
    expect(screen.getByRole('button', { name: 'Reproducir prueba de sonido' })).toHaveTextContent(/^$/)
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })
  it('la alarma real sustituye la prueba y deshabilita Sonido hasta reconocerla', async () => {
    const timer = createTimer('tminus', 1), { store, alarm } = await setup([timer])
    const preview = screen.getByRole('button', { name: 'Reproducir prueba de sonido' })
    await act(async () => fireEvent.click(preview))
    expect(preview).toHaveAccessibleName('Detener prueba de sonido')
    expect(preview).toHaveTextContent(/^$/)
    act(() => store.start(timer.id)); await advance(1000)
    expect(alarm.getSnapshot()).toMatchObject({ preview: false, activeCount: 1, error: null })
    expect(preview).toHaveAccessibleName('Reproducir prueba de sonido')
    expect(preview).toHaveTextContent(/^$/); expect(preview).toBeDisabled()
    fireEvent.click(row('T-Minus 1').getByRole('button', { name: 'Reconocer alerta' }))
    expect(preview).toBeEnabled(); expect(alarm.getSnapshot().activeCount).toBe(0)
  })
  it('Sonido bloqueado permite reintentar la prueba sin cambiar temporizadores', async () => {
    const { store, audio, alarm } = await setup([createTimer('advisory', 10)])
    const timers = structuredClone(store.getSnapshot().timers)
    audio.play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reproducir prueba de sonido' })))
    expect(screen.getByRole('alert')).toHaveTextContent('Sonido bloqueado')
    expect(screen.getByRole('button', { name: 'Detener prueba de sonido' })).toHaveTextContent(/^$/)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Activar sonido' })))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(alarm.getSnapshot()).toMatchObject({ preview: true, activeCount: 0, error: null })
    expect(store.getSnapshot().timers).toEqual(timers)
  })
  it('dos reintentos simultáneos no resucitan un temporizador cerrado tras recuperar', async () => {
    const timer = startTimer(createTimer('tminus', 1), Date.now() - 2000)
    let resolveFirst!: (value: TimerRecord[]) => void, resolveSecond!: (value: TimerRecord[]) => void
    const first = new Promise<TimerRecord[]>(resolve => { resolveFirst = resolve })
    const second = new Promise<TimerRecord[]>(resolve => { resolveSecond = resolve })
    let attempt = 0
    const repository = { loadTimers: async () => { attempt++; if (attempt === 1) throw new Error('read'); return attempt === 2 ? first : second }, saveTimers: async () => {} }
    const alarm = new AlarmController({ loop: false, currentTime: 0, play: async () => {}, pause: () => {} })
    const store = createTimerStore(repository, alarm)
    await store.initialize()
    const retry1 = store.retryPersistence(), retry2 = store.retryPersistence()
    resolveFirst([timer]); await retry1
    expect(store.getSnapshot().timers).toHaveLength(1)
    store.close(timer.id); await store.flush()
    resolveSecond([timer]); await retry2
    expect(store.getSnapshot().timers).toHaveLength(0)
    expect(alarm.getSnapshot().activeCount).toBe(0)
  })
  it('reconocer y cerrar desde teclado conserva foco dentro de los controles', async () => {
    const timer = createTimer('tminus', 1)
    const { store } = await setup([timer, createTimer('tzero')])
    act(() => store.start(timer.id)); await advance(1000)
    const acknowledge = row('T-Minus 1').getByRole('button', { name: 'Reconocer alerta' })
    acknowledge.focus(); fireEvent.click(acknowledge)
    expect(row('T-Minus 1').getByRole('button', { name: 'Reiniciar' })).toHaveFocus()
    const close = row('T-Minus 1').getByRole('button', { name: 'Cerrar temporizador' })
    close.focus(); fireEvent.click(close)
    expect(row('T-Zero 1').getByRole('button', { name: 'Cerrar temporizador' })).toHaveFocus()
  })
  it('muestra España, referencias tácticas y Zulu; crea múltiples tipos con controles', async () => {
    await setup()
    expect(screen.getByLabelText('Hora española')).toHaveTextContent('13:00:00')
    expect(screen.getByLabelText('Hora Zulu')).toHaveTextContent(/^12:00:00$/)
    expect(screen.getByText('UTC+2 [ST]')).toBeInTheDocument(); expect(screen.getByText('UTC+1 [WT]')).toBeInTheDocument()
    for (const name of ['T-Zero', 'T-Zero', 'T-Minus', 'Advisories']) fireEvent.click(screen.getByRole('button', { name }))
    expect(screen.getAllByRole('group', { name: /^T-Zero / })).toHaveLength(2)
    const advisory = row('Advisory 1')
    expect(advisory.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument()
    expect(advisory.getByRole('button', { name: 'Desactivar' })).toBeInTheDocument()
    fireEvent.click(row('T-Zero 1').getByRole('button', { name: 'Iniciar' }))
    await advance(2500)
    expect(row('T-Zero 1').getByLabelText('Tiempo')).toHaveTextContent('00:00:02')
    fireEvent.click(row('T-Zero 1').getByRole('button', { name: 'Pausar' })); await advance(3000)
    expect(row('T-Zero 1').getByLabelText('Tiempo')).toHaveTextContent('00:00:02')
    fireEvent.click(row('T-Zero 1').getByRole('button', { name: 'Reiniciar' }))
    expect(row('T-Zero 1').getByLabelText('Tiempo')).toHaveTextContent('00:00:00')
    expect(row('T-Zero 1').queryByRole('textbox', { name: 'Nota' })).not.toBeInTheDocument()
  })
  it('un único campo de duración normaliza al salir e iniciar y rechaza letras', async () => {
    await setup(); fireEvent.click(screen.getByRole('button', { name: 'T-Minus' }))
    const timer = row('T-Minus 1'), field = timer.getByRole('textbox', { name: 'Duración inicial' })
    expect(timer.getAllByRole('textbox')).toHaveLength(1)
    expect(field).toHaveAttribute('inputmode', 'numeric')
    fireEvent.change(field, { target: { value: '00:90:00' } }); fireEvent.blur(field)
    expect(field).toHaveValue('01:30:00')
    fireEvent.change(field, { target: { value: 'x4.5' } }); expect(field).toHaveValue('01:30:00')
    fireEvent.change(field, { target: { value: '000000' } }); fireEvent.click(timer.getByRole('button', { name: 'Iniciar' }))
    expect(field).toHaveValue('00:00:01')
    expect(field).toBeDisabled()
    await advance(1000)
    expect(timer.getByLabelText('Tiempo')).toHaveTextContent('00:00:00')
    expect(timer.getByRole('button', { name: 'Reconocer alerta' })).toBeInTheDocument()
  })
  it('alertas independientes comparten audio, reconocer finaliza y desactivar/reiniciar/cerrar retira solo una', async () => {
    const records = [createTimer('tminus', 1), createTimer('advisory', 1), createTimer('tminus', 1)]
    const { store, audio } = await setup(records)
    act(() => records.forEach(timer => store.start(timer.id)))
    await advance(1000)
    expect(screen.getAllByRole('button', { name: 'Reconocer alerta' })).toHaveLength(3)
    expect(audio.play).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Reproducir prueba de sonido' })).toBeDisabled()
    fireEvent.click(row('T-Minus 1').getByRole('button', { name: 'Reconocer alerta' }))
    expect(screen.getByRole('group', { name: 'T-Minus 1' })).toHaveAccessibleDescription('Finalizado')
    fireEvent.click(row('T-Minus 1').getByRole('button', { name: 'Reiniciar' }))
    fireEvent.click(row('Advisory 1').getByRole('button', { name: 'Desactivar' }))
    expect(row('Advisory 1').getByLabelText('Tiempo')).toHaveTextContent('00:00:00')
    expect(audio.pause).not.toHaveBeenCalled()
    fireEvent.click(row('T-Minus 2').getByRole('button', { name: 'Cerrar temporizador' }))
    expect(audio.pause).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('group', { name: 'T-Minus 2' })).not.toBeInTheDocument()
  })
  it('prueba común conserva los temporizadores y se detiene al desmontar el módulo', async () => {
    const { store, view, audio } = await setup([createTimer('advisory', 10)])
    const timers = store.getSnapshot().timers
    const button = screen.getByRole('button', { name: 'Reproducir prueba de sonido' })
    await act(async () => fireEvent.click(button))
    expect(button).toHaveTextContent(/^$/)
    expect(button).toHaveAccessibleName('Detener prueba de sonido')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(store.getSnapshot().timers).toEqual(timers)
    await act(async () => fireEvent.click(button)); expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAccessibleName('Reproducir prueba de sonido')
    await act(async () => fireEvent.click(button)); view.unmount()
    expect(audio.pause).toHaveBeenCalledTimes(2)
  })
  it.each([
    [new DOMException('blocked', 'NotAllowedError'), 'Sonido bloqueado'],
    [new Error('decode'), 'No se pudo reproducir la alarma'],
  ])('audio fallido conserva alerta visual y permite activarlo', async (error, message) => {
    const timer = createTimer('tminus', 1), { store, audio } = await setup([timer])
    audio.play.mockRejectedValueOnce(error)
    act(() => store.start(timer.id)); await advance(1000)
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    await advance(5001)
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(row('T-Minus 1').getByRole('button', { name: 'Reconocer alerta' }).closest('.timer-row')).toHaveAttribute('data-alert', 'true')
    if (message === 'Sonido bloqueado') {
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Activar sonido' })))
      expect(screen.queryByText(message)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reconocer alerta' })).toBeInTheDocument()
    }
  })
  it('sigue contando cerrado y recalcula al regresar mediante visibilitychange', async () => {
    const timer = createTimer('advisory', 2), { store, view } = await setup([timer])
    act(() => store.start(timer.id)); view.unmount()
    vi.setSystemTime(Date.now() + 5000)
    await act(async () => window.document.dispatchEvent(new Event('visibilitychange')))
    render(<ClockModule store={store} />)
    expect(screen.getByRole('button', { name: 'Reconocer alerta' })).toBeInTheDocument()
  })
  it('Nuevo/Guardar/Cargar no cambian los temporizadores ni los incluyen en el JSON visible', async () => {
    const { store } = await setup([startTimer({ ...createTimer('tminus', 15), note: 'Radio' }, Date.now())])
    const documents = createDocumentStore({ loadActive: async () => null, saveActive: async () => {}, clearActive: async () => {} }, { platform: { download: (text: string) => { exported = JSON.parse(text) } } })
    let exported: unknown
    await documents.initialize()
    const timers = structuredClone(store.getSnapshot().timers)
    await act(async () => {
      documents.newDocument(); await documents.saveDocument()
      await documents.loadDocument({ text: async () => JSON.stringify(createEmptyDocument('Otro')) })
    })
    expect(store.getSnapshot().timers).toEqual(timers)
    expect(Object.keys(exported!)).toEqual(['format', 'formatVersion', 'document', 'board', 'elements', 'notebook', 'timeline', 'moduleLayouts'])
    expect(JSON.stringify(exported)).not.toContain('Radio')
  })
  it('recupera un ciclo vencido y una alerta reconocida sin reactivarla', async () => {
    const ended = startTimer(createTimer('tminus', 2), Date.now() - 5000)
    const recognized = { ...createTimer('advisory', 2), status: 'completed' as const, elapsedMs: 2000, alertActive: false }
    await setup([ended, recognized])
    expect(screen.getAllByRole('button', { name: 'Reconocer alerta' })).toHaveLength(1)
    expect(screen.getByRole('group', { name: 'Advisory 1' })).toHaveAccessibleDescription('Finalizado')
  })
  it('fallo de persistencia conserva controles y reintenta el estado más reciente', async () => {
    const { repository, store } = await setup()
    repository.saveTimers.mockRejectedValueOnce(new Error('write'))
    fireEvent.click(screen.getByRole('button', { name: 'T-Zero' }))
    await act(async () => store.flush())
    expect(screen.getByRole('alert')).toHaveTextContent('Autoguardado no disponible')
    fireEvent.click(row('T-Zero 1').getByRole('button', { name: 'Iniciar' }))
    await act(async () => store.retryPersistence())
    expect(screen.queryByText('Autoguardado no disponible')).not.toBeInTheDocument()
  })
})
