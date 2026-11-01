import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { REPORT_SECTIONS, defaultReportSelection } from './reportSections'
import type { ReportSection, ReportSelection } from './reportSections'
import type { DocumentStore } from './documentStore'
import type { ReportMapHandle } from './mapReport'
import type { ReportBoardHandle } from './boardReport'
import type { TimerRecord } from '../clock/timerTypes'
import type { ReportGraphicSection, ReportIssue, ReportResourceAction } from './reportIssues'
import { DEFAULT_REPORT_PAGE } from './reportPageOptions'
import type { ReportPageOptions } from './reportPageOptions'
import styles from './reports.module.css'

const ReportMap = lazy(() => import('./ReportMap').then(module => ({ default: module.ReportMap })))
const ReportBoard = lazy(() => import('./ReportBoard').then(module => ({ default: module.ReportBoard })))
const WorkDirectoryDialog = lazy(() => import('./PermissionsDialog').then(module => ({ default: module.WorkDirectoryDialog })))

export interface ReportsNotice {
  issues: ReportIssue[]
  preparation: { section: ReportGraphicSection; message: string }[]
  saveError: string | null
  directoryNeeded: boolean
  busy: boolean
  onResolve: (issue: ReportIssue, action: ReportResourceAction) => Promise<void>
  onSave: () => Promise<void>
  onDirectory: () => void
}

