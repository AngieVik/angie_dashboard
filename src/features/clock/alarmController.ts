export interface AlarmAudio { loop: boolean; currentTime: number; play(): Promise<void>; pause(): void }
export type PlaybackResult = { status: 'started' | 'blocked' | 'error' | 'stopped' }
export interface AlarmState { activeCount: number; preview: boolean; error: string | null }
export class AlarmController {
  private readonly alerts = new Set<string>()
  private state: AlarmState = { activeCount: 0, preview: false, error: null }
  private listeners = new Set<() => void>()
  private generation = 0
  private playing = false
  private pending: Promise<PlaybackResult> | null = null
  constructor(private readonly audio: AlarmAudio = new Audio('/assets/audio/alarm.mp3')) {}
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(patch: Partial<AlarmState>) {
    this.state = { ...this.state, ...patch, activeCount: this.alerts.size }
    this.listeners.forEach(listener => listener())
  }
  private halt() {
    const hadPlayback = this.playing || this.pending !== null
    this.generation++
    this.pending = null
    this.playing = false
    if (hadPlayback) { this.audio.pause(); this.audio.currentTime = 0 }
    this.update({ error: null })
  }
  private play(): Promise<PlaybackResult> {
    if (this.playing) return Promise.resolve({ status: 'started' })
    if (this.pending) return this.pending
    const generation = ++this.generation
    this.audio.loop = true
    // Invoke play synchronously inside the click handler to preserve user activation.
    let attempt: Promise<void>
    try { attempt = this.audio.play() } catch (error) { attempt = Promise.reject(error) }
    const pending = attempt.then<PlaybackResult>(() => {
      if (generation !== this.generation) return { status: 'stopped' }
      this.playing = true
      this.update({ error: null })
      return { status: 'started' }
    }).catch((error: unknown): PlaybackResult => {
      if (generation !== this.generation) return { status: 'stopped' }
      const blocked = typeof error === 'object' && error !== null && 'name' in error && error.name === 'NotAllowedError'
      this.update({ error: blocked ? 'Sonido bloqueado' : 'No se pudo reproducir la alarma' })
      return { status: blocked ? 'blocked' : 'error' }
    }).finally(() => { if (generation === this.generation) this.pending = null })
    this.pending = pending
    return pending
  }
  startAlarm(timerId: string): Promise<PlaybackResult> {
    if (this.alerts.has(timerId)) return this.pending ?? Promise.resolve({ status: this.playing ? 'started' : 'stopped' })
    if (this.state.preview) this.stopPreview()
    this.alerts.add(timerId)
    this.update({ preview: false })
    return this.play()
  }
  acknowledge(timerId: string) {
    if (!this.alerts.delete(timerId)) return
    this.update({})
    if (this.alerts.size === 0 && !this.state.preview) this.halt()
  }
  startPreview(): Promise<PlaybackResult> {
    if (this.alerts.size) return Promise.resolve({ status: 'stopped' })
    this.update({ preview: true })
    return this.play()
  }
  stopPreview() {
    if (!this.state.preview) return
    this.update({ preview: false })
    if (!this.alerts.size) this.halt()
  }
  stop() {
    this.alerts.clear()
    this.update({ preview: false })
    this.halt()
  }
  activateSound(): Promise<PlaybackResult> {
    return this.alerts.size || this.state.preview ? this.play() : Promise.resolve({ status: 'stopped' })
  }
}
