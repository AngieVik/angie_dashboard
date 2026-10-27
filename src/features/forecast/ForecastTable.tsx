import { Fragment, useId, useLayoutEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '../../components/ui/button'
import type { ForecastCell, ForecastData, ForecastField, ForecastWarningDetails } from './forecastTypes'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { useForecastWarning } from './useForecastWarning'

const labels: Record<ForecastField, readonly [string, string]> = {
  estado_cielo: ['Cielo', ''], temp: ['Temperatura', 'mín./máx. °C'], sen_termica: ['Sensación térmica', 'mín./máx. °C'],
  prob_prec: ['Precipitación', 'probabilidad %'], humedad_rel: ['Humedad', 'mín./máx. %'], dir_viento: ['Viento', 'km/h'], avisos: ['Avisos', 'zona meteorológica'],
}

function warningKey(prefix: string, index: number, href: string, title: string) { return `${prefix}:${index}:${href}:${title}` }
function warningDate(value: string) { return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)} ${value.slice(11, 16)} (UTC${value.endsWith('Z') ? '' : value.slice(19)})` }

function ForecastValue({ cell, prefix, expandedWarning, onToggleWarning, detailsId }: {
  cell: ForecastCell; prefix: string; expandedWarning: string | null; onToggleWarning: (key: string) => void; detailsId: string
}) {
  const { blocked, blockedRef } = useViewportInteraction()
  if (cell.missing) return <span title={cell.title}>—</span>
  if (cell.warnings.length) return <div className="forecast-warnings">{cell.warnings.map((warning, index) => {
    const key = warningKey(prefix, index, warning.href, warning.title), expanded = expandedWarning === key
    return <span key={key} className="forecast-warning" data-level={warning.level}>
      <a href={warning.href} target="_blank" rel="noopener noreferrer" title={warning.title}
        aria-disabled={blocked} tabIndex={blocked ? -1 : 0} onClick={event => { if (blockedRef.current) event.preventDefault() }}>{warning.text}</a>
      <Button className="forecast-warning-toggle" aria-label={(expanded ? 'Ocultar detalle: ' : 'Mostrar detalle: ') + warning.text}
        title={warning.title || warning.text} aria-expanded={expanded} aria-controls={detailsId} disabled={blocked}
        onClick={() => { if (!blockedRef.current) onToggleWarning(key) }}><ChevronDown aria-hidden="true" /></Button>
    </span>
  })}</div>
  return <div className="forecast-value">
    {cell.images.map((image, index) => <img key={index} src={image.src} alt={image.alt} title={image.title} referrerPolicy="no-referrer" />)}
    {cell.text ? <span>{cell.text}</span> : !cell.images.length && <span aria-label="Sin dato publicado">—</span>}
  </div>
}

export function ForecastTable({ data, onContentChange, onWarningReportChange }: { data: ForecastData; onContentChange: () => void; onWarningReportChange?: (details: ForecastWarningDetails | null) => void }) {
  const [expandedWarning, setExpandedWarning] = useState<string | null>(null)
  const warningsId = useId()
  const { blocked, blockedRef } = useViewportInteraction()
  const warnings = data.rows.find(row => row.id === 'avisos')?.cells ?? []
  const selectedWarning = warnings.flatMap((cell, cellIndex) => {
    let column = warnings.slice(0, cellIndex).reduce((sum, previous) => sum + previous.colSpan, 0), dayIndex = 0
    while (data.days[dayIndex] && column >= data.days[dayIndex]!.colSpan) { column -= data.days[dayIndex]!.colSpan; dayIndex++ }
    const dayTitle = data.days[dayIndex]?.text ?? '', expectedDay = Number(dayTitle.match(/\b(\d{1,2})\s*$/)?.[1]) || null
    return cell.warnings.map((warning, index) => ({ ...warning, expectedDay, dayTitle, key: warningKey('avisos:' + cellIndex, index, warning.href, warning.title) }))
  })
    .find(warning => warning.key === expandedWarning)
  const day = selectedWarning ? new URL(selectedWarning.href).searchParams.get('w') : null
  const slug = new URL(data.sourceUrl).pathname.split('/').at(-1) ?? ''
  const details = useForecastWarning(slug, day, selectedWarning?.expectedDay ?? null, Boolean(selectedWarning && selectedWarning.level < 4 && selectedWarning.phenomenon), data.retrievedAt)
  useLayoutEffect(() => { onWarningReportChange?.(details.data) }, [details.data, onWarningReportChange])
  const detailItems = details.data?.items.filter(item => item.phenomenon === selectedWarning?.phenomenon) ?? []
  useLayoutEffect(() => { onContentChange() }, [onContentChange, selectedWarning?.key, details.data, details.error, details.loading])
  return <table className="forecast-table" style={{ '--forecast-columns': data.periods.length } as CSSProperties}>
    <caption className="forecast-caption">Pronóstico de {data.municipality}. Periodos horarios {data.periodsTimeZone}.</caption>
    <colgroup><col className="forecast-label-column" />{data.periods.map((_period, index) => <col key={index} />)}</colgroup>
    <thead>
      <tr><th rowSpan={2} scope="col" className="forecast-label">Fecha <span className="forecast-unit">{data.periodsTimeZone}</span></th>
        {data.days.map((day, index) => <th key={index} colSpan={day.colSpan} scope="colgroup" title={day.title}>{day.text}</th>)}</tr>
      <tr>{data.periods.map((period, index) => <th key={index} scope="col" title={'Periodo ' + period.text + ' h ' + data.periodsTimeZone}>{period.text}</th>)}</tr>
    </thead>
    <tbody>{data.rows.map(row => <Fragment key={row.id}><tr>
      <th scope="row" className="forecast-label" title={row.title || row.label}>
        {labels[row.id][0]}
        <span className="forecast-unit">{labels[row.id][1]}</span></th>
      {row.cells.map((cell, index) => <td key={index} colSpan={cell.colSpan} title={[cell.title, ...cell.titles].filter(Boolean).join('\n')}>
        <ForecastValue cell={cell} prefix={row.id + ':' + index} expandedWarning={expandedWarning} detailsId={warningsId}
          onToggleWarning={key => setExpandedWarning(value => value === key ? null : key)} /></td>)}
    </tr>{row.id === 'avisos' && <tr hidden={!selectedWarning} id={warningsId}><td colSpan={data.periods.length + 1} className="forecast-warning-details">
      {selectedWarning && <a href={selectedWarning.href} target="_blank" rel="noopener noreferrer" aria-disabled={blocked} tabIndex={blocked ? -1 : 0}
        className="forecast-warning-detail-title" onClick={event => { if (blockedRef.current) event.preventDefault() }}>{selectedWarning.dayTitle} · {selectedWarning.title || selectedWarning.text}</a>}
      {selectedWarning && selectedWarning.level < 4 && <>
        {!selectedWarning.phenomenon && <p className="forecast-detail-status" role="status">No se pudo identificar el fenómeno. Consulta el aviso oficial.</p>}
        {selectedWarning.phenomenon && !selectedWarning.expectedDay && <p className="forecast-detail-status" role="status">No se pudo identificar el día. Actualiza el pronóstico.</p>}
        {details.loading && <p className="forecast-detail-status" role="status">Consultando detalle de AEMET…</p>}
        {details.error && <p className="forecast-detail-status" role="alert">{details.error}</p>}
        {details.data?.stale && <p className="forecast-detail-status" role="status">No se pudo actualizar. Se muestra un detalle anterior.</p>}
        {details.data && !detailItems.length && <p className="forecast-detail-status" role="status">El detalle actual de AEMET no contiene este fenómeno. Actualiza el pronóstico.</p>}
        {detailItems.map(item => <article key={item.id} className="forecast-detail-item">
          <h4>{item.certaintyName} · {item.phenomenonName}</h4>
          <dl className="forecast-detail-fields">
            <div><dt>Nivel de aviso</dt><dd>{item.levelName}</dd></div>
            <div><dt>Valor</dt><dd>{item.value || '—'}</dd></div>
            <div><dt>Probabilidad</dt><dd>{item.probability || '—'}</dd></div>
            <div><dt>Zona de avisos</dt><dd>{[details.data?.zone, details.data?.province].filter(Boolean).join(' · ') || '—'}</dd></div>
            <div><dt>Comienzo</dt><dd><time dateTime={item.onset}>{warningDate(item.onset)}</time></dd></div>
            <div><dt>Finalización</dt><dd><time dateTime={item.expires}>{warningDate(item.expires)}</time></dd></div>
            <div className="forecast-detail-comment"><dt>Comentario</dt><dd>{item.comment || '—'}</dd></div>
          </dl>
        </article>)}
        {details.data && <div className="forecast-dates">
          <span>Consulta de avisos: {new Date(details.data.retrievedAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' })}</span>
          {details.data.resourceUpdatedAt && <span title="Fecha de modificación del recurso web; no es la fecha de emisión del aviso.">Web de avisos: {new Date(details.data.resourceUpdatedAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' })}</span>}
        </div>}
      </>}
    </td></tr>}</Fragment>)}</tbody>
  </table>
}
