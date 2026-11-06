import type { ModuleSizeMode } from './moduleRegistry'
import { moduleAutoHeightLimit, moduleBaseSize, MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId, Size } from './layoutTypes'

function contentHeightLimit(content: HTMLElement, limit: number): number {
  // The pin editor must include its preview; the list's automatic cap would crop it.
  return content.querySelector('.element-editor') ? Infinity : limit
}

function holdTimelineViewport(content: HTMLElement) {
  const viewport = content.querySelector<HTMLElement>('.timeline-entries:not([hidden])')
  const height = viewport?.offsetHeight ?? 0
  const previousHeight = content.style.getPropertyValue('--timeline-measure-height')
  // Expanding the live scrollport for measurement clamps scrollTop to zero.
  // Keep its box intact and count the full list separately instead.
  if (viewport && height > 0) {
    content.style.setProperty('--timeline-measure-height', `${height}px`)
  }
  return {
    contentHeight: () => content.scrollHeight + (viewport && height > 0
      ? (viewport.firstElementChild?.scrollHeight ?? 0) - viewport.clientHeight : 0),
    restore: () => {
      if (previousHeight) content.style.setProperty('--timeline-measure-height', previousHeight)
      else content.style.removeProperty('--timeline-measure-height')
    },
  }
}

export function syncCalendarAgendaLayout(calendar: HTMLElement) {
  const layout = calendar.querySelector<HTMLElement>('[data-slot="calendar-layout"]')
  if (!layout) return
  // Try the CSS side layout at its intrinsic widths before deciding whether it fits.
  calendar.removeAttribute('data-agenda-overflow')
  const position = getComputedStyle(layout).getPropertyValue('--calendar-agenda-position').trim()
  calendar.toggleAttribute('data-agenda-overflow', position === 'right' && layout.scrollWidth > layout.clientWidth)
}

function holdCalendarLayout(frame: HTMLElement, content: HTMLElement) {
  const calendar = content.querySelector<HTMLElement>('[data-slot="calendar-module"]')
  const layout = calendar?.querySelector<HTMLElement>('[data-slot="calendar-layout"]')
  if (!calendar || !layout) return null
  const previousPosition = calendar.getAttribute('data-measured-agenda')
  const previousOverflow = calendar.hasAttribute('data-agenda-overflow')
  return {
    update: (size: Size) => {
      const width = frame.style.width, height = frame.style.height
      const measuring = content.getAttribute('data-measuring')
      let position: string
      try {
        // Let the owning container query choose the layout at the requested size.
        // Freeze that choice while intrinsic measurement releases the content height.
        content.removeAttribute('data-measuring')
        frame.style.width = size.width + 'px'; frame.style.height = size.height + 'px'
        syncCalendarAgendaLayout(calendar)
        position = getComputedStyle(layout).getPropertyValue('--calendar-agenda-position').trim() || 'below'
      } finally {
        frame.style.width = width; frame.style.height = height
        if (measuring === null) content.removeAttribute('data-measuring')
        else content.setAttribute('data-measuring', measuring)
      }
      const changed = calendar.getAttribute('data-measured-agenda') !== position
      calendar.setAttribute('data-measured-agenda', position)
      return changed
    },
    restore: () => {
      if (previousPosition === null) calendar.removeAttribute('data-measured-agenda')
      else calendar.setAttribute('data-measured-agenda', previousPosition)
      calendar.toggleAttribute('data-agenda-overflow', previousOverflow)
    },
  }
}

export function measureModuleBaseSize(frame: HTMLElement | null, id: ModuleId): Size {
  const size = moduleBaseSize(id)
  if (!frame) return size
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
  const timeline = holdTimelineViewport(body)
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
    return { width: size.width, height: Math.min(contentHeightLimit(body, moduleAutoHeightLimit(id)), Math.max(size.height, Math.ceil(timeline.contentHeight() + chrome))) }
  } finally {
    frame.style.width = width; frame.style.height = height
    if (collapsed === null) frame.removeAttribute('data-collapsed'); else frame.setAttribute('data-collapsed', collapsed)
    if (iconOnly === null) frame.removeAttribute('data-icon-only'); else frame.setAttribute('data-icon-only', iconOnly)
    if (measuring === null) body.removeAttribute('data-measuring'); else body.setAttribute('data-measuring', measuring)
    if (clockSizing == null) clock?.removeAttribute('data-sizing'); else clock?.setAttribute('data-sizing', clockSizing)
    content.hidden = contentHidden
    if (controls) controls.hidden = controlsHidden ?? false
    timeline.restore()
    for (const { node, top, left } of scrolls) { node.scrollTop = top; node.scrollLeft = left }
  }
}

