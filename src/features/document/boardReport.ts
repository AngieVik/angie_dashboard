import type { AngieDocument, AssetId, DocumentElement, QuickNote } from '../../domain/document/types'
import type { BoardImage } from '../board/boardTypes'
import type { BoardFrame } from '../board/boardViewport'
import { loadBoardImage } from '../board/imageLoader'
import { getPinBox, ICON_CATALOG } from '../elements/iconCatalog'
import { getPinNameLayout, getRotatedPinBox, pinNameLines, PIN_NAME_COLORS } from '../elements/pinPresentation'
import { embeddedImageFile } from '../../platform/files/embeddedImage'
import { createReportLegendEntry, createResourceLegend, reportRectIntersects } from './reportLegend'
import type { ReportLegendEntry } from './reportLegend'
import { createReportIssue, reportIssueKey } from './reportIssues'
import type { ReportIssue, ReportRecovery } from './reportIssues'
import { freezeReportImage, loadReportImage, renderReportRaster } from './reportImages'
import type { ReportPageOptions } from './reportPagination'

export interface BoardReportContent {
  documentId: string
  image?: string
  frame?: BoardFrame
  legend?: ReportLegendEntry[]
  notes: { title: string; text: string }[]
  issues?: ReportIssue[]
  recovery?: ReportRecovery<BoardReportContent>
  iconPixels?: Map<AssetId, string>
  fontFamily?: string
  omittedImage?: boolean
  omittedSection?: boolean
}

export interface BoardReportLayers { background: boolean; names: boolean; notes: boolean; strokes: boolean; legend: boolean }
export const DEFAULT_BOARD_REPORT_LAYERS: BoardReportLayers = { background: true, names: true, notes: true, strokes: true, legend: true }
export interface BoardReportRequest { frame?: BoardFrame; resourceIds: string[]; layers: BoardReportLayers; blockedImage?: ReportIssue[]; iconPixels?: Map<AssetId, string>; fontFamily?: string; frameMissing?: boolean }
export interface BoardReportOptions { frame?: BoardFrame; resourceIds?: readonly string[]; layers?: BoardReportLayers; signal?: AbortSignal; blockedImage?: ReportIssue[]; iconPixels?: Map<AssetId, string>; fontFamily?: string; retryIcons?: Set<AssetId>; recovering?: boolean; omittedImage?: boolean; frameMissing?: boolean; page?: ReportPageOptions }
export interface ReportBoardHandle { capture: () => BoardReportRequest }

async function loadIcons(elements: DocumentElement[], options: BoardReportOptions) {
  const ids = [...new Set(elements.flatMap(element => element.visual.type === 'asset' ? [element.visual.assetId] : []))]
  const results = await Promise.allSettled(ids.map(id => {
    const pixels = options.iconPixels?.get(id)
    if (!pixels && options.retryIcons && !options.retryIcons.has(id)) return Promise.reject(new Error('Icono no disponible.'))
    return loadReportImage(pixels ?? ICON_CATALOG[id].path)
  }))
  const images = new Map<AssetId, HTMLImageElement>(), unavailable: AssetId[] = []
  results.forEach((result, index) => {
    if (result.status === 'rejected') unavailable.push(ids[index]!)
    else images.set(ids[index]!, result.value)
  })
  return { images, unavailable }
}

function pinNameBox(context: CanvasRenderingContext2D, element: DocumentElement, fontFamily: string) {
  if (!element.position || element.nameHidden) return null
  const lines = pinNameLines(element.name), fontSize = element.nameFontSize ?? 16
  const padding = element.visual.scale, layout = getPinNameLayout(element)
  context.save(); context.font = `${fontSize}px ${fontFamily}`
  const width = Math.min(layout.width, Math.max(...lines.map(line => context.measureText(line).width)) + 8 * padding)
  context.restore()
  const height = fontSize * 1.25 * lines.length + 2 * padding
  return { lines, fontSize, padding, width, height, left: element.position.x + layout.offset.x - width / 2, top: element.position.y + layout.offset.y - height / 2 }
}

