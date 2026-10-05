import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, ReactElement } from 'react'
import * as Primitive from '@radix-ui/react-tooltip'
import { useViewportInteraction } from '../../layout/ViewportContext'

export const TooltipProvider = Primitive.Provider
export const Tooltip = Primitive.Root
export const TooltipTrigger = Primitive.Trigger
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
  function cancel() { clearTimeout(timer.current); hold.current = null }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const close = () => { clearTimeout(timer.current); hold.current = null; setOpen(false) }
    const pointerDown = (event: PointerEvent) => {
      if (hold.current?.pointer === event.pointerId) return
      close()
    }
    document.addEventListener('pointerdown', pointerDown)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', pointerDown); document.removeEventListener('keydown', close) }
  }, [])
  return <Tooltip open={open} onOpenChange={setOpen}><TooltipTrigger asChild
    onPointerDownCapture={event => {
      if (event.pointerType !== 'touch' || blockedRef.current) return
      if (hold.current || !event.isPrimary) { cancel(); setOpen(false); return }
      consulted.current = false
      hold.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY }
      timer.current = setTimeout(() => { if (!blockedRef.current && hold.current) { consulted.current = true; setOpen(true) } }, 500)
    }}
    onPointerMoveCapture={event => {
      if (hold.current && (blockedRef.current || Math.hypot(event.clientX - hold.current.x, event.clientY - hold.current.y) > 8)) { cancel(); setOpen(false) }
    }}
    onPointerUpCapture={cancel}
    onPointerCancelCapture={() => { cancel(); setOpen(false) }}
    onClickCapture={event => {
      if (consulted.current) { event.preventDefault(); event.stopPropagation(); consulted.current = false; return }
    }}
  >{children}</TooltipTrigger><TooltipContent>{text}</TooltipContent></Tooltip>
}
