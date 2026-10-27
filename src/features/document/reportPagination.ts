import { createReportIssue, formatReportIssue, reportIssueKey } from './reportIssues'
import type { ReportIssue } from './reportIssues'
import { waitForReportFonts } from './reportTypography'

export interface ReportPageOptions { orientation: 'portrait' | 'landscape'; quality: 'normal' | 'high' }
export const DEFAULT_REPORT_PAGE: ReportPageOptions = { orientation: 'portrait', quality: 'normal' }
export const REPORT_PAGE_MARGIN_MM = 12

export function reportPageDimensions(options: ReportPageOptions) {
  return options.orientation === 'landscape' ? { width: 297, height: 210 } : { width: 210, height: 297 }
}

export function reportPageStyles(options: ReportPageOptions) {
  const { width, height } = reportPageDimensions(options)
  return `:root{--report-page-width:${width}mm;--report-page-height:${height}mm;--report-page-padding:${REPORT_PAGE_MARGIN_MM}mm;--report-content-width:${width - 2 * REPORT_PAGE_MARGIN_MM}mm}
@page{size:A4 ${options.orientation === 'landscape' ? 'landscape' : 'portrait'};margin:0}`
}

export async function paginateReport<T extends { html: string; issues: ReportIssue[] }>(report: T, options: ReportPageOptions): Promise<T> {
  const frame = document.createElement('iframe'), { width, height } = reportPageDimensions(options)
  let loadTimer: ReturnType<typeof setTimeout> | undefined
  frame.setAttribute('sandbox', 'allow-same-origin')
  frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1
  Object.assign(frame.style, { position: 'fixed', left: '-100000px', top: '0', width: width + 'mm', height: height + 'mm', border: '0', visibility: 'hidden', pointerEvents: 'none' })
  try {
    await new Promise<void>((resolve, reject) => {
      loadTimer = setTimeout(() => reject(new Error('No se pudo preparar la paginación.')), 30000)
      frame.onload = () => { clearTimeout(loadTimer); resolve() }
      frame.onerror = () => { clearTimeout(loadTimer); reject(new Error('No se pudo preparar la paginación.')) }
      frame.srcdoc = report.html; document.body.append(frame)
    })
    const doc = frame.contentDocument, main = doc?.querySelector('main')
    if (!doc || !main) throw new Error('No se pudo preparar la paginación.')
    await waitForReportFonts(doc)
    const issues = [...report.issues], images = Array.from(doc.images)
    const decoded = await Promise.allSettled(images.map(image => image.decode()))
    let imageUnavailable = false
    images.forEach((image, index) => {
      if (decoded[index]?.status === 'fulfilled' && image.naturalWidth && image.naturalHeight) return
      const section = image.closest<HTMLElement>('section[data-report-section]')?.dataset.reportSection
      if (section !== 'map' && section !== 'plan' && section !== 'board') return
      const legend = image.closest('.report-legend'), target = legend ?? image.closest('figure')
      if (!target) return
      const issue = createReportIssue(section, 'No se pudo decodificar la imagen.', legend
        ? { kind: 'legend', resourceId: 'legend', label: 'Leyenda' }
        : { kind: 'representation', resourceId: 'image', label: 'Imagen' })
      if (!issues.some(item => reportIssueKey(item) === reportIssueKey(issue))) issues.push(issue)
      const notice = doc.createElement('p')
      notice.className = 'report-unavailable'; notice.textContent = formatReportIssue(issue)
      target.replaceWith(notice); imageUnavailable = true
    })
    if (imageUnavailable) {
      const notice = main.querySelector<HTMLElement>(':scope > .report-unavailable') ?? doc.createElement('p')
      notice.className = 'report-unavailable'; notice.textContent = 'Informe incompleto: recursos no disponibles.'
      if (!notice.parentElement) main.querySelector('header')?.after(notice)
    }
    const columns = new Map<HTMLTableElement, number[]>()
    for (const table of main.querySelectorAll('table')) {
      const cells = Array.from(table.tHead?.rows[0]?.cells ?? [])
      const widths = cells.map(cell => cell.getBoundingClientRect().width), total = widths.reduce((sum, value) => sum + value, 0)
      columns.set(table, widths.map(value => total ? value / total * 100 : 100 / Math.max(1, cells.length)))
    }
    const sources = Array.from(main.children) as HTMLElement[]
    main.replaceChildren(); main.className = 'report-pages'
    let current: HTMLElement | null = null, sectionTitle: HTMLElement | null = null
    let pending: HTMLElement[] = []
    function page(graphic = false) {
      const sheet = doc!.createElement('div'), content = doc!.createElement('div')
      sheet.className = 'report-page' + (graphic ? ' report-page-graphic' : '')
      content.className = 'report-page-content'; sheet.append(content); main!.append(sheet)
      return content
    }
    function fits() { return Boolean(current && current.scrollHeight <= current.clientHeight + .5) }
    function appendPending() {
      const added = pending.map(heading => heading.cloneNode(true) as HTMLElement)
      current!.append(...added); pending = []
      return added
    }
    function newFlow(headings: HTMLElement[] = []) {
      current = page(); current.append(...headings.map(heading => heading.cloneNode(true)))
    }
    function block(source: HTMLElement) {
      if (/^H[234]$/.test(source.tagName)) { pending.push(source); return }
      if (!current) newFlow()
      const headings = appendPending(), node = source.cloneNode(true) as HTMLElement
      current!.append(node)
      if (!fits() && current!.children.length > headings.length + 1) {
        node.remove(); headings.forEach(heading => heading.remove()); newFlow(headings); current!.append(node)
      }
      if (!fits()) throw new Error('Un bloque del informe no cabe en una página A4.')
    }
    function writeCell(cell: HTMLTableCellElement, value: string) {
      cell.replaceChildren()
      value.split('\n').forEach((line, index) => { if (index) cell.append(doc!.createElement('br')); cell.append(doc!.createTextNode(line)) })
    }
    function cellText(cell: HTMLTableCellElement) {
      return Array.from(cell.childNodes).map(node => node.nodeName === 'BR' ? '\n' : node.textContent ?? '').join('')
    }
    function table(source: HTMLTableElement) {
      const headings = pending.map(node => node.cloneNode(true) as HTMLElement)
      const continuationHeadings = headings.length ? headings : sectionTitle ? [sectionTitle] : []
      let target!: HTMLTableElement, body!: HTMLTableSectionElement
      let inserted: HTMLElement[] = []
      function shell(nextPage: boolean) {
        if (nextPage || !current) newFlow()
        inserted = (nextPage ? continuationHeadings : headings).map(node => node.cloneNode(true) as HTMLElement); current!.append(...inserted); pending = []
        target = source.cloneNode(false) as HTMLTableElement
        const group = doc!.createElement('colgroup')
        for (const width of columns.get(source) ?? []) { const col = doc!.createElement('col'); col.style.width = width + '%'; group.append(col) }
        target.append(group)
        if (source.caption) target.append(source.caption.cloneNode(true))
        if (source.tHead) target.append(source.tHead.cloneNode(true))
        body = doc!.createElement('tbody'); target.append(body); current!.append(target)
      }
      function advance() {
        if (!body.rows.length) { target.remove(); inserted.forEach(node => node.remove()) }
        if (current && !current.children.length) current.parentElement?.remove()
        shell(true)
      }
      shell(false)
      for (const original of Array.from(source.tBodies).flatMap(body => Array.from(body.rows))) {
        const row = original.cloneNode(true) as HTMLTableRowElement
        body!.append(row)
        if (fits()) continue
        row.remove()
        advance(); body!.append(row)
        if (fits()) continue
        row.remove()
        const remaining = Array.from(original.cells).map(cell => Array.from(cellText(cell)))
        const lengths = remaining.map(value => value.length)
        const repeated = new Map<number, string>()
        while (remaining.some(value => value.length)) {
          const fragment = original.cloneNode(true) as HTMLTableRowElement
          for (const cell of Array.from(fragment.cells)) writeCell(cell, '')
          body!.append(fragment)
          for (let index = 0; index < remaining.length; index++) {
            const characters = remaining[index]!, cell = fragment.cells[index]!
            if (!characters.length) { writeCell(cell, repeated.get(index) ?? ''); continue }
            let low = 0, high = characters.length
            while (low < high) {
              const middle = Math.ceil((low + high) / 2)
              writeCell(cell, characters.slice(0, middle).join(''))
              if (fits()) low = middle; else high = middle - 1
            }
            if (!low) throw new Error('Una fila del informe no cabe en una página A4.')
            if (low < characters.length) {
              let space = low - 1
              while (space > low / 2 && !/\s/.test(characters[space]!)) space--
              if (space > low / 2) low = space + 1
            }
            const value = characters.splice(0, low).join('')
            writeCell(cell, value)
            if (!characters.length && low === lengths[index]) repeated.set(index, value)
          }
          if (remaining.some(value => value.length)) advance()
        }
      }
    }
    function composition(source: HTMLElement, heading: HTMLElement) {
      current = null
      const content = page(true)
      content.append(heading.cloneNode(true))
      const box = doc!.createElement('div'), inner = doc!.createElement('div')
      box.className = 'report-composition-box'; inner.className = 'report-composition-content'
      inner.style.width = content.clientWidth + 'px'
      const figure = source.cloneNode(true) as HTMLElement, image = figure.querySelector<HTMLImageElement>('.report-map-image')
      const original = source.querySelector<HTMLImageElement>('.report-map-image')
      if (!image || !original?.naturalWidth || !original.naturalHeight) throw new Error('La composición gráfica no está disponible.')
      const available = content.clientHeight
      image.style.width = content.clientWidth + 'px'; image.style.height = content.clientWidth * original.naturalHeight / original.naturalWidth + 'px'
      inner.append(figure); box.append(inner); content.append(box)
      const top = box.getBoundingClientRect().top - content.getBoundingClientRect().top
      const extra = inner.getBoundingClientRect().height - image.getBoundingClientRect().height
      const maxImageHeight = Math.max(1, available - top - extra - 1)
      const imageWidth = Math.min(content.clientWidth, maxImageHeight * original.naturalWidth / original.naturalHeight)
      image.style.width = imageWidth + 'px'; image.style.height = imageWidth * original.naturalHeight / original.naturalWidth + 'px'
      const total = inner.getBoundingClientRect().height, scale = Math.min(1, Math.max(1, available - top - 1) / Math.max(1, total))
      inner.style.left = (content.clientWidth - content.clientWidth * scale) / 2 + 'px'; inner.style.transform = `scale(${scale})`
      box.style.height = total * scale + 'px'
      pending = []
    }
    for (const source of sources) {
      if (source.tagName !== 'SECTION') { sectionTitle = null; block(source); continue }
      const children = Array.from(source.children) as HTMLElement[]
      const heading = children.find(child => child.tagName === 'H2')
      if (!heading) { block(source); continue }
      sectionTitle = heading
      const figure = children.find(child => child.tagName === 'FIGURE' && child.querySelector('.report-map-image'))
      if (figure) composition(figure, heading)
      const remaining = children.filter(child => child !== heading && child !== figure)
      if (remaining.length) {
        pending = [heading]
        for (const node of remaining) { if (node.tagName === 'TABLE') table(node as HTMLTableElement); else block(node) }
      }
    }
    for (const content of main.querySelectorAll('.report-page-content')) if (!content.children.length) content.parentElement?.remove()
    return { ...report, issues, html: '<!doctype html>\n' + doc.documentElement.outerHTML }
  } finally { clearTimeout(loadTimer); frame.onload = null; frame.onerror = null; frame.remove() }
}