export function ReportsModule({ store, getCoordinatesInput, getTimerRecords, onNoticesChange }: { store: DocumentStore; getCoordinatesInput: () => string; getTimerRecords: () => readonly TimerRecord[] | null; onNoticesChange: (notice: ReportsNotice | null) => void }) {
  const [selection, setSelection] = useState<ReportSelection>(defaultReportSelection)
  const [pageOptions, setPageOptions] = useState<ReportPageOptions>(() => ({ ...DEFAULT_REPORT_PAGE }))
  const [preview, setPreview] = useState<Awaited<ReturnType<DocumentStore['generateReport']>>>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [preparationNotices, setPreparationNotices] = useState<Partial<Record<ReportGraphicSection, string>>>({})
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewReady, setPreviewReady] = useState(false)
  const [directoryNeeded, setDirectoryNeeded] = useState(false)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const saveRequest = useRef(false)
  const generationRequest = useRef(false)
  const saveButton = useRef<HTMLButtonElement>(null)
  const mounted = useRef(false)
  const [generation] = useState(() => store.getSnapshot().documentGeneration)
  const noticeId = 'report-' + generation
  const isCurrent = useCallback(() => {
    const snapshot = store.getSnapshot()
    return mounted.current && snapshot.active && !snapshot.replacing && snapshot.documentGeneration === generation
  }, [store, generation])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; toast.dismiss(noticeId) }
  }, [noticeId])
  const showPreparationNotice = useCallback((section: ReportGraphicSection, message: string | null) => {
    setPreparationNotices(current => {
      if ((current[section] ?? null) === message) return current
      const next = { ...current }
      if (message) next[section] = message
      else delete next[section]
      return next
    })
  }, [])
  const openDirectory = useCallback(() => setDirectoryOpen(true), [])
  const frame = useRef<HTMLIFrameElement>(null)
  const previewDocument = useRef<Document | null>(null)
  const mapCapture = useRef<ReportMapHandle | null>(null)
  const planCapture = useRef<ReportMapHandle | null>(null)
  const boardCapture = useRef<ReportBoardHandle | null>(null)
  const fitPreview = useCallback(() => {
    const node = frame.current, doc = node?.contentDocument, main = doc?.querySelector<HTMLElement>('main.report-pages')
    const page = main?.querySelector<HTMLElement>('.report-page')
    if (!doc || doc !== previewDocument.current || !main || !page?.offsetWidth) return
    let wrapper = doc.querySelector<HTMLElement>('.report-preview')
    if (!wrapper) {
      wrapper = doc.createElement('div'); wrapper.className = 'report-preview'
      main.before(wrapper); wrapper.append(main)
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
  async function loadPreview(node: HTMLIFrameElement) {
    const doc = node.contentDocument
    if (!doc) return
    try {
      const { waitForReportFonts } = await import('./reportEngine')
      if (frame.current !== node || node.contentDocument !== doc) return
      await waitForReportFonts(doc)
      if (frame.current !== node || node.contentDocument !== doc) return
      previewDocument.current = doc
      fitPreview(); setPreviewReady(true)
    } catch (error) {
      if (frame.current !== node || node.contentDocument !== doc) return
      previewDocument.current = null
      setPreviewReady(false)
      if (isCurrent()) toast.error(error instanceof Error ? error.message : 'No se pudo preparar la vista previa del informe.', { id: noticeId })
    }
  }
  const any = Object.values(selection).some(fields => fields && fields.length)
  function toggleField(section: ReportSection, field: string, checked: boolean) {
    setSelection(current => ({ ...current, [section]: checked ? [...(current[section] ?? []), field] : (current[section] ?? []).filter(value => value !== field) }))
  }
  async function generate() {
    if (generationRequest.current || saveRequest.current) return
    const generation = store.getSnapshot().documentGeneration
    generationRequest.current = true
    setGenerating(true)
    try {
      const { prepareReportTypography } = await import('./reportEngine')
      if (!isCurrent()) return
      await prepareReportTypography()
      const current = store.getSnapshot()
      if (!current.active || current.replacing || current.documentGeneration !== generation) return
      const mapReport = selection.map?.length ? mapCapture.current?.capture(pageOptions) : undefined
      const planReport = selection.plan?.length ? planCapture.current?.capture(pageOptions) : undefined
      const boardRequest = selection.board?.includes('image') ? boardCapture.current?.capture() : undefined
      const coordinateInput = selection.coordinates?.length ? getCoordinatesInput() : undefined
      const timerRecords = selection.timers?.length ? getTimerRecords() : undefined
      const generated = await store.generateReport(selection, mapReport, planReport, boardRequest, coordinateInput, timerRecords, pageOptions)
      if (!generated || !isCurrent()) return
      setPreviewReady(false); setPreview(generated); setSaveError(null); setDirectoryNeeded(false)
      if (generated.report.issues.some(issue => !issue.omitted)) toast.error('Informe incompleto: recursos no disponibles.', { id: noticeId })
    } catch (error) {
      if (isCurrent()) toast.error(error instanceof Error ? error.message : 'No se pudo generar el informe.', { id: noticeId })
    }
    finally { generationRequest.current = false; setGenerating(false) }
  }
  const resolveResource = useCallback(async (issue: ReportIssue, action: ReportResourceAction) => {
    if (!preview || !isCurrent() || generationRequest.current || saveRequest.current) return
    generationRequest.current = true; setGenerating(true)
    try {
      const result = await preview.resolveResource(issue, action)
      if (!result || !isCurrent()) return
      setPreviewReady(false); setPreview(result); setSaveError(null); setDirectoryNeeded(false)
    } catch (error) { if (isCurrent()) toast.error(error instanceof Error ? error.message : 'No se pudo resolver el recurso.', { id: noticeId }) }
    finally { generationRequest.current = false; setGenerating(false) }
  }, [preview, isCurrent, noticeId])
  const save = useCallback(async () => {
    if (!preview || !isCurrent() || saveRequest.current || generationRequest.current) return
    saveRequest.current = true
    setSaving(true)
    try {
      const result = await store.saveGeneratedReport(preview.document, preview.report)
      if (!isCurrent()) return
      const error = result.status === 'saved' ? null : result.status === 'error' ? result.message : 'Carpeta de trabajo sin configurar.'
      setSaveError(error)
      if (error) toast.error('No se pudo guardar el informe.', { id: noticeId })
      setDirectoryNeeded(result.status === 'unconfigured' || (result.status === 'error' && Boolean(result.permissionRequired)))
    } catch (error) {
      if (isCurrent()) { setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el informe.'); toast.error('No se pudo guardar el informe.', { id: noticeId }) }
    }
    finally { saveRequest.current = false; setSaving(false) }
  }, [preview, store, isCurrent, noticeId])
  useEffect(() => {
    const issues = preview?.report.issues.filter(issue => !issue.omitted) ?? []
    const preparation = preview ? [] : (Object.entries(preparationNotices) as [ReportGraphicSection, string][]).map(([section, message]) => ({ section, message }))
    onNoticesChange(issues.length || preparation.length || saveError ? {
      issues, preparation, saveError, directoryNeeded, busy: generating || saving, onResolve: resolveResource, onSave: save, onDirectory: openDirectory,
    } : null)
  }, [preview, preparationNotices, saveError, directoryNeeded, generating, saving, resolveResource, save, openDirectory, onNoticesChange])
  useEffect(() => () => onNoticesChange(null), [onNoticesChange])
  return <div className={`reports-module ${styles.base}`} data-minimum-scroll-content>
    <div className="reports-page-toolbar" role="group" aria-label="Formato del informe">
      <span>A4</span><label>Orientación<Select aria-label="Orientación del informe" value={pageOptions.orientation} disabled={generating || saving} onValueChange={orientation => {
        if (orientation === 'portrait' || orientation === 'landscape') setPageOptions(current => ({ ...current, orientation }))
      }} options={[{ value: 'portrait', label: 'Vertical' }, { value: 'landscape', label: 'Horizontal' }]} /></label>
      <label>Calidad<Select aria-label="Calidad del informe" value={pageOptions.quality} disabled={generating || saving} onValueChange={quality => {
        if (quality === 'normal' || quality === 'high') setPageOptions(current => ({ ...current, quality }))
      }} options={[{ value: 'normal', label: 'Normal · 150 ppp' }, { value: 'high', label: 'Alta · 300 ppp' }]} /></label>
    </div>
    <div className="reports-sections">
      {(Object.entries(REPORT_SECTIONS) as [ReportSection, typeof REPORT_SECTIONS[ReportSection]][]).map(([id, section]) => <fieldset key={id} disabled={generating}>
        <legend><label><Checkbox disabled={generating} checked={Boolean(selection[id]?.length)} onCheckedChange={nextChecked => setSelection(current => ({ ...current, [id]: nextChecked ? Object.keys(section.fields) : [] }))} />{section.title}</label></legend>
        {Object.entries(section.fields).map(([field, label]) => <label key={field}><Checkbox disabled={generating} checked={selection[id]?.includes(field) ?? false} onCheckedChange={nextChecked => toggleField(id, field, nextChecked)} />{label}</label>)}
      </fieldset>)}
    </div>
    {Boolean(selection.map?.length) && <Suspense fallback={null}>
      <ReportMap store={store} fields={selection.map!} captureRef={mapCapture} onNotice={showPreparationNotice} />
    </Suspense>}
    {Boolean(selection.plan?.length) && <Suspense fallback={null}>
      <ReportMap kind="plan" store={store} fields={selection.plan!} captureRef={planCapture} onNotice={showPreparationNotice} />
    </Suspense>}
    {selection.board?.includes('image') && <Suspense fallback={null}>
      <ReportBoard store={store} captureRef={boardCapture} onNotice={showPreparationNotice} />
    </Suspense>}
    <div className="reports-actions"><Button disabled={!any || saving || generating} onClick={() => { void generate() }}>{generating ? 'Generando…' : preview ? 'Actualizar informe' : 'Generar vista previa'}</Button>
      {preview && <><Button ref={saveButton} disabled={saving || generating} onClick={() => { void save() }}>{saving ? 'Guardando…' : 'Guardar informe'}</Button>
        <Button disabled={!previewReady || generating} onClick={() => {
          try {
            const target = frame.current?.contentWindow
            if (!target) throw new Error('Vista previa no disponible.')
            target.print()
          } catch { toast.error('No se pudo abrir la impresión.', { id: noticeId }) }
        }}>Imprimir / PDF</Button>
        <Button disabled={generating} onClick={() => {
          try { store.downloadReport(preview.report) }
          catch { toast.error('No se pudo descargar el informe.', { id: noticeId }) }
        }}>Descargar informe</Button></>}
    </div>
    {preview && <iframe key={preview.report.filename} ref={frame} title="Vista previa del informe" sandbox="allow-same-origin allow-modals" srcDoc={preview.report.html} onLoad={event => { void loadPreview(event.currentTarget) }} />}
    {directoryOpen && <Suspense fallback={null}><WorkDirectoryDialog onClose={() => setDirectoryOpen(false)} onCloseFocus={() => saveButton.current?.focus()}
      onContinueLocally={() => store.continueLocally()} /></Suspense>}
  </div>
}