export function constrainWindowContentSize(frame: HTMLElement | null | undefined, size: Size, sizeMode: ModuleSizeMode = 'standard', minimumHeightLimit = Infinity): Size {
  if (!frame) return size
  let w = size.width
  const h = size.height
  const content = frame.querySelector<HTMLElement>('.module-scaled-content')
  if (!content) return size
  const heightLimit = contentHeightLimit(content, minimumHeightLimit)
  const measuring = content.getAttribute('data-measuring'), width = content.style.width
  const clock = content.querySelector<HTMLElement>('.clock-module'), clockSizing = clock?.getAttribute('data-sizing')
  const header = frame.querySelector<HTMLElement>('.module-header')
  const scrollbar = frame.querySelector<HTMLElement>('.module-content')
  const scrollbarWidth = scrollbar ? scrollbar.offsetWidth - scrollbar.clientWidth : 0
  const scrolls = [frame, ...frame.querySelectorAll<HTMLElement>('*')]
    .filter(node => node.scrollTop || node.scrollLeft)
    .map(node => ({ node, top: node.scrollTop, left: node.scrollLeft }))
  const timeline = holdTimelineViewport(content)
  const calendar = holdCalendarLayout(frame, content)
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
    calendar?.update({ width: w, height: h })
    let minimumHeight = timeline.contentHeight()
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
    if (!Number.isFinite(heightLimit) && (sizeMode === 'editable' || sizeMode === 'feed')) {
      const viewport = content.querySelector<HTMLElement>('.elements-list,.information-module,.timeline-entries,.notebook-list,.timer-list')
      const row = viewport?.querySelector<HTMLElement>('.element-row,.information-card,.timeline-entries li,.notebook-block,.timer-row')
      if (viewport && row && !clock) {
        const style = getComputedStyle(viewport), rowStyle = getComputedStyle(row)
        const firstRowHeight = row.offsetHeight + (parseFloat(rowStyle.marginTop) || 0) + (parseFloat(rowStyle.marginBottom) || 0)
          + (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
          + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
        const viewportHeight = viewport.classList.contains('timeline-entries')
          ? viewport.firstElementChild?.scrollHeight ?? viewport.offsetHeight : viewport.offsetHeight
        minimumHeight -= Math.max(0, viewportHeight - firstRowHeight)
      }
      minimumHeight = Math.ceil(minimumHeight + chrome)
    } else minimumHeight = Math.ceil(minimumHeight + chrome)
    let height = Math.max(h, Math.min(heightLimit, minimumHeight))
    // A taller content minimum can move Calendar's complete agenda from right to below.
    if (calendar?.update({ width: w, height })) {
      height = Math.max(h, Math.min(heightLimit, Math.ceil(timeline.contentHeight() + chrome)))
    }
    return { width: w, height }
  } finally {
    if (measuring === null) content.removeAttribute('data-measuring')
    else content.setAttribute('data-measuring', measuring)
    content.style.width = width
    calendar?.restore()
    if (clockSizing == null) clock?.removeAttribute('data-sizing')
    else clock?.setAttribute('data-sizing', clockSizing)
    timeline.restore()
    for (const { node, top, left } of scrolls) { node.scrollTop = top; node.scrollLeft = left }
  }
}

export function measureModuleAutoSize(frame: HTMLElement, id?: ModuleId): Size {
  const minimum = id ? moduleBaseSize(id) : { width: 27, height: 30 }
  const sizeMode = id ? MODULE_REGISTRY[id].sizeMode : 'specific'
  return constrainWindowContentSize(frame, minimum, sizeMode, moduleAutoHeightLimit(id))
}
