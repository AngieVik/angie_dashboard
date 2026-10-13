import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Input } from '../../components/ui/input'

const digitPositions = [0, 1, 3, 4, 6, 7] as const
type DurationEdit = { value: string; caret: number }

function maskedDuration(digits: string) {
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}`
}

function editDuration(value: string, start: number, end: number, text: string, deletion?: 'backward' | 'forward'): DurationEdit {
  const digits = value.replace(/\D/g, '').padStart(6, '0').slice(-6).split('')
  let slot = digitPositions.findIndex(position => position >= start)
  if (slot < 0) slot = 6
  if (end > start) {
    digitPositions.forEach((position, index) => { if (position >= start && position < end) digits[index] = '0' })
  } else if (deletion) {
    if (deletion === 'backward') slot = digitPositions.findLastIndex(position => position < start)
    if (slot >= 0 && slot < 6) digits[slot] = '0'
    return { value: maskedDuration(digits.join('')), caret: deletion === 'backward' && slot >= 0 ? digitPositions[slot]! : start }
  }
  if (deletion) return { value: maskedDuration(digits.join('')), caret: start }
  for (const digit of text.replace(/\D/g, '').slice(-6)) {
    if (slot < 6) digits[slot++] = digit
    else { digits.shift(); digits.push(digit) }
  }
  return { value: maskedDuration(digits.join('')), caret: digitPositions[slot] ?? 8 }
}

export function DurationInput({ value, disabled, onChange, onBlur }: {
  value: string; disabled: boolean; onChange: (value: string) => void; onBlur: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [selection, setSelection] = useState<{ caret: number } | null>(null)
  const commit = useCallback((edit: DurationEdit) => {
    onChange(edit.value)
    // A repeated digit still advances the caret even when the text is unchanged.
    setSelection({ caret: edit.caret })
  }, [onChange])
  useLayoutEffect(() => {
    if (selection && input.current === document.activeElement) input.current?.setSelectionRange(selection.caret, selection.caret)
  }, [selection])
  useEffect(() => {
    const node = input.current
    if (!node) return
    // Native beforeinput also covers mobile keyboards that do not send digit keydowns.
    function beforeInput(event: InputEvent) {
      if (!event.cancelable || event.isComposing || node!.disabled) return
      const start = node!.selectionStart ?? 8, end = node!.selectionEnd ?? start
      if (event.inputType === 'insertText' || event.inputType === 'insertReplacementText') {
        if (event.data === null) return
        event.preventDefault()
        if (/^[0-9:\s]+$/.test(event.data) && /[0-9]/.test(event.data)) commit(editDuration(value, start, end, event.data))
      } else if (['deleteContentBackward', 'deleteContentForward', 'deleteByCut'].includes(event.inputType)) {
        event.preventDefault()
        commit(editDuration(value, start, end, '', event.inputType === 'deleteContentBackward' ? 'backward' : 'forward'))
      }
    }
    node.addEventListener('beforeinput', beforeInput)
    return () => node.removeEventListener('beforeinput', beforeInput)
  }, [value, commit])
  return <Input ref={input} aria-label="Duración inicial" title="Duración inicial (hh:mm:ss)"
    className="technical-data timer-duration" inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="00:00:00"
    disabled={disabled} value={value} onBlur={onBlur}
    onKeyDown={event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return
      const start = event.currentTarget.selectionStart ?? 8, end = event.currentTarget.selectionEnd ?? start
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault(); commit(editDuration(value, start, end, event.key))
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault(); commit(editDuration(value, start, end, '', event.key === 'Backspace' ? 'backward' : 'forward'))
      }
    }}
    onPaste={event => {
      event.preventDefault()
      const text = event.clipboardData.getData('text')
      if (!/^[0-9:\s]+$/.test(text) || !/[0-9]/.test(text)) return
      const start = event.currentTarget.selectionStart ?? 8, end = event.currentTarget.selectionEnd ?? start
      commit(editDuration(value, start, end, text))
    }}
    onChange={event => {
      const text = event.currentTarget.value
      if (!/^[0-9:]*$/.test(text)) return
      const native = event.nativeEvent as InputEvent
      const caret = event.currentTarget.selectionStart ?? text.length
      if (native.inputType?.startsWith('insert') && native.data) {
        // Some virtual keyboards produce non-cancelable beforeinput events.
        const start = Math.max(0, caret - native.data.length)
        const removed = Math.max(0, value.length + native.data.length - text.length)
        commit(editDuration(value, start, start + removed, native.data))
      } else {
        const digits = text.replace(/\D/g, '').padStart(6, '0').slice(-6)
        const slot = Math.min(6, text.slice(0, caret).replace(/\D/g, '').length)
        commit({ value: maskedDuration(digits), caret: digitPositions[slot] ?? 8 })
      }
    }} />
}
