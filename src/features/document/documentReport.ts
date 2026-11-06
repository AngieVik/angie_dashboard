import type { AngieDocument } from '../../domain/document/types'
import { getTimelineEntryLabel, isCurrentTimelineEntry, isTimelineEntryCorrected, isTimelineEntryDeleted } from '../../domain/operations/timelineProjection'
import { getTimelineIndex } from '../../domain/operations/operationIndexes'
import { formatTimelineDate } from '../timeline/timelineCommands'
import { calculateTimerValue, formatDuration } from '../clock/timerEngine'
import type { TimerRecord } from '../clock/timerTypes'
import { reportPageStyles } from './reportPagination'
import { DEFAULT_REPORT_PAGE } from './reportPageOptions'
import type { ReportPageOptions } from './reportPageOptions'
import { REPORT_SECTIONS, defaultReportSelection } from './reportSections'
import type { ReportSection, ReportSelection } from './reportSections'
import reportStyles from './documentReport.css?raw'

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function escape(value: string) { return value.replace(/[&<>"']/g, character => entities[character]!) }
function text(value: string) { return escape(value).replace(/\n/g, '<br>') }

export function createDocumentReport(document: AngieDocument, generatedAt: Date, fontStyles: string, selection: ReportSelection = defaultReportSelection(), timerRecords?: readonly TimerRecord[] | null, page: ReportPageOptions = DEFAULT_REPORT_PAGE) {
  const selected = (section: ReportSection, field: string) => selection[section]?.includes(field) ?? false
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
  const currentEntries = getTimelineIndex(document.timeline).byId
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
    + table('timeline', timeline) + table('notebook', notebook) + timerContent
  const title = document.document.title || 'Sin nombre'
  const dates = { createdAt: document.document.createdAt, updatedAt: document.document.updatedAt, generatedAt: generatedAt.toISOString() }
  const metadata = Object.entries(REPORT_SECTIONS.metadata.fields)
    .filter(([field]) => selected('metadata', field))
    .map(([field, label]) => `${escape(label)}: ${escape(formatTimelineDate(dates[field as keyof typeof dates]))}`)
    .join('<br>')
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:"><title>Informe · ${escape(title)}</title>
<style>${fontStyles}
${reportStyles}
${reportPageStyles(page)}</style></head><body><main>
<header><p>Angie Dashboard · Informe</p><h1>${escape(title)}</h1>${metadata ? `<p>${metadata}</p>` : ''}</header>
${content}</main></body></html>`
  return { filename: `informe_${generatedAt.toISOString().replace(/[:.]/g, '-')}_${crypto.randomUUID()}.html`, html }
}
