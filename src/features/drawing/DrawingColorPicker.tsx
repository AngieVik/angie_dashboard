import { useId, useRef, useState, type PointerEvent } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import styles from './colorPicker.module.css'

interface HSV { h: number; s: number; v: number }
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const colors = ['#FFFFFF', '#292C32', '#D63A3A', '#F58A24', '#FFD644', '#4BB86A', '#37B8CD', '#377FE6', '#8756D8', '#DA4E97']
function parseHex(value: string) {
  let raw = value.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(raw)) raw = [...raw].map(c => c + c).join('')
  return /^[0-9a-f]{6}$/i.test(raw) ? '#' + raw.toUpperCase() : null
}
function fromHex(hex: string, fallbackHue: number): HSV {
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i + 1, i + 3), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
  const sector = max === r ? (g - b) : max === g ? b - r + 2 * d : r - g + 4 * d
  return { h: d ? (360 + sector / d * 60) % 360 : fallbackHue, s: max ? d / max : 0, v: max }
}
function toHex({ h, s, v }: HSV) {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6
    return Math.round(255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)))).toString(16).padStart(2, '0')
  }
  return ('#' + channel(5) + channel(3) + channel(1)).toUpperCase()
}
export function DrawingColorPicker({ value, disabled, apply }: { value: string; disabled: boolean; apply: (color: string) => void }) {
  const id = useId(), pointer = useRef<number | null>(null)
  const original = parseHex(value) ?? '#000000'
  const [hsv, setHSV] = useState(() => fromHex(original, 0))
  const [hex, setHex] = useState(original)
  const current = toHex(hsv), valid = parseHex(hex)
  function change(next: HSV) { setHSV(next); setHex(toHex(next)) }
  function pick(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width && rect.height) change({ ...hsv, s: clamp((event.clientX - rect.left) / rect.width), v: clamp(1 - (event.clientY - rect.top) / rect.height) })
  }
  return <div className={styles.picker}>
    <div className={styles.plane} style={{ backgroundColor: 'hsl(' + hsv.h + ' 100% 50%)' }} tabIndex={disabled ? -1 : 0}
      role="group" aria-label="Saturación y brillo" aria-describedby={id} onPointerDown={e => {
        if (disabled || !e.isPrimary || e.button !== 0) return
        pointer.current = e.pointerId; e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); pick(e)
      }} onPointerMove={e => { if (pointer.current === e.pointerId) pick(e) }} onPointerUp={e => {
        if (pointer.current === e.pointerId) { pick(e); pointer.current = null }
      }} onLostPointerCapture={() => { pointer.current = null }} onKeyDown={e => {
        if (disabled || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return
        e.preventDefault(); const step = e.shiftKey ? .1 : .01
        change({ ...hsv, s: clamp(hsv.s + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0)),
          v: clamp(hsv.v + (e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0)) })
      }}>
      <span className={styles.reticle} style={{ left: hsv.s * 100 + '%', top: (1 - hsv.v) * 100 + '%', backgroundColor: current }} />
    </div>
    <span className={styles.sr} id={id}>Izquierda y derecha ajustan la saturación. Arriba y abajo ajustan el brillo.</span>
    <label className={styles.hue}>Tono<input type="range" min={0} max={360} value={hsv.h} aria-valuetext={Math.round(hsv.h) + ' grados'} disabled={disabled}
      onChange={e => change({ ...hsv, h: Number(e.target.value) })} /></label>
    <div className={styles.swatches} role="group" aria-label="Colores rápidos">{colors.map(color =>
      <button type="button" key={color} aria-label={color} title={color} disabled={disabled} aria-pressed={current === color}
        style={{ backgroundColor: color }} onClick={() => change(fromHex(color, hsv.h))}>{current === color && <Check size={14} />}</button>)}</div>
    <div className={styles.footer}>
      <span className={styles.sample} title="Color anterior y nuevo" style={{ background: 'linear-gradient(90deg,' + original + ' 50%,' + current + ' 50%)' }} />
      <label>HEX<Input value={hex} maxLength={7} spellCheck={false} aria-invalid={!valid} disabled={disabled} onChange={e => {
        const raw = e.target.value, parsed = parseHex(raw); setHex(raw); if (parsed) setHSV(fromHex(parsed, hsv.h))
      }} onKeyDown={e => { if (e.key === 'Enter' && valid) { e.preventDefault(); apply(valid) } }} /></label>
      <Button disabled={disabled || !valid} onClick={() => valid && apply(valid)}>Aplicar</Button>
    </div>
  </div>
}
