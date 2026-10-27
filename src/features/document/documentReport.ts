import type { AngieDocument } from '../../domain/document/types'
import { getTimelineEntryLabel, isCurrentTimelineEntry, isTimelineEntryCorrected, isTimelineEntryDeleted } from '../../domain/operations/timelineProjection'
import { formatTimelineDate } from '../timeline/timelineCommands'
import { MAP_BACKGROUNDS, PNOA_INFORMATION } from '../map/mapBackgrounds'
import type { MapReportContent } from './mapReport'
import type { BoardReportContent } from './boardReport'
import type { ReportLegendEntry } from './reportLegend'
import { parseCoordinate } from '../coordinates/parseCoordinate'
import { UTM_BANDS } from '../coordinates/coordinateTypes'
import { currentWeatherReportRows, forecastReportRows, formatWeatherDate } from './weatherReport'
import type { WeatherReportContent } from './weatherReport'
import { calculateTimerValue, formatDuration } from '../clock/timerEngine'
import type { TimerRecord } from '../clock/timerTypes'
import { createReportIssue, formatReportIssue } from './reportIssues'
import type { ReportGraphicSection, ReportIssue } from './reportIssues'
import { DEFAULT_REPORT_PAGE, reportPageStyles } from './reportPagination'
import type { ReportPageOptions } from './reportPagination'

