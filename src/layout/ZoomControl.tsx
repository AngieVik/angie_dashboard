import { useEffect, useId, useRef, useState } from 'react'
import { GitCommitHorizontal, GitCommitVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import styles from './zoomControl.module.css'
import controlStyles from './controlButton.module.css'
import labelStyles from './controlValueLabel.module.css'
import { VIEWPORT_ZOOM_MAX, VIEWPORT_ZOOM_MIN, ZOOM_STEP_DEFAULT } from './viewportMath'
import { useSettings } from '@/features/settings/useSettings'

export function ZoomControl({ scale, onChange, label, disabled = false, side = 'bottom' }: {
  scale: number; onChange: (scale: number) => void; label: string; disabled?: boolean; side?: 'bottom' | 'right'
}) {
  const inputId = useId()
  const { settings } = useSettings()
  const step = settings.zoomStep
  const percent = Math.round(scale * 100)
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const sliderPointer = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const replaceInput = useRef(true)
  useEffect(() => {
    const node = input.current
    if (!node) return
    function prepare(event: InputEvent) {
      if (!replaceInput.current) return
      replaceInput.current = false
      if (event.inputType.startsWith('insert')) node!.value = ''
    }
    node.addEventListener('beforeinput', prepare)
    return () => node.removeEventListener('beforeinput', prepare)
  }, [])
  const Icon = side === 'right' ? GitCommitHorizontal : GitCommitVertical
  useEffect(() => {
    if (!open) return
    function check() {
      const node = trigger.current, rect = node?.getBoundingClientRect()
      const clip = node?.closest('[data-slot="module-controls"],[data-slot="app-header"]')?.getBoundingClientRect()
      if (disabled || !rect || rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight ||
        (clip && (rect.right <= clip.left || rect.left >= clip.right || rect.bottom <= clip.top || rect.top >= clip.bottom))) setOpen(false)
    }
    let frame: number
    function track() { check(); frame = requestAnimationFrame(track) }
    frame = requestAnimationFrame(track)
    document.addEventListener('scroll', check, true)
    window.addEventListener('resize', check)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('scroll', check, true); window.removeEventListener('resize', check) }
  }, [open, disabled, scale])
  function commit() {
    if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) {
      onChange(Math.min(VIEWPORT_ZOOM_MAX, Math.max(VIEWPORT_ZOOM_MIN, Number(draft) / 100)))
    }
    setDraft(null)
    replaceInput.current = true
  }
  const percentage = <>
    <Input ref={input} id={inputId} data-slot="zoom-input" className={styles.input} type="number" inputMode="decimal" aria-label={label} min={VIEWPORT_ZOOM_MIN * 100} max={VIEWPORT_ZOOM_MAX * 100} step={1}
      disabled={disabled} value={draft ?? percent}
      onFocus={() => { replaceInput.current = true }} onPointerDown={() => { replaceInput.current = true }}
      onChange={event => { replaceInput.current = false; setDraft(event.target.value) }} onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          const value = draft !== null && draft.trim() && Number.isFinite(Number(draft)) ? Number(draft) : percent
          const next = value + (event.key === 'ArrowUp' ? step : -step)
          setDraft(null); replaceInput.current = true
          onChange(Math.min(VIEWPORT_ZOOM_MAX, Math.max(VIEWPORT_ZOOM_MIN, next / 100)))
        }
        if (event.key === 'Enter') { event.preventDefault(); commit() }
        if (event.key === 'Escape') { event.preventDefault(); setDraft(null); replaceInput.current = true }
      }} /><span aria-hidden="true">%</span>
  </>
  return <div data-slot="zoom-control" className={`${styles.base} technical-data`}>
    {side !== 'right' && percentage}
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button ref={trigger} className={controlStyles.base} disabled={disabled}
        aria-label={`Abrir deslizador: ${label}`}><Icon aria-hidden="true" /></Button></PopoverTrigger>
      <PopoverContent side={side} aria-label={label}
        onPointerDownCapture={() => { sliderPointer.current = true }}
        onPointerUpCapture={() => { sliderPointer.current = false }}
        onPointerCancelCapture={() => { sliderPointer.current = false }}
        onKeyDownCapture={() => { sliderPointer.current = false }} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
        <div className={labelStyles.base}><output>{percent}%</output></div>
        <Slider label={label} value={percent} min={VIEWPORT_ZOOM_MIN * 100} max={VIEWPORT_ZOOM_MAX * 100} step={step} stepOrigin={100} midpoint={100} disabled={disabled} onValueChange={value => {
          const nearest = Math.round(value / 10) * 10
          const percent = step === ZOOM_STEP_DEFAULT && sliderPointer.current && Math.abs(value - nearest) <= 2 ? nearest : value
          setDraft(null); onChange(percent / 100)
        }} />
      </PopoverContent>
    </Popover>
    {side === 'right' && percentage}
  </div>
}
