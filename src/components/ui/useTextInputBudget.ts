import { useRef } from 'react'
import type { ChangeEventHandler, ClipboardEventHandler } from 'react'
import { toast } from 'sonner'
import { budgetIssue, INPUT_BUDGETS } from '../../domain/input/inputBudgets'

export interface TextInputBudget { limit: number; path: string; onReject?: (message: string) => void }
type Field = HTMLInputElement | HTMLTextAreaElement

/** Reject a whole edit/paste, including drafts, before a consumer stores it. */
export function useTextInputBudget<T extends Field>({ value, defaultValue, maxLength, inputBudget, onChange, onPaste }: {
  value?: string | number | readonly string[]; defaultValue?: string | number | readonly string[]
  maxLength?: number; inputBudget?: TextInputBudget
  onChange?: ChangeEventHandler<T>; onPaste?: ClipboardEventHandler<T>
}) {
  const previous = useRef(String(value ?? defaultValue ?? ''))
  const limit = Math.min(INPUT_BUDGETS.textCharacters, inputBudget?.limit ?? Infinity, maxLength !== undefined && maxLength >= 0 ? maxLength : Infinity)
  function reject(length: number) {
    if (length <= limit) return false
    const message = budgetIssue(inputBudget?.path ?? 'Texto', limit, 'caracteres').message
    if (inputBudget?.onReject) inputBudget.onReject(message)
    else toast.error(message, { id: 'input-budget' })
    return true
  }
  return {
    onChange: ((event) => {
      if (reject(event.currentTarget.value.length)) {
        event.currentTarget.value = String(value ?? previous.current)
        return
      }
      previous.current = event.currentTarget.value
      onChange?.(event)
    }) as ChangeEventHandler<T>,
    onPaste: ((event) => {
      const field = event.currentTarget
      const pasted = event.clipboardData.getData('text/plain')
      const selected = (field.selectionEnd ?? field.value.length) - (field.selectionStart ?? 0)
      if (reject(field.value.length - selected + pasted.length)) { event.preventDefault(); return }
      onPaste?.(event)
    }) as ClipboardEventHandler<T>,
  }
}
