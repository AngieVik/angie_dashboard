import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { REPORT_SECTIONS, defaultReportSelection } from './documentReport'
import type { ReportSection, ReportSelection } from './documentReport'
import type { DocumentStore } from './documentStore'
import { WorkDirectoryDialog } from './PermissionsDialog'
import type { LoadedGpx } from '../map/gpx'
import type { ReportMapHandle } from './mapReport'
import type { ReportBoardHandle } from './boardReport'
import type { WeatherReportContent } from './weatherReport'
import type { TimerRecord } from '../clock/timerTypes'
import { formatReportIssue, reportIssueKey } from './reportIssues'
import type { ReportIssue, ReportResourceAction } from './reportIssues'
import { DEFAULT_REPORT_PAGE } from './reportPagination'
import type { ReportPageOptions } from './reportPagination'
import './reports.css'

const ReportMap = lazy(() => import('./ReportMap').then(module => ({ default: module.ReportMap })))
const ReportBoard = lazy(() => import('./ReportBoard').then(module => ({ default: module.ReportBoard })))

export function ReportsModule({ store, files, onFilesChange, getCoordinatesInput, getWeatherReport, getTimerRecords }: { store: DocumentStore; files: LoadedGpx[]; onFilesChange: (files: LoadedGpx[]) => void; getCoordinatesInput: () => string; getWeatherReport: () => WeatherReportContent; getTimerRecords: () => readonly TimerRecord[] | null }) {
  const [selection, setSelection] = useState<ReportSelection>(defaultReportSelection)
  const [pageOptions, setPageOptions] = useState<ReportPageOptions>(() => ({ ...DEFAULT_REPORT_PAGE }))
  const [preview, setPreview] = useState<Awaited<ReturnType<DocumentStore['generateReport']>>>(null)
  const [status, setStatus] = useState<{ message: string; error: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewReady, setPreviewReady] = useState(false)
  const [directoryNeeded, setDirectoryNeeded] = useState(false)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const saveRequest = useRef(false)
  const generationRequest = useRef(false)
  const directoryButton = useRef<HTMLButtonElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const mapCapture = useRef<ReportMapHandle | null>(null)
  const planCapture = useRef<ReportMapHandle | null>(null)
  const boardCapture = useRef<ReportBoardHandle | null>(null)
  const fitPreview = useCallback(() => {
    const node = frame.current, doc = node?.contentDocument, main = doc?.querySelector<HTMLElement>('main.report-pages')
    const page = main?.querySelector<HTMLElement>('.report-page')
    if (!doc || !main || !page?.offsetWidth) return
    let wrapper = doc.querySelector<HTMLElement>('.report-preview')
    if (!wrapper) {
      wrapper = doc.createElement('div'); wrapper.className = 'report-preview'
      main.before(wrapper); wrapper.append(main)
      const style = doc.createElement('style')
      style.textContent = '@media screen{.report-preview{position:relative;overflow:hidden;height:var(--preview-height)}.report-preview main.report-pages{position:absolute;top:0;left:0;width:var(--preview-width);transform:scale(var(--preview-scale));transform-origin:top left}}'
      doc.head.append(style)
    }
    const scale = Math.min(1, Math.max(1, doc.documentElement.clientWidth - 16) / page.offsetWidth)
    wrapper.style.setProperty('--preview-width', page.offsetWidth + 'px')
    wrapper.style.setProperty('--preview-scale', String(scale))
    wrapper.style.setProperty('--preview-height', main.scrollHeight * scale + 'px')
  }, [])
  useEffect(() => {
    const node = frame.current
    if (!node) return
    const observer = new ResizeObserver(fitPreview)
    observer.observe(node)
    return () => observer.disconnect()
  }, [preview?.report.filename, fitPreview])
  const any = Object.values(selection).some(fields => fields && fields.length)
  function toggleField(section: ReportSection, field: string, checked: boolean) {
    setSelection(current => ({ ...current, [section]: checked ? [...(current[section] ?? []), field] : (current[section] ?? []).filter(value => value !== field) }))
  }
  async function generate() {
    if (generationRequest.current || saveRequest.current) return
    generationRequest.current = true
    setGenerating(true); setStatus(null)
    try {
      const mapReport = selection.map?.length ? mapCapture.current?.capture(pageOptions) : undefined
      const planReport = selection.plan?.length ? planCapture.current?.capture(pageOptions) : undefined
      const boardRequest = selection.board?.includes('image') ? boardCapture.current?.capture() : undefined
      const coordinateInput = selection.coordinates?.length ? getCoordinatesInput() : undefined
      const weatherReport = selection.weather?.length ? getWeatherReport() : undefined
      const timerRecords = selection.timers?.length ? getTimerRecords() : undefined
      const generated = await store.generateReport(selection, mapReport, planReport, boardRequest, coordinateInput, weatherReport, timerRecords, pageOptions)
      if (!generated) return
      setPreviewReady(false); setPreview(generated); setStatus(generated.report.issues.some(issue => !issue.omitted) ? { message: 'Informe incompleto: recursos no disponibles.', error: true } : null); setDirectoryNeeded(false)
    } catch (error) { setStatus({ message: error instanceof Error ? error.message : 'No se pudo generar el informe.', error: true }) }
    finally { generationRequest.current = false; setGenerating(false) }
  }
  async function resolveResource(issue: ReportIssue, action: ReportResourceAction) {
    if (!preview || generationRequest.current || saveRequest.current) return
    generationRequest.current = true; setGenerating(true); setStatus(null)
    try {
      const result = await preview.resolveResource(issue, action)
      if (!result) return
      setPreviewReady(false); setPreview(result); setDirectoryNeeded(false)
      if (result.report.issues.some(issue => !issue.omitted)) setStatus({ message: 'Informe incompleto: recursos no disponibles.', error: true })
    } catch (error) { setStatus({ message: error instanceof Error ? error.message : 'No se pudo resolver el recurso.', error: true }) }
    finally { generationRequest.current = false; setGenerating(false) }
  }
  async function save() {
    if (!preview || saveRequest.current || generationRequest.current) return
    saveRequest.current = true
    setSaving(true); setStatus(null); setDirectoryNeeded(false)
    try {
      const result = await store.saveGeneratedReport(preview.document, preview.report)
      setStatus({ message: result.status === 'saved' ? 'Informe guardado: ' + result.path : result.status === 'error' ? result.message : 'Carpeta de trabajo sin configurar.', error: result.status !== 'saved' })
      setDirectoryNeeded(result.status === 'unconfigured' || (result.status === 'error' && Boolean(result.permissionRequired)))
    } catch (error) { setStatus({ message: error instanceof Error ? error.message : 'No se pudo guardar el informe.', error: true }) }
    finally { saveRequest.current = false; setSaving(false) }
  }
  return <div className="reports-module">
    <div className="reports-map-toolbar reports-page-toolbar" role="group" aria-label="Formato del informe">
      <span>A4</span><label>Orientación<select aria-label="Orientación del informe" value={pageOptions.orientation} disabled={generating || saving} onChange={event => {
        const orientation = event.target.value
        if (orientation === 'portrait' || orientation === 'landscape') setPageOptions(current => ({ ...current, orientation }))
      }}><option value="portrait">Vertical</option><option value="landscape">Horizontal</option></select></label>
      <label>Calidad<select aria-label="Calidad del informe" value={pageOptions.quality} disabled={generating || saving} onChange={event => {
        const quality = event.target.value
        if (quality === 'normal' || quality === 'high') setPageOptions(current => ({ ...current, quality }))
      }}><option value="normal">Normal · 150 ppp</option><option value="high">Alta · 300 ppp</option></select></label>
    </div>
    <div className="reports-sections">
      {(Object.entries(REPORT_SECTIONS) as [ReportSection, typeof REPORT_SECTIONS[ReportSection]][]).map(([id, section]) => <fieldset key={id} disabled={generating}>
        <legend><label><input type="checkbox" checked={selection[id]?.length === Object.keys(section.fields).length} ref={node => { if (node) node.indeterminate = Boolean(selection[id]?.length && selection[id]!.length < Object.keys(section.fields).length) }} onChange={event => setSelection(current => ({ ...current, [id]: event.target.checked ? Object.keys(section.fields) : [] }))} />{section.title}</label></legend>
        {Object.entries(section.fields).map(([field, label]) => <label key={field}><input type="checkbox" checked={selection[id]?.includes(field) ?? false} onChange={event => toggleField(id, field, event.target.checked)} />{label}</label>)}
      </fieldset>)}
    </div>
    {Boolean(selection.map?.length) && <Suspense fallback={<p role="status">Cargando mapa…</p>}>
      <ReportMap store={store} files={files} onFilesChange={onFilesChange} fields={selection.map!} captureRef={mapCapture} />
    </Suspense>}
    {Boolean(selection.plan?.length) && <Suspense fallback={<p role="status">Cargando plano operativo…</p>}>
      <ReportMap kind="plan" store={store} files={files} onFilesChange={onFilesChange} fields={selection.plan!} captureRef={planCapture} />
    </Suspense>}
    {selection.board?.includes('image') && <Suspense fallback={<p role="status">Preparando pizarra…</p>}>
      <ReportBoard store={store} captureRef={boardCapture} />
    </Suspense>}
    <div className="reports-actions"><Button disabled={!any || saving || generating} onClick={() => { void generate() }}>{generating ? 'Generando…' : preview ? 'Actualizar informe' : 'Generar vista previa'}</Button>
      {preview && <><Button disabled={saving || generating} onClick={() => { void save() }}>{saving ? 'Guardando…' : 'Guardar informe'}</Button>
        <Button disabled={!previewReady || generating} onClick={() => {
          try {
            const target = frame.current?.contentWindow
            if (!target) throw new Error('Vista previa no disponible.')
            target.print()
          } catch { setStatus({ message: 'No se pudo abrir la impresión.', error: true }) }
        }}>Imprimir / PDF</Button>
        <Button disabled={generating} onClick={() => {
          try { store.downloadReport(preview.report); setStatus({ message: 'Descarga de informe iniciada.', error: false }) }
          catch { setStatus({ message: 'No se pudo descargar el informe.', error: true }) }
        }}>Descargar informe</Button></>}
    </div>
    {preview && <div className="reports-resource-issues">{preview.report.issues.filter(issue => !issue.omitted).map(issue => <div key={reportIssueKey(issue)} className="reports-resource-actions" role="group" aria-label={REPORT_SECTIONS[issue.section].title + ': ' + issue.label}>
      <span>{REPORT_SECTIONS[issue.section].title} · {formatReportIssue(issue)}</span>
      <Button disabled={generating || saving} onClick={() => { void resolveResource(issue, 'retry') }}>Reintentar</Button>
      <Button disabled={generating || saving} onClick={() => { void resolveResource(issue, 'omit') }}>Omitir</Button>
    </div>)}</div>}
    {status && <Alert role={status.error ? 'alert' : 'status'}><span>{status.message}</span>
      {directoryNeeded && <Button ref={directoryButton} disabled={saving} onClick={() => setDirectoryOpen(true)}>Carpeta de trabajo</Button>}
    </Alert>}
    {preview && <iframe key={preview.report.filename} ref={frame} title="Vista previa del informe" sandbox="allow-same-origin allow-modals" srcDoc={preview.report.html} onLoad={() => { fitPreview(); setPreviewReady(true) }} />}
    {directoryOpen && <WorkDirectoryDialog onClose={() => setDirectoryOpen(false)} onCloseFocus={() => directoryButton.current?.focus()}
      onContinueLocally={() => store.continueLocally()} onDirectoryAuthorized={() => store.saveWorkspaceNow()} />}
  </div>
}
