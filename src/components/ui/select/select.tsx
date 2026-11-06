import { useRef, useState } from 'react'
import type { ComponentProps, CSSProperties } from 'react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'
import styles from './select.module.css'

export type SelectOption = { value: string; label: string; disabled?: boolean }

// DropdownMenu owns choice navigation; local styles specialize the selector list.
export function Select({ value, onValueChange, options, className = '', disabled, ...props }: Omit<ComponentProps<'button'>, 'value' | 'onChange' | 'children' | 'ref'> & {
  value: string; onValueChange: (value: string) => void; options: readonly SelectOption[]
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [font, setFont] = useState<CSSProperties>()
  // Reset before committing the disabled trigger, including its closed menu.
  if (disabled && open) setOpen(false)
  return <DropdownMenu open={open && !disabled} onOpenChange={next => {
    if (next && trigger.current) {
      const computed = getComputedStyle(trigger.current)
      setFont({ fontSize: computed.fontSize, fontFamily: computed.fontFamily, '--select-row-height': computed.height } as CSSProperties)
    }
    setOpen(next)
  }}>
    <DropdownMenuTrigger asChild><button ref={trigger} data-slot="select" type="button" disabled={disabled} className={`${styles.base} ${className}`.trim()} {...props}>
      <span className={styles.value}>{options.find(option => option.value === value)?.label ?? value}</span>
      <svg className={styles.arrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button></DropdownMenuTrigger>
    <DropdownMenuContent className={styles.options} style={font}>
      <DropdownMenuGroup>
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map(option => <DropdownMenuRadioItem className={styles.option} key={option.value} value={option.value} textValue={option.label} disabled={option.disabled}>
            <span className={styles.optionLabel}>{option.label}</span>
          </DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
}
