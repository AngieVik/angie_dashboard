import type { ModuleSizeMode } from './moduleRegistry'
import { moduleAutoHeightLimit, moduleBaseSize, MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId, Size } from './layoutTypes'

export function measureModuleBaseSize(frame: HTMLElement | null, id: ModuleId): Size {
  const size = moduleBaseSize(id)
  if (!frame || MODULE_REGISTRY[id].baseHeight === 'fixed') return size
  const content = frame.querySelector<HTMLElement>('.module-content')
  const body = frame.querySelector<HTMLElement>('.module-scaled-content')
  const controls = frame.querySelector<HTMLElement>('.module-controls')
  if (!content || !body) return size
  const width = frame.style.width, height = frame.style.height
  const collapsed = frame.getAttribute('data-collapsed'), iconOnly = frame.getAttribute('data-icon-only')
  const measuring = body.getAttribute('data-measuring')
  const clock = body.querySelector<HTMLElement>('.clock-module'), clockSizing = clock?.getAttribute('data-sizing')
  const contentHidden = content.hidden, controlsHidden = controls?.hidden
  const scrolls = [frame, ...frame.querySelectorAll<HTMLElement>('*')]
    .filter(node => node.scrollTop || node.scrollLeft)
    .map(node => ({ node, top: node.scrollTop, left: node.scrollLeft }))
  try {
    frame.style.width = size.width + 'px'; frame.style.height = 'auto'
    frame.setAttribute('data-collapsed', 'false'); frame.setAttribute('data-icon-only', 'false')
    content.hidden = false
    if (controls) controls.hidden = false
    body.setAttribute('data-measuring', 'true')
    clock?.setAttribute('data-sizing', 'true')
    const style = getComputedStyle(frame)
    const chrome = (frame.querySelector<HTMLElement>('.module-header')?.offsetHeight ?? 27)
      + (controls?.offsetHeight ?? 25) + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
    return { width: size.width, height: Math.min(moduleAutoHeightLimit(id), Math.max(size.height, Math.ceil(body.scrollHeight + chrome))) }
  } finally {
    frame.style.width = width; frame.style.height = height
    if (collapsed === null) frame.removeAttribute('data-collapsed'); else frame.setAttribute('data-collapsed', collapsed)
    if (iconOnly === null) frame.removeAttribute('data-icon-only'); else frame.setAttribute('data-icon-only', iconOnly)
    if (measuring === null) body.removeAttribute('data-measuring'); else body.setAttribute('data-measuring', measuring)
    if (clockSizing == null) clock?.removeAttribute('data-sizing'); else clock?.setAttribute('data-sizing', clockSizing)
    content.hidden = contentHidden
    if (controls) controls.hidden = controlsHidden ?? false
    for (const { node, top, left } of scrolls) { node.scrollTop = top; node.scrollLeft = left }
  }
}

export function constrainWindowContentSize(frame: HTMLElement | null | undefined, size: Size, sizeMode: ModuleSizeMode = 'standard', minimumHeightLimit = Infinity): Size {
  if (!frame) return size
  let w = size.width
  const h = size.height
  const content = frame.querySelector<HTMLElement>('.module-scaled-content')
  if (!content) return size
  const measuring = content.getAttribute('data-measuring'), width = content.style.width
  const clock = content.querySelector<HTMLElement>('.clock-module'), clockSizing = clock?.getAttribute('data-sizing')
  const header = frame.querySelector<HTMLElement>('.module-header')
  const scrollbar = frame.querySelector<HTMLElement>('.module-content')
  const scrollbarWidth = scrollbar ? scrollbar.offsetWidth - scrollbar.clientWidth : 0
  const scrolls = [frame, ...frame.querySelectorAll<HTMLElement>('*')]
    .filter(node => node.scrollTop || node.scrollLeft)
    .map(node => ({ node, top: node.scrollTop, left: node.scrollLeft }))
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
    // Long forms can scroll; their first control block defines the minimum viewport.
    const scrollContent = content.querySelector<HTMLElement>('[data-minimum-scroll-content]')
    const firstBlock = scrollContent?.firstElementChild
    if (scrollContent && firstBlock instanceof HTMLElement) {
      const style = getComputedStyle(scrollContent), blockStyle = getComputedStyle(firstBlock)
      const firstBlockHeight = firstBlock.offsetHeight
        + (parseFloat(blockStyle.marginTop) || 0) + (parseFloat(blockStyle.marginBottom) || 0)
        + (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
      minimumHeight += firstBlockHeight - scrollContent.offsetHeight
    }
    if (!Number.isFinite(minimumHeightLimit) && (sizeMode === 'editable' || sizeMode === 'feed')) {
      const viewport = content.querySelector<HTMLElement>('.elements-list,.information-module,.timeline-entries,.notebook-list,.timer-list')
      const row = viewport?.querySelector<HTMLElement>('.element-row,.information-card,.timeline-entries li,.notebook-block,.timer-row')
      if (viewport && row && !clock) {
        const style = getComputedStyle(viewport), rowStyle = getComputedStyle(row)
        const firstRowHeight = row.offsetHeight + (parseFloat(rowStyle.marginTop) || 0) + (parseFloat(rowStyle.marginBottom) || 0)
          + (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
          + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
        minimumHeight -= Math.max(0, viewport.offsetHeight - firstRowHeight)
      }
      minimumHeight = Math.ceil(minimumHeight + chrome)
    } else minimumHeight = Math.ceil(minimumHeight + chrome)
    return { width: w, height: Math.max(h, Math.min(minimumHeightLimit, minimumHeight)) }
  } finally {
    if (measuring === null) content.removeAttribute('data-measuring')
    else content.setAttribute('data-measuring', measuring)
    content.style.width = width
    if (clockSizing == null) clock?.removeAttribute('data-sizing')
    else clock?.setAttribute('data-sizing', clockSizing)
    for (const { node, top, left } of scrolls) { node.scrollTop = top; node.scrollLeft = left }
  }
}
