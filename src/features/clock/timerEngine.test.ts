import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculateTimerValue, createTimer, normalizeDuration, formatDuration, startTimer, pauseTimer, resetTimer, deactivateTimer, acknowledgeTimer, settleTimer, spanishClock } from './timerEngine'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T12:00:00Z')) })
afterEach(() => vi.useRealTimers())
describe('motor por marcas de tiempo', () => {
  it.each([
    [['00', '90', '00'], 5400, '01:30:00'], [['00', '00', '90'], 90, '00:01:30'],
    [['01', '90', '90'], 9090, '02:31:30'], [['0', '0', '0'], 1, '00:00:01'],
    [['99', '99', '99'], 86399, '23:59:59'], [['', '', ''], 1, '00:00:01'],
  ] as const)('normaliza %j', (fields, seconds, text) => {
    expect(normalizeDuration(fields[0], fields[1], fields[2])).toBe(seconds)
    expect(formatDuration(seconds)).toBe(text)
  })
  it('pausa y reanuda T-Zero sin contar el tiempo pausado; reinicia a cero', () => {
    let timer = startTimer(createTimer('tzero'), Date.now())
    vi.advanceTimersByTime(3210)
    expect(calculateTimerValue(timer, Date.now()).valueSeconds).toBe(3)
    timer = pauseTimer(timer, Date.now())
    vi.advanceTimersByTime(60_000)
    expect(calculateTimerValue(timer, Date.now()).valueSeconds).toBe(3)
    timer = startTimer(timer, Date.now())
    vi.advanceTimersByTime(790)
    expect(calculateTimerValue(timer, Date.now()).valueSeconds).toBe(4)
    expect(resetTimer(timer)).toMatchObject({ status: 'idle', elapsedMs: 0, startedAt: null, alertActive: false })
  })
  it('T-Zero al máximo vuelve a cero e inactivo sin otro ciclo ni alerta', () => {
    const timer = startTimer(createTimer('tzero'), Date.now())
    expect(timer.status).toBe('running')
    vi.advanceTimersByTime(86_399_000)
    const settled = settleTimer(timer, Date.now())
    expect(settled).toMatchObject({ status: 'idle', elapsedMs: 0, alertActive: false, startedAt: null })
    vi.advanceTimersByTime(5000)
    expect(calculateTimerValue(settled, Date.now()).valueSeconds).toBe(0)
  })
  it('T-Minus mantiene duración al pausar y reiniciar; completa y reconoce sin desaparecer', () => {
    let timer = startTimer(createTimer('tminus', 10), Date.now())
    vi.advanceTimersByTime(2100)
    timer = pauseTimer(timer, Date.now())
    expect(calculateTimerValue(timer, Date.now()).valueSeconds).toBe(8)
    timer = resetTimer(timer)
    expect(calculateTimerValue(timer, Date.now()).valueSeconds).toBe(10)
    timer = startTimer(timer, Date.now())
    vi.advanceTimersByTime(15_000)
    timer = settleTimer(timer, Date.now())
    expect(calculateTimerValue(timer, Date.now())).toEqual({ valueSeconds: 0, status: 'completed', alertActive: true })
    const acknowledged = acknowledgeTimer(timer)
    expect(acknowledged).toMatchObject({ id: timer.id, status: 'completed', alertActive: false })
    expect(startTimer(acknowledged, Date.now())).toEqual(acknowledged)
  })
  it.each([2000, 10_000])('Desactivar Advisory a %i ms conserva nota/duración y permite otro ciclo completo', ms => {
    let timer = { ...createTimer('advisory', 10), note: 'Radio' }
    timer = startTimer(timer, Date.now())
    vi.advanceTimersByTime(ms)
    timer = deactivateTimer(settleTimer(timer, Date.now()))
    expect(timer).toMatchObject({ status: 'idle', elapsedMs: 0, alertActive: false, note: 'Radio', durationSeconds: 10 })
    expect(calculateTimerValue(timer, Date.now()).valueSeconds).toBe(0)
    timer = startTimer(timer, Date.now())
    vi.advanceTimersByTime(9999)
    expect(calculateTimerValue(timer, Date.now())).toMatchObject({ status: 'running', alertActive: false, valueSeconds: 9 })
    vi.advanceTimersByTime(1)
    expect(calculateTimerValue(timer, Date.now())).toMatchObject({ status: 'completed', alertActive: true, valueSeconds: 10 })
  })
  it('recalcula tras suspensión sin depender de ticks ni mutar el registro original', () => {
    const now = Date.now(), timer = startTimer(createTimer('advisory', 15), now)
    const recovered = JSON.parse(JSON.stringify(timer))
    expect(calculateTimerValue(recovered, now + 20_000)).toMatchObject({ status: 'completed', alertActive: true })
    expect(timer.status).toBe('running')
  })
  it('España cambia de invierno a verano automáticamente y Zulu permanece UTC', () => {
    expect(spanishClock(Date.parse('2026-03-29T00:59:59Z'))).toEqual({ esp: '01:59:59', zulu: '00:59:59', season: 'WT' })
    expect(spanishClock(Date.parse('2026-03-29T01:00:00Z'))).toEqual({ esp: '03:00:00', zulu: '01:00:00', season: 'ST' })
    expect(spanishClock(Date.parse('2026-10-25T01:00:00Z'))).toEqual({ esp: '02:00:00', zulu: '01:00:00', season: 'WT' })
  })
})
