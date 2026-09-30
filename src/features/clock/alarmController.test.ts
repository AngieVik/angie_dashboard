import { describe, expect, it, vi } from 'vitest'
import { AlarmController } from './alarmController'

function setup() {
  const audio = { loop: false, currentTime: 0, play: vi.fn(async () => {}), pause: vi.fn() }
  return { audio, controller: new AlarmController(audio) }
}
describe('alarma compartida', () => {
  it('cerrar una sesión sin reproducción no accede al audio', () => {
    const { audio, controller } = setup()
    controller.stop()
    expect(audio.pause).not.toHaveBeenCalled()
  })
  it('varias alertas usan un bucle y reconocer una mantiene las restantes', async () => {
    const { audio, controller } = setup()
    expect(await controller.startAlarm('a')).toEqual({ status: 'started' })
    await controller.startAlarm('b'); await controller.startAlarm('a')
    expect(audio.loop).toBe(true); expect(audio.play).toHaveBeenCalledTimes(1)
    controller.acknowledge('a')
    expect(controller.getSnapshot().activeCount).toBe(1); expect(audio.pause).not.toHaveBeenCalled()
    controller.acknowledge('b')
    expect(controller.getSnapshot().activeCount).toBe(0); expect(audio.pause).toHaveBeenCalledTimes(1)
  })
  it('prueba reversible, prioridad real y stopPreview no reconoce alarmas', async () => {
    const { audio, controller } = setup()
    await controller.startPreview()
    expect(controller.getSnapshot().preview).toBe(true)
    controller.stopPreview(); expect(controller.getSnapshot().preview).toBe(false)
    await controller.startPreview(); await controller.startAlarm('real')
    expect(controller.getSnapshot()).toMatchObject({ preview: false, activeCount: 1 })
    const plays = audio.play.mock.calls.length
    await controller.startPreview(); controller.stopPreview()
    expect(audio.play).toHaveBeenCalledTimes(plays)
    expect(controller.getSnapshot().activeCount).toBe(1)
    controller.stop(); expect(controller.getSnapshot().activeCount).toBe(0)
  })
  it.each([
    [new DOMException('permission', 'NotAllowedError'), 'blocked', 'Sonido bloqueado'],
    [new Error('decode'), 'error', 'No se pudo reproducir la alarma'],
  ])('diferencia fallo y reintenta sin retirar alertas', async (error, status, message) => {
    const { audio, controller } = setup()
    audio.play.mockRejectedValueOnce(error)
    expect(await controller.startAlarm('a')).toEqual({ status })
    expect(controller.getSnapshot()).toMatchObject({ error: message, activeCount: 1 })
    expect(await controller.activateSound()).toEqual({ status: 'started' })
    expect(controller.getSnapshot()).toMatchObject({ error: null, activeCount: 1 })
  })
  it('una promesa tardía no reactiva una prueba detenida ni muestra errores de una alerta resuelta', async () => {
    const { audio, controller } = setup()
    let reject!: (error: Error) => void
    audio.play.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
    const pending = controller.startAlarm('a')
    controller.acknowledge('a')
    reject(new DOMException('permission', 'NotAllowedError')); await pending
    expect(controller.getSnapshot()).toEqual({ activeCount: 0, preview: false, error: null })
  })
})
