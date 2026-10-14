import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, ReactElement } from 'react'
import * as Primitive from '@radix-ui/react-tooltip'
import { useViewportInteraction } from '../../layout/ViewportContext'

export const TooltipProvider = Primitive.Provider
export const Tooltip = Primitive.Root
export const TooltipTrigger = Primitive.Trigger
const HELP_TOOLTIP_OPEN = 'angie-help-tooltip-open'
export function TooltipContent({ className = '', ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Content className={`ui-tooltip ${className}`} sideOffset={5} collisionPadding={8}
    {...props} /></Primitive.Portal>
}

// A short tap keeps the button's action. Only a held consultation consumes its click.
export function HelpTooltip({ text, children }: { text: string; children: ReactElement<ComponentProps<'button'>> }) {
  const [open, setOpen] = useState(false)
  const { blockedRef } = useViewportInteraction()
  const hold = useRef<{ pointer: number; x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const consulted = useRef(false)
  const owner = useRef({})
  function cancel() { clearTimeout(timer.current); hold.current = null }
  function announce() { document.dispatchEvent(new CustomEvent(HELP_TOOLTIP_OPEN, { detail: owner.current })) }
  function changeOpen(next: boolean) {
    const visible = next && !blockedRef.current
    if (visible) announce()
    setOpen(visible)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const instance = owner.current
    const close = () => { clearTimeout(timer.current); hold.current = null; setOpen(false) }
    const otherHelp = (event: Event) => { if ((event as CustomEvent<object>).detail !== instance) close() }
    const pointerDown = (event: PointerEvent) => {
      if (hold.current?.pointer === event.pointerId) return
      close()
    }
    document.addEventListener(HELP_TOOLTIP_OPEN, otherHelp)
    document.addEventListener('pointerdown', pointerDown, true)
    document.addEventListener('keydown', close, true)
    return () => {
      document.removeEventListener(HELP_TOOLTIP_OPEN, otherHelp)
      document.removeEventListener('pointerdown', pointerDown, true)
      document.removeEventListener('keydown', close, true)
    }
  }, [])
  return <Tooltip open={open} onOpenChange={changeOpen} disableHoverableContent><TooltipTrigger asChild
    onPointerEnter={announce}
    onPointerLeave={() => { cancel(); setOpen(false) }}
    onBlur={() => { cancel(); setOpen(false) }}
    onPointerDownCapture={event => {
      if (event.pointerType !== 'touch' || blockedRef.current) return
      if (hold.current || !event.isPrimary) { cancel(); setOpen(false); return }
      consulted.current = false
      hold.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY }
      timer.current = setTimeout(() => { if (!blockedRef.current && hold.current) { consulted.current = true; changeOpen(true) } }, 800)
    }}
    onPointerMoveCapture={event => {
      if (hold.current && (blockedRef.current || Math.hypot(event.clientX - hold.current.x, event.clientY - hold.current.y) > 8)) { cancel(); setOpen(false) }
    }}
    onPointerUpCapture={() => { cancel(); setOpen(false) }}
    onPointerCancelCapture={() => { cancel(); setOpen(false) }}
    onClickCapture={event => {
      cancel(); setOpen(false)
      if (consulted.current) { event.preventDefault(); event.stopPropagation(); consulted.current = false; return }
    }}
  >{children}</TooltipTrigger><TooltipContent>{text}</TooltipContent></Tooltip>
}
