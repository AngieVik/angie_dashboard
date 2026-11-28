import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { CaretsToAxisDashedHorizontal, CaretsToAxisDashedVertical, type LucideIcon } from 'lucide-react'

// Native cursors drawn from Lucide icons, so they come from the installed dependency like every other icon.
// A cursor is an image and can't read CSS variables, so the colours are taken from the tokens once:
// a light line in --color-selection-guide with a dark border in --color-selection-guide-outline, like the system pointer.
const cursors: [name: string, icon: LucideIcon, fallback: string][] = [
  // Selection axes: the X axis flips vertically and the Y axis flips horizontally.
  ['--cursor-flip-vertical', CaretsToAxisDashedHorizontal, 'ns-resize'],
  ['--cursor-flip-horizontal', CaretsToAxisDashedVertical, 'ew-resize'],
]

function iconPaths(icon: LucideIcon) {
  const host = document.createElement('div'), root = createRoot(host)
  flushSync(() => root.render(createElement(icon)))
  const paths = host.querySelector('svg')?.innerHTML ?? ''
  root.unmount()
  return paths
}

export function installIconCursors() {
  const style = getComputedStyle(document.documentElement)
  const line = style.getPropertyValue('--color-selection-guide').trim(), halo = style.getPropertyValue('--color-selection-guide-outline').trim()
  for (const [name, icon, fallback] of cursors) {
    const paths = iconPaths(icon)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="-2 -2 28 28" fill="none" stroke-linecap="round" stroke-linejoin="round">`
      + `<g stroke="${halo}" stroke-width="4">${paths}</g><g stroke="${line}" stroke-width="2">${paths}</g></svg>`
    document.documentElement.style.setProperty(name, `url("data:image/svg+xml,${encodeURIComponent(svg)}") 14 14, ${fallback}`)
  }
}
