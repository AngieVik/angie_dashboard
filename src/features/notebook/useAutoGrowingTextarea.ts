import { useCallback, useLayoutEffect, useRef } from 'react'

export function useAutoGrowingTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const resize = useCallback(() => {
    const node = ref.current
    if (!node) return
    node.style.height = 'auto'
    const style = getComputedStyle(node)
    const borders = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
    node.style.height = `${node.scrollHeight + borders}px`
  }, [])
  useLayoutEffect(resize, [value, resize])
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    let width: number | undefined
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width
      // Height changes must not feed back into another resize.
      if (next !== undefined && next !== width) { width = next; resize() }
    })
    observer?.observe(node)
    let active = true
    const fonts = document.fonts
    void fonts?.ready.then(() => { if (active) resize() })
    fonts?.addEventListener('loadingdone', resize)
    return () => { active = false; observer?.disconnect(); fonts?.removeEventListener('loadingdone', resize) }
  }, [resize])
  return ref
}