function contentFrame(context: CanvasRenderingContext2D, documentSnapshot: AngieDocument, elements: DocumentElement[], fontFamily: string, layers: BoardReportLayers): BoardFrame {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  function include(x: number, y: number, width: number, height: number) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + width); bottom = Math.max(bottom, y + height)
  }
  const board = documentSnapshot.board, background = layers.background ? board.backgroundImage?.layout : undefined
  if (background) include(background.x, background.y, background.width, background.height)
  if (layers.strokes) for (const stroke of board.strokes) for (const point of stroke.points) include(point.x - stroke.width / 2, point.y - stroke.width / 2, stroke.width, stroke.width)
  if (layers.notes) for (const note of board.quickNotes) include(note.position.x - note.width / 2 - 1, note.position.y - note.height / 2 - 1, note.width + 5, note.height + 6)
  for (const element of elements) {
    if (!element.position) continue
    const box = getRotatedPinBox(element.visual), name = layers.names ? pinNameBox(context, element, fontFamily) : null
    include(element.position.x - box.width / 2, element.position.y - box.height / 2, box.width, box.height)
    if (name) include(name.left, name.top, name.width, name.height)
  }
  if (!Number.isFinite(left)) return { x: 0, y: 0, width: 320, height: 220 }
  const margin = Math.max(8, Math.max(right - left, bottom - top) * .02)
  return { x: left - margin, y: top - margin, width: right - left + 2 * margin, height: bottom - top + 2 * margin }
}

function drawPin(context: CanvasRenderingContext2D, element: DocumentElement, images: Map<AssetId, HTMLImageElement>, fontFamily: string, names: boolean) {
  if (!element.position) return
  const { x, y } = element.position, box = getPinBox(element.visual)
  context.save(); context.translate(x, y)
  context.rotate((element.visual.rotation ?? 0) * Math.PI / 180)
  context.scale(element.visual.flipX ? -1 : 1, element.visual.flipY ? -1 : 1)
  if (element.visual.type === 'asset') {
    const image = images.get(element.visual.assetId)
    if (!image) throw new Error('El icono de ' + element.name + ' no está disponible.')
    const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight)
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale
    context.drawImage(image, -width / 2, -height / 2, width, height)
  } else {
    context.font = `${48 * element.visual.scale}px ${fontFamily}`
    context.textAlign = 'center'; context.textBaseline = 'middle'
    context.fillStyle = '#F2F2F2'; context.fillText(element.visual.value, 0, 0)
  }
  context.restore()
  const name = names ? pinNameBox(context, element, fontFamily) : null
  if (!name) return
  const { lines, fontSize, padding, width, height, left, top } = name
  const theme = PIN_NAME_COLORS[element.nameColor ?? 'dark']
  context.save(); context.font = `${fontSize}px ${fontFamily}`
  context.beginPath(); context.roundRect(left, top, width, height, 2)
  context.fillStyle = theme.backgroundColor; context.fill()
  context.beginPath(); context.rect(left + 4 * padding, top, Math.max(0, width - 8 * padding), height); context.clip()
  context.fillStyle = theme.color; context.textAlign = 'center'; context.textBaseline = 'middle'
  const available = Math.max(0, width - 8 * padding)
  lines.forEach((line, index) => {
    let text = line
    if (context.measureText(text).width > available) {
      const characters = [...text]
      while (characters.length && context.measureText(characters.join('') + '…').width > available) characters.pop()
      text = characters.join('') + '…'
    }
    context.fillText(text, left + width / 2, top + padding + fontSize * 1.25 * (index + .5))
  })
  context.restore()
}

