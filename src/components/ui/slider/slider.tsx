import * as Primitive from '@radix-ui/react-slider'
import styles from './slider.module.css'

export function Slider({ value, onValueChange, min, max, step = 1, label, disabled = false, midpoint, valueText, className = '' }: {
  value: number; onValueChange: (value: number) => void; min: number; max: number; step?: number; label: string; disabled?: boolean; midpoint?: number; valueText?: string; className?: string
}) {
  const centered = midpoint !== undefined && midpoint > min && midpoint < max
  const position = centered ? value <= midpoint ? (value - min) / (midpoint - min) * 50 : 50 + (value - midpoint) / (max - midpoint) * 50 : value
  function change(position: number) {
    const value = centered ? position <= 50 ? min + position / 50 * (midpoint - min) : midpoint + (position - 50) / 50 * (max - midpoint) : position
    onValueChange(centered ? Math.min(max, Math.max(min, min + Math.round((value - min) / step) * step)) : value)
  }
  return <Primitive.Root data-slot="slider" className={`${styles.base} ${className}`.trim()} value={[position]} onValueChange={values => change(values[0]!)}
    min={centered ? 0 : min} max={centered ? 100 : max} step={centered ? .01 : step} disabled={disabled}
    onKeyDownCapture={event => {
      if (!centered || disabled) return
      const increment = step * (event.shiftKey || event.key.startsWith('Page') ? 10 : 1)
      const next = event.key === 'Home' ? min : event.key === 'End' ? max
        : ['ArrowRight', 'ArrowUp', 'PageUp'].includes(event.key) ? value + increment
        : ['ArrowLeft', 'ArrowDown', 'PageDown'].includes(event.key) ? value - increment : null
      if (next === null) return
      event.preventDefault()
      onValueChange(Math.min(max, Math.max(min, next)))
    }}>
    <Primitive.Track data-slot="slider-track" className={styles.track}><Primitive.Range data-slot="slider-range" className={styles.range} /></Primitive.Track>
    <Primitive.Thumb data-slot="slider-thumb" className={styles.thumb} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText} />
  </Primitive.Root>
}