export const REPORT_SECTIONS = {
  elements: { title: 'Elementos', fields: { name: 'Nombre', information: 'Información' } },
  dotations: { title: 'Dotaciones', fields: { name: 'Nombre', information: 'Información', tags: 'Etiquetas' } },
  information: { title: 'Información', fields: { name: 'Dotación', information: 'Información', status: 'Estado actual', notes: 'Notas', tags: 'Etiquetas' } },
  operations: { title: 'Operativo', fields: { name: 'Dotación', status: 'Estado actual', notes: 'Notas', tags: 'Etiquetas' } },
  timeline: { title: 'Registro', fields: { occurredAt: 'Fecha y hora', type: 'Tipo', text: 'Contenido', condition: 'Condición', revisions: 'Correcciones y eliminaciones' } },
  notebook: { title: 'Cuaderno', fields: { title: 'Título', text: 'Notas y listas' } },
  map: { title: 'Mapa', fields: { image: 'Imagen', coordinates: 'Coordenadas', gpx: 'Datos de GPX' } },
  plan: { title: 'Plano operativo', fields: { image: 'Imagen', resources: 'Recursos' } },
  board: { title: 'Pizarra', fields: { image: 'Imagen', notes: 'Texto de las notas' } },
  coordinates: { title: 'Coordenadas', fields: { value: 'Valor', system: 'Sistema de coordenadas' } },
  weather: { title: 'Meteorología', fields: { aemet: 'AEMET', openMeteo: 'Open-Meteo' } },
  timers: { title: 'Temporizadores', fields: { name: 'Nombre', status: 'Estado', value: 'Valor' } },
} as const
export type ReportSection = keyof typeof REPORT_SECTIONS
export type ReportSelection = Partial<Record<ReportSection, string[]>>
export function defaultReportSelection(): ReportSelection {
  return Object.fromEntries(Object.entries(REPORT_SECTIONS).map(([id, section]) => [id, id === 'map' || id === 'plan' || id === 'board' || id === 'coordinates' || id === 'weather' || id === 'timers' ? [] : Object.keys(section.fields)]))
}
const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function escape(value: string) { return value.replace(/[&<>"']/g, character => entities[character]!) }
function text(value: string) { return escape(value).replace(/\n/g, '<br>') }

export function createDocumentReport(document: AngieDocument, generatedAt: Date, selection: ReportSelection = defaultReportSelection(), mapReport?: MapReportContent, planReport?: MapReportContent, boardReport?: BoardReportContent, coordinateInput = '', weatherReport: WeatherReportContent = {}, timerRecords?: readonly TimerRecord[] | null, page: ReportPageOptions = DEFAULT_REPORT_PAGE) {
  const selected = (section: ReportSection, field: string) => selection[section]?.includes(field) ?? false
  if (selection.map?.length && mapReport && mapReport.documentId !== document.document.id) throw new Error('El mapa pertenece a otro UIBoard.')
  if (selection.plan?.length && planReport && planReport.documentId !== document.document.id) throw new Error('El plano pertenece a otro UIBoard.')
  if (selection.board?.length && boardReport && boardReport.documentId !== document.document.id) throw new Error('La pizarra pertenece a otro UIBoard.')
  const issues: ReportIssue[] = [
    ...(selection.map?.length ? mapReport?.issues ?? [] : []),
    ...(selection.plan?.length ? planReport?.issues ?? [] : []),
    ...(selection.board?.length ? boardReport?.issues ?? [] : []),
  ]
  function notices(section: ReportGraphicSection) {
    return issues.filter(issue => issue.section === section).map(issue => `<p class="report-unavailable">${text(formatReportIssue(issue))}</p>`).join('')
  }
  function missingSection(section: ReportGraphicSection, label: string) {
    issues.push(createReportIssue(section, 'Los datos seleccionados no están disponibles.', { kind: 'representation', resourceId: 'section', label }))
  }
  function reportLegend(section: ReportGraphicSection, entries: ReportLegendEntry[] = []) {
    if (!entries.length) return ''
    if (entries.some(entry => !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(entry.image))) {
      issues.push(createReportIssue(section, 'No disponible.', { kind: 'legend', resourceId: 'legend', label: 'Leyenda' }))
      return ''
    }
    return '<div class="report-legend"><h3>Leyenda</h3><ul>' + entries.map(entry => {
      return `<li><img src="${escape(entry.image)}" alt=""><span>${text(entry.label)}</span></li>`
    }).join('') + '</ul></div>'
  }
  function reportImage(image: MapReportContent['image'], title: string, section: 'map' | 'plan') {
    if (!image || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image.dataUrl)) {
      if (image || !issues.some(issue => issue.section === section)) issues.push(createReportIssue(section, 'No disponible.', { kind: 'representation', resourceId: 'image', label: title }))
      return '<p class="report-unavailable">Imagen no disponible.</p>'
    }
    const sources = [image.background ? MAP_BACKGROUNDS[image.background].attribution : '', image.pnoaInformation ? PNOA_INFORMATION.attribution : ''].filter(Boolean)
    const attribution = sources.length ? `<figcaption>${sources.join(' · ')}</figcaption>` : ''
    return `<figure><img class="report-map-image" src="${escape(image.dataUrl)}" alt="${escape(title)}">${attribution}${reportLegend(section, image.legend)}</figure>`
  }
  function rowsTable(fields: [string, string][], rows: Record<string, string>[]) {
    return rows.length ? `<table><thead><tr>${fields.map(([, label]) => `<th scope="col">${escape(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${fields.map(([id]) => `<td>${text(row[id] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p>Sin datos.</p>'
  }
  function table(section: ReportSection, rows: Record<string, string>[]) {
    const fields = Object.entries(REPORT_SECTIONS[section].fields).filter(([id]) => selected(section, id))
    if (!fields.length) return ''
    return `<section><h2>${escape(REPORT_SECTIONS[section].title)}</h2>${rowsTable(fields, rows)}</section>`
  }
  const resources = (units: boolean) => document.elements.filter(element => element.isUnit === units).map(element => ({
    name: element.name, information: element.information, tags: element.isUnit ? element.operational.tags.join('\n') : '',
  }))
  const currentEntries = new Map(document.timeline.map(entry => [entry.id.toLowerCase(), entry]))
  const operational: Record<string, string>[] = document.elements.flatMap(element => {
    if (!element.isUnit) return []
    const entry = currentEntries.get(element.operational.currentEntryId?.toLowerCase() ?? '')
    const status = element.operational.status === 'Personalizada' && entry?.type === 'status-change' ? entry.customLabel || 'Personalizada' : element.operational.status || 'Sin estado'
    return [{ name: element.name, information: element.information, status, notes: element.operational.notes, tags: element.operational.tags.join('\n') }]
  })
  const timeline = document.timeline.map(entry => ({
    occurredAt: formatTimelineDate(entry.occurredAt), type: entry.type === 'manual' ? 'Manual' : 'Estado', text: getTimelineEntryLabel(entry),
    condition: isTimelineEntryDeleted(entry) ? 'Eliminada' : isTimelineEntryCorrected(entry) ? 'Corregida' : isCurrentTimelineEntry(document, entry) ? 'Actual' : 'Registrada',
    revisions: entry.revisions.map(revision => `${formatTimelineDate(revision.recordedAt)} · ${revision.kind === 'text' ? revision.text : revision.kind === 'delete' ? 'Eliminación' : 'Corrección'}`).join('\n'),
  }))
  const notebook = document.notebook.map(block => ({ title: block.title,
    text: block.type === 'note' ? block.text : block.items.map(item => `${item.checked ? '☑' : '☐'} ${item.text}`).join('\n') }))
  let mapContent = ''
  if (selection.map?.length) {
    if (!mapReport) missingSection('map', 'Mapa')
    else if (!mapReport.omittedSection) {
      if (selected('map', 'image') && !mapReport.omittedImage) mapContent += reportImage(mapReport.image, 'Mapa del informe', 'map')
      if (selected('map', 'coordinates')) mapContent += '<h3>Coordenadas</h3>' + rowsTable([['name', 'Marcador'], ['latitude', 'Latitud'], ['longitude', 'Longitud']], mapReport.markers.map(marker => ({
        name: marker.name || 'Marcador', latitude: marker.latitude.toFixed(6), longitude: marker.longitude.toFixed(6),
      })))
      if (selected('map', 'gpx')) mapContent += '<h3>GPX</h3>' + rowsTable([['name', 'Recorrido'], ['distance', 'Distancia'], ['points', 'Puntos'], ['availability', 'Disponibilidad']], mapReport.gpx)
    }
    mapContent = '<section data-report-section="map"><h2>Mapa</h2>' + notices('map') + mapContent + '</section>'
  }
  let planContent = ''
  if (selection.plan?.length) {
    if (!planReport) missingSection('plan', 'Plano operativo')
    else if (!planReport.omittedSection) {
      if (selected('plan', 'image') && !planReport.omittedImage) planContent += reportImage(planReport.image, 'Plano operativo del informe', 'plan')
      if (selected('plan', 'resources')) {
        if (planReport.resources) planContent += '<h3>Recursos</h3>' + rowsTable([['name', 'Nombre'], ['type', 'Tipo'], ['information', 'Información'], ['latitude', 'Latitud'], ['longitude', 'Longitud']], planReport.resources)
        else issues.push(createReportIssue('plan', 'No disponibles.', { kind: 'representation', resourceId: 'resources', label: 'Recursos' }))
      }
    }
    planContent = '<section data-report-section="plan"><h2>Plano operativo</h2>' + notices('plan') + planContent + '</section>'
  }
  let boardContent = ''
  if (selection.board?.length) {
    if (!boardReport) missingSection('board', 'Pizarra')
    else if (!boardReport.omittedSection) {
      if (selected('board', 'image') && !boardReport.omittedImage) {
        if (!boardReport.image || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(boardReport.image)) {
          if (boardReport.image || !issues.some(issue => issue.section === 'board')) issues.push(createReportIssue('board', 'No disponible.'))
          boardContent += '<p class="report-unavailable">Imagen no disponible.</p>'
        } else boardContent += `<figure><img class="report-map-image" src="${escape(boardReport.image)}" alt="Pizarra del informe">${reportLegend('board', boardReport.legend)}</figure>`
      }
      if (selected('board', 'notes')) boardContent += '<h3>Notas</h3>' + rowsTable([['title', 'Título'], ['text', 'Texto']], boardReport.notes)
    }
    boardContent = '<section data-report-section="board"><h2>Pizarra</h2>' + notices('board') + boardContent + '</section>'
  }
  const coordinates: Record<string, string>[] = []
  if (selection.coordinates?.length && coordinateInput.trim()) {
    const parsed = parseCoordinate(coordinateInput)
    const coordinate = parsed.ok ? parsed.coordinate : null
    const system = coordinate?.format === 'UTM'
      ? `WGS 84 / UTM ${coordinate.zone}${UTM_BANDS.indexOf(coordinate.band) < UTM_BANDS.indexOf('N') ? 'S' : 'N'} · Banda ${coordinate.band}`
      : coordinate ? `WGS 84 (EPSG:4326) · ${coordinate.format}` : 'No reconocido'
    coordinates.push({ value: parsed.ok ? parsed.normalizedInput : coordinateInput.trim(), system })
  }
  let weatherContent = ''
  if (selected('weather', 'aemet')) {
    const snapshot = weatherReport.aemet, data = snapshot?.data
    weatherContent += '<h3>AEMET</h3>' + (snapshot ? `<p>Ubicación: ${text(snapshot.location)}</p>` : '')
    if (!snapshot || !data) weatherContent += '<p>Sin datos.</p>'
    else {
      weatherContent += `<p>Consulta: ${text(formatWeatherDate(data.retrievedAt, data.periodsTimeZone))}<br>Web AEMET: ${text(data.resourceUpdatedAt ? formatWeatherDate(data.resourceUpdatedAt, data.periodsTimeZone) : 'Actualización no indicada')}</p>`
      if (snapshot.previous || data.stale) weatherContent += '<p>Se muestra una consulta anterior.</p>'
      weatherContent += rowsTable([['period', 'Fecha y periodo · ' + data.periodsTimeZone], ['information', 'Información'], ['value', 'Valor']], forecastReportRows(data))
      const details = snapshot.warningDetails
      if (details) {
        weatherContent += `<h4>Detalle de avisos</h4><p>${text([details.zone, details.province, details.date].filter(Boolean).join(' · '))}<br>Consulta: ${text(formatWeatherDate(details.retrievedAt, data.periodsTimeZone))}`
        if (details.resourceUpdatedAt) weatherContent += `<br>Web de avisos: ${text(formatWeatherDate(details.resourceUpdatedAt, data.periodsTimeZone))}`
        weatherContent += '</p>'
        if (details.stale) weatherContent += '<p>Se muestra un detalle anterior.</p>'
        weatherContent += rowsTable([['phenomenon', 'Fenómeno'], ['level', 'Nivel'], ['value', 'Valor'], ['probability', 'Probabilidad'], ['onset', 'Comienzo'], ['expires', 'Finalización'], ['certainty', 'Certeza'], ['comment', 'Comentario']], details.items.map(item => ({
          phenomenon: item.phenomenonName, level: item.levelName, value: item.value || '—', probability: item.probability || '—',
          onset: formatWeatherDate(item.onset, data.periodsTimeZone), expires: formatWeatherDate(item.expires, data.periodsTimeZone), certainty: item.certaintyName, comment: item.comment || '—',
        })))
      }
      weatherContent += `<p>${text(data.attribution)}<br>${text(data.sourceUrl)}</p>`
    }
  }
  if (selected('weather', 'openMeteo')) {
    const snapshot = weatherReport.openMeteo, data = snapshot?.data
    weatherContent += '<h3>Open-Meteo</h3>' + (snapshot ? `<p>Ubicación consultada: ${text(`${snapshot.point.latitude.toFixed(6)}, ${snapshot.point.longitude.toFixed(6)}`)}</p>` : '')
    if (!snapshot || !data) weatherContent += '<p>Sin datos.</p>'
    else {
      weatherContent += `<p>Dato: ${text(formatWeatherDate(data.validAt, data.timeZone))}<br>Consulta: ${text(formatWeatherDate(data.retrievedAt, data.timeZone))}</p>`
      if (snapshot.previous) weatherContent += '<p>Se muestra una consulta anterior.</p>'
      weatherContent += rowsTable([['information', 'Información'], ['value', 'Valor']], currentWeatherReportRows(data))
      weatherContent += '<p>Estimaciones de modelos meteorológicos · Open-Meteo · CC BY 4.0 · Uso no comercial</p>'
    }
  }
  if (selection.weather?.length) weatherContent = '<section><h2>Meteorología</h2>' + weatherContent + '</section>'
  let timerContent = ''
  if (selection.timers?.length) {
    if (timerRecords == null) timerContent = '<section><h2>Temporizadores</h2><p>Temporizadores no disponibles.</p></section>'
    else {
      const names = { tzero: 'T-Zero', tminus: 'T-Minus', advisory: 'Advisory' }
      const statuses = { idle: 'Inactivo', running: 'En marcha', paused: 'Pausado', completed: 'Finalizado' }
      const counts = { tzero: 0, tminus: 0, advisory: 0 }
      const rows = timerRecords.map(timer => {
        const snapshot = calculateTimerValue(timer, generatedAt.getTime())
        const value = timer.kind !== 'tzero' && snapshot.status === 'idle' ? timer.durationSeconds : snapshot.valueSeconds
        return { name: `${names[timer.kind]} ${++counts[timer.kind]}`, status: statuses[snapshot.status], value: formatDuration(value) }
      })
      timerContent = table('timers', rows)
    }
  }
  const content = table('elements', resources(false)) + table('dotations', resources(true)) + table('information', operational) + table('operations', operational)
    + table('timeline', timeline) + table('notebook', notebook) + mapContent + planContent + boardContent + table('coordinates', coordinates) + weatherContent + timerContent
  const title = document.document.title || 'Sin nombre'
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>Informe · ${escape(title)}</title>
<style>*{box-sizing:border-box}body{margin:0;background:#e9e9e7;color:#202124;font:14px/1.45 system-ui,sans-serif}header{border-bottom:3px solid #a92323;padding-bottom:12px}h1{overflow-wrap:anywhere}h2{margin-top:26px;border-bottom:1px solid #aaa;font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #ddd;padding:6px;overflow-wrap:anywhere;word-break:break-word}thead{background:#eee}figure{margin:12px 0;break-inside:avoid}.report-map-image{display:block;max-width:100%;width:auto;height:auto}figcaption{font-size:11px;margin-top:4px;overflow-wrap:anywhere}
.report-legend{font-size:12px;margin-top:8px}.report-legend h3{font-size:12px;margin:0 0 4px}.report-legend ul{display:flex;flex-wrap:wrap;gap:6px 14px;list-style:none;margin:0;padding:0}.report-legend li{display:flex;align-items:center;gap:6px;max-width:100%;break-inside:avoid}.report-legend img{flex:none;width:48px;height:30px;object-fit:contain}.report-legend span{overflow-wrap:anywhere}
.report-unavailable{border-left:3px solid #a92323;padding:4px 8px;overflow-wrap:anywhere}
${reportPageStyles(page)}</style></head><body><main>
<header><p>Angie Dashboard · Informe</p><h1>${escape(title)}</h1><p>Documento creado: ${escape(formatTimelineDate(document.document.createdAt))}<br>Última edición: ${escape(formatTimelineDate(document.document.updatedAt))}<br>Informe generado: ${escape(formatTimelineDate(generatedAt.toISOString()))}</p></header>
${issues.length ? `<p class="report-unavailable">${issues.some(issue => !issue.omitted) ? 'Informe incompleto: recursos no disponibles.' : 'Informe con recursos omitidos.'}</p>` : ''}${content}</main></body></html>`
  return { filename: `informe_${generatedAt.toISOString().replace(/[:.]/g, '-')}_${crypto.randomUUID()}.html`, html, issues }
}