function drawNote(context: CanvasRenderingContext2D, note: QuickNote, measure: HTMLDivElement, fontFamily: string) {
  const left = note.position.x - note.width / 2, top = note.position.y - note.height / 2
  context.save()
  context.shadowColor = 'rgb(0 0 0 / 35%)'; context.shadowBlur = 3; context.shadowOffsetX = 1; context.shadowOffsetY = 2
  const half = (note.width + note.height) / 4
  const gradient = context.createLinearGradient(note.position.x - half, note.position.y - half, note.position.x + half, note.position.y + half)
  gradient.addColorStop(0, '#FFF0A3'); gradient.addColorStop(1, '#F5DB73')
  context.beginPath(); context.roundRect(left + .5, top + .5, note.width - 1, note.height - 1, 2)
  context.fillStyle = gradient; context.fill()
  context.shadowColor = 'transparent'; context.strokeStyle = '#BDA349'; context.lineWidth = 1; context.stroke()
  context.beginPath(); context.moveTo(left + .5, top + note.height - 2); context.lineTo(left + .5, top + .5); context.lineTo(left + note.width - 2, top + .5)
  context.strokeStyle = '#FFF2AD'; context.stroke()

  const value = note.title ? [note.title, note.text].filter(Boolean).join('\n') : note.text
  if (!value) { context.restore(); return }
  const textarea = document.createElement('textarea')
  Object.assign(textarea.style, { display: 'block', boxSizing: 'border-box', width: Math.max(1, note.width - 2) + 'px', height: Math.max(1, note.height - 2) + 'px',
    margin: '0', padding: '6px 26px 4px 5px', border: '0', borderRadius: '0', resize: 'none', fontFamily, lineHeight: '1.25',
    whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflow: 'auto' })
  textarea.value = value; textarea.readOnly = true
  textarea.setAttribute('aria-hidden', 'true'); textarea.tabIndex = -1
  measure.append(textarea)
  // Use the same wrapped-text fit as QuickNote, without editing the live note.
  let low = .5, high = Math.max(32, textarea.clientHeight)
  textarea.style.fontSize = high + 'px'
  if (textarea.scrollHeight > textarea.clientHeight || textarea.scrollWidth > textarea.clientWidth) {
    while (high - low > .1) {
      const middle = (low + high) / 2
      textarea.style.fontSize = middle + 'px'
      if (textarea.scrollHeight <= textarea.clientHeight && textarea.scrollWidth <= textarea.clientWidth) low = middle
      else high = middle
    }
    textarea.style.fontSize = low + 'px'
  }
  const fontSize = Number.parseFloat(textarea.style.fontSize)
  const mirror = document.createElement('div')
  Object.assign(mirror.style, { width: Math.max(1, textarea.clientWidth - 31) + 'px', margin: '0', padding: '0', border: '0',
    fontFamily, fontSize: fontSize + 'px', lineHeight: '1.25', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })
  const node = document.createTextNode(value)
  mirror.append(node); measure.append(mirror)
  const origin = mirror.getBoundingClientRect(), range = document.createRange()
  function characterRect(index: number) {
    range.setStart(node, index); range.setEnd(node, index + 1)
    return range.getBoundingClientRect()
  }
  context.beginPath(); context.rect(left + 1, top + 1, note.width - 2, note.height - 2); context.clip()
  context.font = `${fontSize}px ${fontFamily}`; context.fillStyle = '#302711'
  context.textAlign = 'left'; context.textBaseline = 'alphabetic'
  const ascent = context.measureText('Mg').fontBoundingBoxAscent
  const baseline = Number.isFinite(ascent) ? ascent : fontSize * .8
  let offset = 0
  while (offset < value.length) {
    if (value[offset] === '\n') { offset++; continue }
    const first = characterRect(offset)
    const lineMiddle = first.top + first.height / 2
    const newline = value.indexOf('\n', offset), end = newline < 0 ? value.length : newline
    let from = offset + 1, to = end
    while (from < to) {
      const middle = Math.floor((from + to) / 2)
      const rect = characterRect(middle)
      if (rect.top + rect.height / 2 <= lineMiddle + fontSize * .625) from = middle + 1
      else to = middle
    }
    range.setStart(node, offset); range.setEnd(node, from)
    const rect = range.getBoundingClientRect()
    context.fillText(value.slice(offset, from), left + 6 + rect.left - origin.left, top + 7 + rect.top - origin.top + baseline)
    offset = from
  }
  textarea.remove(); mirror.remove()
  context.restore()
}

