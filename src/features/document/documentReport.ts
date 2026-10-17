import type { AngieDocument } from '../../domain/document/types'
import { getTimelineEntryLabel, isCurrentTimelineEntry, isTimelineEntryCorrected, isTimelineEntryDeleted } from '../../domain/operations/timelineProjection'
import { formatTimelineDate } from '../timeline/timelineCommands'

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function escape(value: string) {
  return value.replace(/[&<>"']/g, character => entities[character]!)
}

export function createDocumentReport(document: AngieDocument, generatedAt: Date) {
  const title = document.document.title || 'Sin nombre'
  const entries = new Map(document.timeline.map(entry => [entry.id.toLowerCase(), entry]))
  const pins = new Map(document.plan?.pins.map(pin => [pin.elementId.toLowerCase(), pin]))
  const units = document.elements.filter(element => element.isUnit).length
  const resourceRows = document.elements.map(element => {
    const current = element.isUnit ? entries.get(element.operational.currentEntryId?.toLowerCase() ?? '') : undefined
    const status = !element.isUnit ? '—' : element.operational.status === 'Personalizada'
      ? current?.type === 'status-change' ? current.customLabel || 'Personalizada' : 'Personalizada'
      : element.operational.status || 'Sin estado'
    const pin = pins.get(element.id.toLowerCase())
    return `<tr><th scope="row">${escape(element.name)}</th><td>${element.isUnit ? 'Dotación' : 'Elemento'}</td><td>${escape(status)}</td><td>${element.isUnit ? element.operational.tags.map(escape).join('<br>') : '—'}</td><td class="text">${escape(element.information)}</td><td>${pin ? `${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}` : 'Sin ubicación'}</td></tr>`
  }).join('')
  const timelineRows = document.timeline.map(entry => {
    const condition = isTimelineEntryDeleted(entry) ? 'Eliminada' : isTimelineEntryCorrected(entry) ? 'Corregida' : isCurrentTimelineEntry(document, entry) ? 'Actual' : 'Registrada'
    return `<tr><td>${escape(formatTimelineDate(entry.occurredAt))}</td><td>${entry.type === 'manual' ? 'Manual' : 'Estado'}</td><td class="text">${escape(getTimelineEntryLabel(entry))}</td><td>${condition}</td></tr>`
  }).join('')
  const notebook = document.notebook.map(block => `<article><h3>${escape(block.title)}</h3>${block.type === 'note'
    ? `<p class="text">${escape(block.text)}</p>`
    : `<ul class="checklist">${block.items.map(item => `<li>${item.checked ? '☑' : '☐'} ${escape(item.text)}</li>`).join('')}</ul>`}</article>`).join('')
  const gpxRows = (document.map?.gpx ?? []).map(file => `<tr><th scope="row">${escape(file.name)}</th><td>${(file.size / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} KiB</td><td>${file.visible ? 'Visible' : 'Oculto'}</td><td class="fingerprint">${escape(file.fingerprint)}</td></tr>`).join('')
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Informe · ${escape(title)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#e9e9e7;color:#202124;font:14px/1.45 system-ui,sans-serif}main{max-width:1100px;margin:28px auto;padding:32px;background:#fff}header{border-bottom:3px solid #a92323;padding-bottom:16px}.brand{margin:0;color:#a92323;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase}h1{margin:6px 0 12px;font-size:30px;line-height:1.15;overflow-wrap:anywhere}h2{margin:28px 0 10px;padding-bottom:5px;border-bottom:1px solid #aaa;font-size:18px}h3{margin:12px 0 6px;font-size:15px}.metadata{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-size:12px}.metadata span{display:block;color:#666}.id{margin:10px 0 0;font-size:11px;overflow-wrap:anywhere;color:#666}.summary{display:flex;flex-wrap:wrap;gap:20px;margin:16px 0;font-size:13px}.summary strong{font-size:20px;margin-right:5px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:7px 6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;overflow-wrap:anywhere}thead th{background:#f0f0ee;font-size:11px;text-transform:uppercase}tbody th{font-weight:600}.text{white-space:pre-wrap}.fingerprint{font:10px/1.4 ui-monospace,monospace;word-break:break-all;max-width:300px}.checklist{padding:0;list-style:none;white-space:pre-wrap}article{break-inside:avoid}.empty{color:#666;font-size:13px}footer{border-top:1px solid #aaa;margin-top:30px;padding-top:10px;color:#666;font-size:11px}@page{size:A4;margin:12mm}@media print{body{background:#fff;font-size:10pt}main{max-width:none;margin:0;padding:0}h1{font-size:22pt}h2{font-size:13pt;break-after:avoid}thead{display:table-header-group}tr{break-inside:avoid}table{font-size:8pt}th,td{padding:5px 4px}.metadata{font-size:9pt}a{color:inherit;text-decoration:none}}
</style></head><body><main>
<header><p class="brand">Angie Dashboard · Informe</p><h1>${escape(title)}</h1><div class="metadata"><div><span>Documento creado</span>${escape(formatTimelineDate(document.document.createdAt))}</div><div><span>Última edición</span>${escape(formatTimelineDate(document.document.updatedAt))}</div><div><span>Informe generado</span>${escape(formatTimelineDate(generatedAt.toISOString()))}</div></div><p class="id">ID: ${escape(document.document.id)} · Fechas en Europe/Madrid</p></header>
<div class="summary"><div><strong>${units}</strong>dotaciones</div><div><strong>${document.elements.length - units}</strong>elementos</div><div><strong>${document.timeline.length}</strong>entradas registradas</div><div><strong>${document.map?.gpx.length ?? 0}</strong>GPX</div></div>
<section><h2>Recursos y dotaciones</h2>${resourceRows ? `<table><thead><tr><th scope="col">Nombre</th><th scope="col">Tipo</th><th scope="col">Estado</th><th scope="col">Etiquetas</th><th scope="col">Información</th><th scope="col">Coordenadas del plano</th></tr></thead><tbody>${resourceRows}</tbody></table>` : '<p class="empty">Sin recursos.</p>'}</section>
<section><h2>Registro cronológico</h2>${timelineRows ? `<table><thead><tr><th scope="col">Fecha y hora</th><th scope="col">Tipo</th><th scope="col">Contenido</th><th scope="col">Condición</th></tr></thead><tbody>${timelineRows}</tbody></table>` : '<p class="empty">Sin entradas.</p>'}</section>
<section><h2>Cuaderno</h2>${notebook || '<p class="empty">Sin bloques.</p>'}</section>
<section><h2>Referencias de GPX</h2>${gpxRows ? `<table><thead><tr><th scope="col">Archivo original</th><th scope="col">Tamaño</th><th scope="col">Visibilidad</th><th scope="col">Huella SHA-256</th></tr></thead><tbody>${gpxRows}</tbody></table><p class="empty">Referencias de archivos GPX externos. El informe no incorpora los recorridos.</p>` : '<p class="empty">Sin GPX asociados.</p>'}</section>
<footer>Instantánea del documento en la fecha indicada. Los temporizadores y la sesión local no forman parte del informe. Para imprimir o guardar como PDF, utiliza la opción Imprimir del navegador.</footer>
</main></body></html>`
  return { filename: `informe_${generatedAt.toISOString().replace(/[:.]/g, '-')}_${crypto.randomUUID()}.html`, html }
}
