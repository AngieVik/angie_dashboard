import { useEffect, useRef } from 'react'
import type { ComponentProps } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import '@/styles/integrations/calendar.css'
import styles from './calendar.module.css'

export function CalendarDayButton({ day, modifiers, className = '', ...props }: ComponentProps<typeof import('react-day-picker').DayButton>) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (modifiers.focused) ref.current?.focus() }, [modifiers.focused])
  return <Button {...props} ref={ref} appearance="integrated" variant="text" className={`${className} ${styles.day}`}
    data-day={day.date.toISOString()} />
}

function CalendarChevron({ orientation = 'left', className }: ComponentProps<typeof import('react-day-picker').Chevron>) {
  const Icon = orientation === 'right' ? ChevronRight : orientation === 'down' ? ChevronDown : orientation === 'up' ? ChevronUp : ChevronLeft
  return <Icon className={className} aria-hidden="true" />
}

export function Calendar({ className = '', locale = es, showOutsideDays = true, components, ...props }: ComponentProps<typeof DayPicker>) {
  return <DayPicker {...props} locale={locale} showOutsideDays={showOutsideDays} className={`${styles.base} ${className}`}
    components={{ DayButton: CalendarDayButton, Chevron: CalendarChevron, ...components }} />
}
