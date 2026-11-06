import { waitForReportFonts } from './reportTypography'
import { REPORT_PAGE_MARGIN_MM, reportPageDimensions } from './reportPageOptions'
import type { ReportPageOptions } from './reportPageOptions'

export function reportPageStyles(options: ReportPageOptions) {
  const { width, height } = reportPageDimensions(options)
  return `:root{--report-page-width:${width}mm;--report-page-height:${height}mm;--report-page-padding:${REPORT_PAGE_MARGIN_MM}mm;--report-content-width:${width - 2 * REPORT_PAGE_MARGIN_MM}mm}
@page{size:A4 ${options.orientation === 'landscape' ? 'landscape' : 'portrait'};margin:0}`
}

export async function paginateReport<T extends { html: string }>(report: T, options: ReportPageOptions): Promise<T> {
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
    function page() {
      const sheet = doc!.createElement('div'), content = doc!.createElement('div')
      sheet.className = 'report-page'
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
    for (const source of sources) {
      if (source.tagName !== 'SECTION') { sectionTitle = null; block(source); continue }
      const children = Array.from(source.children) as HTMLElement[]
      const heading = children.find(child => child.tagName === 'H2')
      if (!heading) { block(source); continue }
      sectionTitle = heading
      const remaining = children.filter(child => child !== heading)
      if (remaining.length) {
        pending = [heading]
        for (const node of remaining) { if (node.tagName === 'TABLE') table(node as HTMLTableElement); else block(node) }
      }
    }
    for (const content of main.querySelectorAll('.report-page-content')) if (!content.children.length) content.parentElement?.remove()
    return { ...report, html: '<!doctype html>\n' + doc.documentElement.outerHTML }
  } finally { clearTimeout(loadTimer); frame.onload = null; frame.onerror = null; frame.remove() }
}
