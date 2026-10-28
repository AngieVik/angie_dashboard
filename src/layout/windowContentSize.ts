import { MODULE_AUTO_HEIGHT_LIMIT } from './moduleRegistry'
import type { Size } from './layoutTypes'

export function constrainWindowContentSize(frame: HTMLElement | null | undefined, size: Size, sizeMode: 'standard' | 'editable' | 'feed' = 'standard'): Size {
  if (!frame) return size
  let w = size.width
  const h = size.height
  const content = frame.querySelector<HTMLElement>('.module-scaled-content')
  if (!content) return size
  const measuring = content.getAttribute('data-measuring'), width = content.style.width
  const clock = content.querySelector<HTMLElement>('.clock-module'), clockSizing = clock?.getAttribute('data-sizing')
  const elements = content.querySelector<HTMLElement>('.elements-module')
  const header = frame.querySelector<HTMLElement>('.module-header')
  const scrollbar = frame.querySelector<HTMLElement>('.module-content')
  const scrollbarWidth = scrollbar ? scrollbar.offsetWidth - scrollbar.clientWidth : 0
  try {
    clock?.setAttribute('data-sizing', 'true')
    content.setAttribute('data-measuring', 'minimum-width')
    let headerWidth = 0
    if (header) {
      const style = getComputedStyle(header)
      headerWidth = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
        + (parseFloat(style.columnGap) || 0) * Math.max(0, header.children.length - 1)
      for (const child of Array.from(header.children)) {
        if (!(child instanceof HTMLElement)) continue
        const childStyle = getComputedStyle(child)
        headerWidth += (child.tagName === 'H2' ? 0 : child.offsetWidth)
          + (parseFloat(childStyle.marginLeft) || 0) + (parseFloat(childStyle.marginRight) || 0)
      }
    }
    w = Math.max(w, Math.ceil(Math.max(content.scrollWidth + scrollbarWidth, headerWidth) + 2))
    content.setAttribute('data-measuring', 'true'); content.style.width = Math.max(0, w - 2 - scrollbarWidth) + 'px'
    const chrome = (header?.offsetHeight ?? 27)
      + (frame.querySelector<HTMLElement>('.module-controls')?.offsetHeight ?? 25) + 2
    let minimumHeight = content.scrollHeight
    if ((sizeMode === 'editable' || sizeMode === 'feed') && !elements) {
      const viewport = content.querySelector<HTMLElement>('.information-module,.timeline-entries,.notebook-list,.timer-list')
      const row = viewport?.querySelector<HTMLElement>('.information-card,.timeline-entries li,.notebook-block,.timer-row')
      if (viewport && row && !clock) {
        const style = getComputedStyle(viewport), rowStyle = getComputedStyle(row)
        const firstRowHeight = row.offsetHeight + (parseFloat(rowStyle.marginTop) || 0) + (parseFloat(rowStyle.marginBottom) || 0)
          + (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
          + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
        minimumHeight -= Math.max(0, viewport.offsetHeight - firstRowHeight)
      }
      minimumHeight = clock ? Math.ceil(minimumHeight + chrome) : Math.min(MODULE_AUTO_HEIGHT_LIMIT, Math.ceil(minimumHeight + chrome))
    } else minimumHeight = Math.ceil(minimumHeight + chrome)
    return { width: w, height: Math.max(h, minimumHeight) }
  } finally {
    if (measuring === null) content.removeAttribute('data-measuring')
    else content.setAttribute('data-measuring', measuring)
    content.style.width = width
    if (clockSizing == null) clock?.removeAttribute('data-sizing')
    else clock?.setAttribute('data-sizing', clockSizing)
  }
}
