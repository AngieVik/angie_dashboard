import * as Primitive from '@radix-ui/react-slider'

export function Slider({ value, onValueChange, min, max, step = 1, label, disabled = false }: {
  value: number; onValueChange: (value: number) => void; min: number; max: number; step?: number; label: string; disabled?: boolean
}) {
  return <Primitive.Root className="ui-slider" value={[value]} onValueChange={values => onValueChange(values[0]!)}
    min={min} max={max} step={step} disabled={disabled}>
    <Primitive.Track className="ui-slider-track"><Primitive.Range className="ui-slider-range" /></Primitive.Track>
    <Primitive.Thumb className="ui-slider-thumb" aria-label={label} />
  </Primitive.Root>
}
