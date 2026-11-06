import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ListFilter, Printer, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ReportSelectionResize } from './ReportSelectionResize'
import { toast } from '@/components/ui/sonner'
import { REPORT_SECTIONS, defaultReportSelection } from './reportSections'
import type { ReportSection, ReportSelection } from './reportSections'
import type { DocumentStore } from './documentStore'
import type { TimerRecord } from '../clock/timerTypes'
import { DEFAULT_REPORT_PAGE } from './reportPageOptions'
import type { ReportPageOptions } from './reportPageOptions'
import styles from './reports.module.css'
import toolbarStyles from '@/layout/moduleToolbar.module.css'

export interface ReportsNotice {
  message: string
  busy: boolean
  onRetry: () => Promise<void>
}

export function ReportsModule({ store, getTimerRecords, onNoticesChange }: { store: DocumentStore; getTimerRecords: () => readonly TimerRecord[] | null; onNoticesChange: (notice: ReportsNotice | null) => void }) {
  const [fields, setFields] = useState<ReportSelection>(() => Object.fromEntries(Object.entries(REPORT_SECTIONS).map(([id, section]) => [id, Object.keys(section.fields)])))
  const [enabledSections, setEnabledSections] = useState(() => Object.entries(defaultReportSelection()).filter(([, fields]) => fields.length).map(([id]) => id as ReportSection))
  const selection = useMemo<ReportSelection>(() => Object.fromEntries(Object.keys(REPORT_SECTIONS).map(id => [id, enabledSections.includes(id as ReportSection) ? fields[id as ReportSection] : []])), [fields, enabledSections])
  const [pageOptions, setPageOptions] = useState<ReportPageOptions>(() => ({ ...DEFAULT_REPORT_PAGE }))
  const [preview, setPreview] = useState<Awaited<ReturnType<DocumentStore['generateReport']>>>(null)
  const [previewSettings, setPreviewSettings] = useState<{ selection: ReportSelection; pageOptions: ReportPageOptions } | null>(null)
  const [selectionOpen, setSelectionOpen] = useState(true)
  const [selectionWidth, setSelectionWidth] = useState(42)
  const workspace = useRef<HTMLDivElement>(null)
  const [sheetContainer, setSheetContainer] = useState<HTMLDivElement | null>(null)
  const [previewScale, setPreviewScale] = useState<'fit' | 'actual'>('fit')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewReady, setPreviewReady] = useState(false)
  const saveRequest = useRef(false)
  const generationRequest = useRef(false)
  const selectionButton = useRef<HTMLButtonElement>(null)
  const selectionPanel = useRef<HTMLDivElement>(null)
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
  const frame = useRef<HTMLIFrameElement>(null)
  const previewDocument = useRef<Document | null>(null)
  const fitPreview = useCallback(() => {
    const node = frame.current, doc = node?.contentDocument, main = doc?.querySelector<HTMLElement>('main.report-pages')
    const page = main?.querySelector<HTMLElement>('.report-page')
    if (!doc || doc !== previewDocument.current || !main || !page?.offsetWidth) return
    let wrapper = doc.querySelector<HTMLElement>('.report-preview')
    if (!wrapper) {
      wrapper = doc.createElement('div'); wrapper.className = 'report-preview'
      main.before(wrapper); wrapper.append(main)
    }
    const width = page.offsetWidth + 32
    const scale = previewScale === 'actual' ? 1 : Math.min(1, Math.max(1, doc.documentElement.clientWidth) / width)
    wrapper.style.setProperty('--preview-width', width + 'px')
    wrapper.style.setProperty('--preview-scale', String(scale))
    wrapper.style.setProperty('--preview-height', main.scrollHeight * scale + 'px')
  }, [previewScale])
  useEffect(() => {
    const node = frame.current
    if (!node) return
    const observer = new ResizeObserver(fitPreview)
    observer.observe(node)
    fitPreview()
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
  const previewCurrent = Boolean(preview && previewSettings?.selection === selection && previewSettings.pageOptions === pageOptions)
  function toggleField(section: ReportSection, field: string, checked: boolean) {
    setFields(current => ({ ...current, [section]: checked ? [...(current[section] ?? []), field] : (current[section] ?? []).filter(value => value !== field) }))
  }
  const generate = useCallback(async () => {
    if (!any || !isCurrent() || generationRequest.current || saveRequest.current) return
    const generation = store.getSnapshot().documentGeneration
    generationRequest.current = true
    setGenerating(true)
    try {
      const { prepareReportTypography } = await import('./reportEngine')
      if (!isCurrent()) return
      await prepareReportTypography()
      const current = store.getSnapshot()
      if (!current.active || current.replacing || current.documentGeneration !== generation) return
      const timerRecords = selection.timers?.length ? getTimerRecords() : undefined
      const generated = await store.generateReport(selection, timerRecords, pageOptions)
      if (!generated || !isCurrent()) return
      setPreviewReady(false); setPreview(generated); setSaveError(null)
      setPreviewSettings({ selection, pageOptions })
    } catch (error) {
      if (isCurrent()) toast.error(error instanceof Error ? error.message : 'No se pudo generar el informe.', { id: noticeId })
    }
    finally { generationRequest.current = false; setGenerating(false) }
  }, [any, store, isCurrent, selection, pageOptions, getTimerRecords, noticeId])
  // Selection changes refresh an existing report; document edits remain explicit.
  useEffect(() => {
    if (!preview || previewCurrent || !any) return
    const timer = setTimeout(() => { void generate() }, 200)
    return () => clearTimeout(timer)
  }, [preview, previewCurrent, any, generate])
  useEffect(() => {
    if (selectionOpen) selectionPanel.current?.focus()
  }, [selectionOpen, sheetContainer])
  const save = useCallback(async () => {
    if (!preview || !previewCurrent || !isCurrent() || saveRequest.current || generationRequest.current) return
    saveRequest.current = true
    setSaving(true)
    try {
      await store.saveGeneratedReport(preview.report)
      if (isCurrent()) setSaveError(null)
    } catch (error) {
      if (isCurrent()) { setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el informe.'); toast.error('No se pudo guardar el informe.', { id: noticeId }) }
    }
    finally { saveRequest.current = false; setSaving(false) }
  }, [preview, previewCurrent, store, isCurrent, noticeId])
  useEffect(() => {
    onNoticesChange(saveError ? { message: saveError, busy: generating || saving, onRetry: save } : null)
  }, [saveError, generating, saving, save, onNoticesChange])
  useEffect(() => () => onNoticesChange(null), [onNoticesChange])
  return <div className={`reports-module ${styles.base}`} data-minimum-scroll-content style={{ '--report-selection-width': selectionWidth + 'cqi' } as CSSProperties}>
    <header className={`${toolbarStyles.base} ${styles.toolbar}`} aria-label="Acciones del informe">
      <Button ref={selectionButton} aria-label="Contenido del informe" title="Contenido del informe" aria-expanded={selectionOpen} aria-controls={`report-selection-${generation}`} onClick={() => setSelectionOpen(open => !open)}><ListFilter aria-hidden="true" /></Button>
      <Button disabled={!any || saving || generating} aria-label="Actualizar informe" title="Actualizar informe" aria-busy={generating} onClick={() => { void generate() }}><RefreshCw aria-hidden="true" /></Button>
      <Button disabled={!previewCurrent || saving || generating} aria-label="Guardar informe" title="Guardar informe" aria-busy={saving} onClick={() => { void save() }}><Save aria-hidden="true" /></Button>
      <Button disabled={!previewCurrent || !previewReady || saving || generating} aria-label="Imprimir / PDF" title="Imprimir / PDF" onClick={() => {
        try {
          const target = frame.current?.contentWindow
          if (!target) throw new Error('Vista previa no disponible.')
          target.print()
        } catch { toast.error('No se pudo abrir la impresión.', { id: noticeId }) }
      }}><Printer aria-hidden="true" /></Button>
      <Select aria-label="Tamaño de la vista previa" value={previewScale} onValueChange={value => {
        if (value === 'fit' || value === 'actual') setPreviewScale(value)
      }} options={[{ value: 'fit', label: 'Ajustar al ancho' }, { value: 'actual', label: 'Tamaño real' }]} />
    </header>
    <div ref={workspace} className={styles.workspace} data-selection-open={selectionOpen}>
      <div ref={setSheetContainer} className={styles.selectionSlot} />
      {sheetContainer && <Sheet open={selectionOpen} onOpenChange={open => {
        setSelectionOpen(open)
        if (!open && selectionOpen) selectionButton.current?.focus()
      }} modal={false}>
        <SheetContent ref={selectionPanel} id={`report-selection-${generation}`} container={sheetContainer} side="left" forceMount showCloseButton={false} className={styles.selectionSheet}
          inert={!selectionOpen} aria-hidden={!selectionOpen || undefined} aria-describedby={undefined}
          onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}
          onInteractOutside={event => event.preventDefault()}>
          <SheetBody className={styles.selectionBody}>
            <SheetHeader><SheetTitle>Contenido del informe</SheetTitle></SheetHeader>
            <fieldset className="reports-page-toolbar" disabled={generating || saving}>
              <legend>Formato · A4</legend>
              <label>Orientación<Select aria-label="Orientación del informe" value={pageOptions.orientation} disabled={generating || saving} onValueChange={orientation => {
                if (orientation === 'portrait' || orientation === 'landscape') setPageOptions(current => ({ ...current, orientation }))
              }} options={[{ value: 'portrait', label: 'Vertical' }, { value: 'landscape', label: 'Horizontal' }]} /></label>
            </fieldset>
            <div className="reports-sections">
              {(Object.entries(REPORT_SECTIONS) as [ReportSection, typeof REPORT_SECTIONS[ReportSection]][]).map(([id, section]) => <fieldset key={id} disabled={generating || saving}>
                <legend><label><Checkbox disabled={generating || saving} checked={enabledSections.includes(id)} aria-controls={`report-fields-${generation}-${id}`} onCheckedChange={checked => setEnabledSections(current => checked ? [...current, id] : current.filter(value => value !== id))} />{section.title}</label></legend>
                {enabledSections.includes(id) && <div id={`report-fields-${generation}-${id}`}>
                  <div className={styles.fields}>
                    {Object.entries(section.fields).map(([field, label]) => <label key={field}><Checkbox disabled={generating || saving} checked={fields[id]?.includes(field) ?? false} onCheckedChange={nextChecked => toggleField(id, field, nextChecked)} />{label}</label>)}
                  </div>
                </div>}
              </fieldset>)}
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>}
      <ReportSelectionResize value={selectionWidth} onChange={setSelectionWidth} container={workspace} controls={`report-selection-${generation}`} disabled={!selectionOpen || generating || saving} className={styles.resizeHandle} />
      <section className={styles.preview} aria-label="Vista previa del informe" aria-busy={generating}>
        {preview && <iframe key={preview.report.filename} ref={frame} title="Vista previa del informe" hidden={!previewCurrent} sandbox="allow-same-origin allow-modals" srcDoc={preview.report.html} onLoad={event => { void loadPreview(event.currentTarget) }} />}
        {!previewCurrent && <p className={styles.empty} role="status">{generating ? 'Actualizando informe…' : !any ? 'Selecciona el contenido del informe.' : preview ? 'Actualiza el informe para ver la selección.' : 'Vista previa'}</p>}
      </section>
    </div>
  </div>
}
