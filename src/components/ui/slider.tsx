import * as Primitive from '@radix-ui/react-slider'

export function Slider({ value, onValueChange, min, max, step = 1, label, disabled = false, midpoint }: {
  value: number; onValueChange: (value: number) => void; min: number; max: number; step?: number; label: string; disabled?: boolean; midpoint?: number
}) {
  const centered = midpoint !== undefined && midpoint > min && midpoint < max
  const position = centered ? value <= midpoint ? (value - min) / (midpoint - min) * 50 : 50 + (value - midpoint) / (max - midpoint) * 50 : value
  function change(position: number) {
    const value = centered ? position <= 50 ? min + position / 50 * (midpoint - min) : midpoint + (position - 50) / 50 * (max - midpoint) : position
    onValueChange(centered ? Math.min(max, Math.max(min, min + Math.round((value - min) / step) * step)) : value)
  }
  return <Primitive.Root className="ui-slider" value={[position]} onValueChange={values => change(values[0]!)}
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
    <Primitive.Track className="ui-slider-track"><Primitive.Range className="ui-slider-range" /></Primitive.Track>
    <Primitive.Thumb className="ui-slider-thumb" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} />
  </Primitive.Root>
}
