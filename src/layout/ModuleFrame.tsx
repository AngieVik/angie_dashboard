import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Proportions, X } from 'lucide-react'
import { HelpTooltip } from '../components/ui/tooltip'
import { Button } from '../components/ui/button'
import { MODULE_ICONS, MODULE_REGISTRY } from './moduleRegistry'
import type { ModuleId, Size } from './layoutTypes'
import { ZoomControl } from './ZoomControl'
import { useViewportInteraction } from './ViewportContext'


export function ModuleFrame({ id, active, onClose, onFit, children, generation = 0 }: { id: ModuleId; active: boolean; onClose: () => void; onFit?: (size: Size) => void; children?: ReactNode; generation?: number }) {
  const name = MODULE_REGISTRY[id].name
  const Icon = MODULE_ICONS[id]
  const [scale, setScale] = useState(1)
  const content = useRef<HTMLDivElement>(null)
  const { blocked, blockedRef } = useViewportInteraction()
  const frame = useRef<HTMLElement>(null)
  function fitContent() {
    const section = frame.current, scaled = content.current?.firstElementChild as HTMLElement | null
    if (blockedRef.current || !section || !scaled || !onFit) return
    const header = section.querySelector<HTMLElement>('.module-header')!, controls = section.querySelector<HTMLElement>('.module-controls')!
    const originalStyle = section.getAttribute('style')
    let size: Size = { width: section.offsetWidth, height: section.offsetHeight }
    try {
      // Resolve container-dependent fonts at the fitted size before saving once.
      for (let attempt = 0; attempt < 6; attempt++) {
        const globalScale = section.offsetWidth ? section.getBoundingClientRect().width / section.offsetWidth : 1
        const nodes = [scaled, ...scaled.querySelectorAll<HTMLElement>('*')]
        const snapshots = nodes.map(node => {
          const style = getComputedStyle(node)
          let textWidth: number | null = null
          if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement && ['text', 'search', ''].includes(node.type)) {
            const probe = document.createElement('span')
            probe.textContent = node.value || node.placeholder || '0'
            Object.assign(probe.style, { position: 'absolute', whiteSpace: 'pre', font: style.font, letterSpacing: style.letterSpacing })
            node.parentElement!.append(probe)
            textWidth = Math.ceil(probe.getBoundingClientRect().width / globalScale / scale)
              + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
            probe.remove()
            if (node instanceof HTMLTextAreaElement) textWidth = Math.min(node.offsetWidth, Math.max(1, textWidth))
          }
          return { node, style: node.getAttribute('style'), font: style.fontSize, textWidth }
        })
        section.dataset.fitting = 'true'
        let next: Size
        try {
          for (const { node, font, textWidth } of snapshots) {
            node.style.fontSize = font
            if (textWidth !== null) { node.style.width = textWidth + 'px'; node.style.flex = '0 0 auto' }
            if (node instanceof HTMLTextAreaElement) {
              node.style.height = 'auto'
              const style = getComputedStyle(node)
              node.style.height = (node.scrollHeight + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)) + 'px'
            }
          }
          const calculator = scaled.querySelector<HTMLElement>('.calculator-module')
          if (calculator) calculator.style.setProperty('--calculator-display-size', getComputedStyle(calculator.querySelector('input')!).fontSize)
          const surface = scaled.querySelector<HTMLElement>('.board-surface'), area = scaled.querySelector<HTMLElement>('.board-area')
          if (surface && area) {
            area.style.width = Math.max(1, Number(surface.dataset.contentWidth) * Number(surface.dataset.scale)) + 'px'
            area.style.height = Math.max(1, Number(surface.dataset.contentHeight) * Number(surface.dataset.scale)) + 'px'
          }
          const contentWidth = Math.max(scaled.offsetWidth, scaled.scrollWidth) * scale
          const contentHeight = Math.max(scaled.offsetHeight, scaled.scrollHeight) * scale
          const chromeWidth = Math.max(header.offsetWidth, header.getBoundingClientRect().width / globalScale, ((controls.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0) + 31) + 2
          next = { width: Math.ceil(Math.max(contentWidth + 2, chromeWidth)), height: Math.ceil(contentHeight + header.offsetHeight + controls.offsetHeight + 2) }
        } finally {
          delete section.dataset.fitting
          for (const { node, style } of snapshots) {
            if (style === null) node.removeAttribute('style'); else node.setAttribute('style', style)
          }
        }
        const settled = Math.abs(next.width - size.width) <= 1 && Math.abs(next.height - size.height) <= 1
        size = next
        if (settled) break
        section.style.width = size.width + 'px'; section.style.height = size.height + 'px'
      }
    } finally {
      if (originalStyle === null) section.removeAttribute('style'); else section.setAttribute('style', originalStyle)
    }
    onFit(size)
  }
  useEffect(() => {
    const node = content.current
    if (id !== 'board' || !node) return
    function wheel(event: WheelEvent) {
      if (!(event.target instanceof Element) || !event.target.closest('.board-surface') || event.target.closest('input, textarea, [contenteditable="true"]') || event.shiftKey || !event.deltaY || event.deltaX !== 0) return
      event.preventDefault(); event.stopPropagation()
      if (blockedRef.current) return
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node!.clientHeight : 1
      setScale(previous => Math.min(4, Math.max(.25, previous * Math.exp(-event.deltaY * unit * .002))))
    }
    node.addEventListener('wheel', wheel, { capture: true, passive: false })
    return () => node.removeEventListener('wheel', wheel, true)
  }, [id, blockedRef])
  return (
    <section ref={frame} className="module-frame" data-active={active} role="region" aria-label={name}>
      <header className="module-header">
        <Icon className="module-icon" aria-hidden="true" />
        <h2>{name}</h2>
        <HelpTooltip text={'Ajustar ventana de ' + name + ' al contenido'}><Button className="module-fit" aria-label={'Ajustar ventana de ' + name + ' al contenido'} disabled={blocked || !onFit} onClick={fitContent}><Proportions aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip key={generation} text={`Cerrar ${name}`}><Button className="module-close" aria-label={`Cerrar ${name}`} disabled={blocked} onClick={onClose}><X aria-hidden="true" /></Button></HelpTooltip>
      </header>
      <div ref={content} className="module-content">
        <div className="module-scaled-content" data-scale={scale} style={{ zoom: scale, width: '100%', height: '100%' }}>{children}</div>
      </div>
      <div className="module-controls">
        <ZoomControl key={generation} scale={scale} onChange={value => { if (!blockedRef.current) setScale(value) }} label={`Zoom de ${name}`} disabled={blocked} side="right" />
      </div>
    </section>
  )
}