function composeBoard(documentSnapshot: AngieDocument, elements: DocumentElement[], images: Map<AssetId, HTMLImageElement>, background: BoardImage | undefined, fontFamily: string, options: BoardReportOptions) {
  const board = documentSnapshot.board
  const layers = options.layers ?? DEFAULT_BOARD_REPORT_LAYERS
  const layout = board.backgroundImage?.layout
  const metrics = document.createElement('canvas').getContext('2d')
  if (!metrics) throw new Error('No se pudo calcular el encuadre de Pizarra.')
  const frame = options.frame ?? contentFrame(metrics, documentSnapshot, elements, fontFamily, layers)
  if (![frame.x, frame.y, frame.width, frame.height].every(Number.isFinite) || frame.width <= 0 || frame.height <= 0) throw new Error('El encuadre de Pizarra no es válido.')
  const { width, height } = frame
  return renderReportRaster(width, height, options.page, 2, ([context, drawing], encode) => {
    if (!context || !drawing) throw new Error('No se pudo crear la imagen de Pizarra.')
    const ink = drawing.canvas
    context.translate(-frame.x, -frame.y); drawing.translate(-frame.x, -frame.y)
    context.fillStyle = layers.background ? board.backgroundColor : '#FFFFFF'; context.fillRect(frame.x, frame.y, width, height)
    if (layers.background && background && layout) context.drawImage(background.image, layout.x, layout.y, layout.width, layout.height)
    // Erasing is confined to the drawing layer, as in BoardModule's Konva layers.
    drawing.lineCap = 'round'; drawing.lineJoin = 'round'
    if (layers.strokes) for (const stroke of board.strokes) {
      drawing.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
      drawing.strokeStyle = drawing.fillStyle = stroke.color ?? '#000000'; drawing.lineWidth = stroke.width
      drawing.beginPath()
      if (stroke.points.length === 1) {
        drawing.arc(stroke.points[0]!.x, stroke.points[0]!.y, stroke.width / 2, 0, Math.PI * 2); drawing.fill()
      } else {
        stroke.points.forEach((point, index) => { if (index === 0) drawing.moveTo(point.x, point.y); else drawing.lineTo(point.x, point.y) })
        drawing.stroke()
      }
    }
    context.drawImage(ink, frame.x, frame.y, width, height)
    for (const element of elements) drawPin(context, element, images, fontFamily, layers.names)
    const measure = document.createElement('div')
    measure.setAttribute('aria-hidden', 'true')
    Object.assign(measure.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden', pointerEvents: 'none', fontFamily, contain: 'layout style paint' })
    document.body.append(measure)
    try {
      if (layers.notes) for (const note of board.quickNotes) drawNote(context, note, measure, fontFamily)
      const legend: ReportLegendEntry[] = []
      if (layers.legend) {
        const area = { left: frame.x, top: frame.y, width, height }
        const represented = elements.filter(element => {
          if (!element.position) return false
          const box = getRotatedPinBox(element.visual)
          return reportRectIntersects(area, { left: element.position.x - box.width / 2, right: element.position.x + box.width / 2,
            top: element.position.y - box.height / 2, bottom: element.position.y + box.height / 2 })
        })
        legend.push(...createResourceLegend(represented, images, fontFamily, options.page?.quality))
        if (layers.notes && board.quickNotes.some(note => reportRectIntersects(area, {
          left: note.position.x - note.width / 2, right: note.position.x + note.width / 2,
          top: note.position.y - note.height / 2, bottom: note.position.y + note.height / 2,
        }))) legend.push(createReportLegendEntry('Notas', sample => {
          sample.fillStyle = '#F5DB73'; sample.strokeStyle = '#BDA349'
          sample.fillRect(14, 6, 36, 28); sample.strokeRect(14, 6, 36, 28)
        }, options.page?.quality))
        // Inspect only the ink layer: fully erased drawings must not leave a legend entry.
        if (layers.strokes && board.strokes.some(stroke => stroke.tool === 'pen')) {
          for (let row = 0; row < ink.height; row += 64) {
            const pixels = drawing.getImageData(0, row, ink.width, Math.min(64, ink.height - row)).data
            let visible = false
            for (let index = 3; index < pixels.length; index += 4) if (pixels[index]) { visible = true; break }
            if (!visible) continue
            legend.push(createReportLegendEntry('Trazos', sample => {
              const factor = Math.min(56 / ink.width, 32 / ink.height), width = ink.width * factor, height = ink.height * factor
              sample.drawImage(ink, (64 - width) / 2, (40 - height) / 2, width, height)
            }, options.page?.quality))
            break
          }
        }
      }
      return { image: encode(), frame: { ...frame }, legend }
    } finally { measure.remove() }
  })
}

export async function createBoardReport(documentSnapshot: AngieDocument, fields: string[], options: BoardReportOptions = {}): Promise<BoardReportContent> {
  const report: BoardReportContent = { documentId: documentSnapshot.document.id,
    notes: fields.includes('notes') ? documentSnapshot.board.quickNotes.map(({ title, text }) => ({ title, text })) : [] }
  if (!fields.includes('image')) return report
  if (options.omittedImage) { report.omittedImage = true; return report }
  const selected = options.resourceIds ? new Set(options.resourceIds.map(id => id.toLowerCase())) : null
  const elements = documentSnapshot.elements.filter(element => element.position && (selected ? selected.has(element.id.toLowerCase()) : element.pinVisible))
  const fontFamily = options.fontFamily ?? (getComputedStyle(document.documentElement).getPropertyValue('--font-interface').trim() || 'sans-serif')
  const metricsCanvas = document.createElement('canvas'), metrics = metricsCanvas.getContext('2d')
  report.frame = options.frameMissing ? undefined : options.frame ?? (metrics ? contentFrame(metrics, documentSnapshot, elements, fontFamily, options.layers ?? DEFAULT_BOARD_REPORT_LAYERS) : undefined)
  metricsCanvas.width = metricsCanvas.height = 0
  report.fontFamily = fontFamily; report.iconPixels = new Map(options.iconPixels)
  if (!options.recovering) report.recovery = createBoardRecovery(documentSnapshot, fields, { ...options, frame: report.frame, fontFamily }, report.iconPixels)
  if (options.frameMissing) { report.issues = [createReportIssue('board', 'El encuadre no está disponible.')]; return report }
  if (options.blockedImage?.length) { report.issues = options.blockedImage; return report }
  const embedded = (options.layers ?? DEFAULT_BOARD_REPORT_LAYERS).background ? documentSnapshot.board.backgroundImage : undefined
  const [backgroundResult, iconResult, fontResult] = await Promise.allSettled([
    embedded ? Promise.resolve().then(() => loadBoardImage(embeddedImageFile(embedded.dataUrl))) : Promise.resolve(undefined),
    loadIcons(elements, options), document.fonts.ready,
  ])
  const background = backgroundResult.status === 'fulfilled' && backgroundResult.value?.success ? backgroundResult.value : undefined
  try {
    if (options.signal?.aborted) throw new DOMException('Preparación de Pizarra cancelada.', 'AbortError')
    const issues: ReportIssue[] = []
    const backgroundResource = { kind: 'background' as const, resourceId: 'backgroundImage', label: 'Fondo de Pizarra' }
    if (backgroundResult.status === 'rejected') issues.push(createReportIssue('board', backgroundResult.reason, backgroundResource))
    else if (backgroundResult.value && !backgroundResult.value.success) issues.push(createReportIssue('board', backgroundResult.value.message, backgroundResource))
    if (iconResult.status === 'rejected') issues.push(createReportIssue('board', iconResult.reason, { kind: 'icon', resourceId: 'icons', label: 'Iconos' }))
    else {
      for (const [id, image] of iconResult.value.images) {
        try { report.iconPixels!.set(id, freezeReportImage(image)) }
        catch { iconResult.value.unavailable.push(id) }
      }
      for (const id of iconResult.value.unavailable) issues.push(createReportIssue('board', 'No disponible.', { kind: 'icon', resourceId: id, label: ICON_CATALOG[id].name }))
    }
    if (fontResult.status === 'rejected') issues.push(createReportIssue('board', 'Tipografía no disponible.', { kind: 'representation', resourceId: 'font', label: 'Imagen de Pizarra' }))
    if (issues.length || iconResult.status !== 'fulfilled') { report.issues = issues; return report }
    const composition = composeBoard(documentSnapshot, elements, iconResult.value.images, background, fontFamily, { ...options, frame: report.frame })
    report.image = composition.image; report.frame = composition.frame; report.legend = composition.legend
    return report
  } catch (error) {
    if (options.signal?.aborted) throw error
    report.issues = [createReportIssue('board', error)]
    return report
  } finally { background?.dispose() }
}

function createBoardRecovery(snapshot: AngieDocument, fields: string[], options: BoardReportOptions, pixels: Map<AssetId, string>): ReportRecovery<BoardReportContent> {
  let ids = [...(options.resourceIds ?? snapshot.elements.filter(element => element.pinVisible && element.position).map(element => element.id))]
  const layers = { ...(options.layers ?? DEFAULT_BOARD_REPORT_LAYERS) }, omitted: ReportIssue[] = []
  let backgroundOmitted = false, imageOmitted = false
  const recovery: ReportRecovery<BoardReportContent> = { async apply(issue, action) {
    if (action === 'retry' && options.frameMissing) throw new Error('Preparación no disponible. Actualiza el informe.')
    if (action === 'omit') {
      if (!omitted.some(item => reportIssueKey(item) === reportIssueKey(issue))) omitted.push({ ...issue, omitted: true })
      if (issue.kind === 'background') backgroundOmitted = true
      else if (issue.kind === 'icon') ids = ids.filter(id => !snapshot.elements.some(element => element.id.toLowerCase() === id.toLowerCase() && element.visual.type === 'asset' && element.visual.assetId === issue.resourceId))
      else if (issue.kind === 'legend') layers.legend = false
      else imageOmitted = true
    }
    const document = backgroundOmitted ? { ...snapshot, board: { ...snapshot.board, backgroundImage: undefined } } : snapshot
    const report = await createBoardReport(document, fields, { ...options, blockedImage: undefined, signal: undefined, recovering: true,
      resourceIds: ids, layers, iconPixels: pixels, omittedImage: imageOmitted, retryIcons: new Set(action === 'retry' && issue.kind === 'icon' ? [issue.resourceId as AssetId] : []) })
    for (const [id, data] of report.iconPixels ?? []) pixels.set(id, data)
    report.recovery = recovery; report.issues = [...(report.issues ?? []), ...omitted]
    return report
  } }
  return recovery
}
