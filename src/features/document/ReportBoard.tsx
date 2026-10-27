import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { AngieDocument, AssetId } from '../../domain/document/types'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { readBoardFrame, subscribeBoardFrame } from '../board/boardViewport'
import type { BoardFrame } from '../board/boardViewport'
import { useDocumentStore } from './documentStore'
import type { DocumentStore } from './documentStore'
import { createBoardReport, DEFAULT_BOARD_REPORT_LAYERS } from './boardReport'
import type { BoardReportLayers, ReportBoardHandle } from './boardReport'
import { ReportMapArea } from './ReportMapArea'
import type { ReportMapArea as Area, ReportMapFraming } from './reportMapFraming'
import { createReportIssue, formatReportIssue } from './reportIssues'
import type { ReportIssue } from './reportIssues'
import framingStyles from './reportFraming.module.css'
import styles from './ReportBoard.module.css'

interface BoardPreview {
  document: AngieDocument
  requestedFrame: BoardFrame | undefined
  resourceIds: string[]
  layers: BoardReportLayers
  frame?: BoardFrame
  image?: string
  error?: string
  issues?: ReportIssue[]
  iconPixels?: Map<AssetId, string>
  fontFamily?: string
}

export function ReportBoard({ store, captureRef }: { store: DocumentStore; captureRef: RefObject<ReportBoardHandle | null> }) {
  const { document: currentDocument, documentGeneration } = useDocumentStore(store)
  const { blocked, blockedRef } = useViewportInteraction()
  const documentId = currentDocument.document.id
  const [framing, setFraming] = useState<ReportMapFraming>('content')
  const [includeHidden, setIncludeHidden] = useState(false)
  const [layers, setLayers] = useState(() => ({ ...DEFAULT_BOARD_REPORT_LAYERS }))
  const [excludedResources, setExcludedResources] = useState<string[]>([])
  const [areaFrame, setAreaFrame] = useState<BoardFrame>()
  const [area, setArea] = useState<Area>({ x: .1, y: .1, width: .8, height: .8 })
  const [sourceFrame, setSourceFrame] = useState(() => readBoardFrame(documentId))
  const [preview, setPreview] = useState<BoardPreview | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const viewport = useRef<HTMLDivElement>(null), areaGesture = useRef(false)
  const resources = useMemo(() => currentDocument.elements.filter(element => element.position), [currentDocument.elements])
  const availableResources = useMemo(() => resources.filter(element => element.pinVisible || includeHidden), [resources, includeHidden])
  const resourceIds = useMemo(() => {
    const excluded = new Set(excludedResources)
    return availableResources.filter(element => !excluded.has(element.id.toLowerCase())).map(element => element.id.toLowerCase())
  }, [availableResources, excludedResources])
  const included = useMemo(() => new Set(resourceIds), [resourceIds])
  const requestedFrame = framing === 'current' ? sourceFrame ?? undefined : framing === 'area' ? areaFrame : undefined
  const canPrepare = framing === 'current' ? Boolean(sourceFrame) : framing === 'area' ? Boolean(areaFrame) : true
  const current = preview !== null && preview.document === currentDocument && preview.requestedFrame === requestedFrame && preview.resourceIds === resourceIds && preview.layers === layers
  const ready = canPrepare && current && Boolean(preview?.image && preview.frame)

  useEffect(() => subscribeBoardFrame(documentId, () => setSourceFrame(readBoardFrame(documentId))), [documentId])
  useEffect(() => {
    if (!canPrepare) return
    const controller = new AbortController()
    const snapshot = structuredClone(currentDocument)
    void createBoardReport(snapshot, ['image'], { frame: requestedFrame, signal: controller.signal, resourceIds, layers }).then(report => {
      if (!controller.signal.aborted) setPreview({ document: currentDocument, requestedFrame, resourceIds, layers, frame: report.frame, image: report.image,
        issues: report.issues, iconPixels: report.iconPixels, fontFamily: report.fontFamily, error: report.issues?.length ? report.issues.map(formatReportIssue).join(' ') : undefined })
    }).catch(error => {
      if (!controller.signal.aborted) setPreview({ document: currentDocument, requestedFrame, resourceIds, layers, error: error instanceof Error ? error.message : 'No se pudo preparar Pizarra.' })
    })
    return () => controller.abort()
  }, [currentDocument, requestedFrame, canPrepare, resourceIds, layers])
  useLayoutEffect(() => {
    const node = viewport.current
    if (!node) return
    const observer = new ResizeObserver(() => setSize({ width: node.clientWidth, height: node.clientHeight }))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    const handle: ReportBoardHandle = { capture() {
      const snapshot = store.getSnapshot()
      if (!snapshot.active || snapshot.replacing || snapshot.documentGeneration !== documentGeneration || snapshot.document !== currentDocument || blockedRef.current) throw new Error('El UIBoard no está disponible para generar el informe.')
      if (areaGesture.current) throw new Error('Termina de ajustar el área de Pizarra antes de generar el informe.')
      const frameMissing = framing === 'current' && !sourceFrame || framing === 'area' && !areaFrame
      const prepared = { iconPixels: current && preview?.iconPixels ? new Map(preview.iconPixels) : undefined, fontFamily: current ? preview?.fontFamily : undefined, frameMissing }
      const frame = frameMissing ? undefined : current ? preview?.frame : requestedFrame
      const capturedFrame = frame ? framing === 'area' ? { x: frame.x + area.x * frame.width, y: frame.y + area.y * frame.height, width: area.width * frame.width, height: area.height * frame.height } : { ...frame } : undefined
      if (!ready || !preview?.frame) return { ...prepared, frame: capturedFrame, resourceIds: [...resourceIds], layers: { ...layers },
        blockedImage: current && preview?.issues?.length ? [...preview.issues] : [createReportIssue('board', current && preview?.error ? preview.error : 'La imagen de Pizarra no está disponible.')] }
      return { ...prepared, frame: capturedFrame, resourceIds: [...resourceIds], layers: { ...layers } }
    } }
    captureRef.current = handle
    return () => { if (captureRef.current === handle) captureRef.current = null }
  }, [store, documentGeneration, currentDocument, blockedRef, framing, sourceFrame, current, preview, ready, area, areaFrame, captureRef, resourceIds, layers, requestedFrame])

  const frame = ready ? preview?.frame : undefined
  const scale = frame && size.width && size.height ? Math.min(size.width / frame.width, size.height / frame.height) : 0
  return <div className={`reports-map ${framingStyles.base} ${styles.base}`}>
    <h3>Pizarra</h3>
    {resources.length > 0 && <label><Checkbox checked={includeHidden} disabled={blocked} onCheckedChange={nextChecked => setIncludeHidden(nextChecked)} />Incluir ocultos</label>}
    <div className="reports-map-selection"><fieldset disabled={blocked}><legend>Recursos</legend>
      {availableResources.length ? availableResources.map(element => <label key={element.id}><Checkbox disabled={blocked} checked={included.has(element.id.toLowerCase())} onCheckedChange={nextChecked => {
        const id = element.id.toLowerCase(), checked = nextChecked
        setExcludedResources(current => checked ? current.filter(value => value !== id) : [...current, id])
      }} />{element.name}{!element.pinVisible && <span className="reports-resource-state">Oculto</span>}</label>) : <span>{resources.length ? 'Sin recursos visibles.' : 'Sin recursos.'}</span>}
    </fieldset></div>
    <div className="reports-map-toolbar" role="group" aria-label="Encuadre: Pizarra">
      <Select aria-label="Encuadre: Pizarra" value={framing} disabled={blocked} onValueChange={next => {
        if (next === 'area') {
          if (!ready || !preview?.frame) return
          setAreaFrame({ ...preview.frame }); setFraming(next)
        } else if (next === 'content' || next === 'current' && sourceFrame) setFraming(next)
      }} options={[{ value: 'content', label: 'Contenido seleccionado' }, { value: 'area', label: 'Área seleccionada', disabled: !ready }, { value: 'current', label: 'Vista actual', disabled: !sourceFrame }]} />
      {(Object.entries({ background: 'Fondo', names: 'Nombres', notes: 'Notas', strokes: 'Trazos', legend: 'Leyenda' }) as [keyof BoardReportLayers, string][]).map(([id, label]) => <label key={id}>
        <Checkbox checked={layers[id]} disabled={blocked} onCheckedChange={nextChecked => setLayers(current => ({ ...current, [id]: nextChecked }))} />{label}
      </label>)}
    </div>
    <div ref={viewport} className="reports-map-viewport" data-map-surface role="region" aria-label="Encuadre: Pizarra">
      {frame && <div className="reports-map-render" style={{ width: frame.width * scale, height: frame.height * scale, left: '50%', top: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)' }}>
        <img className="reports-board-image" src={preview?.image} alt="Pizarra del informe" draggable={false} />
        {framing === 'area' && <ReportMapArea area={area} disabled={blocked} busyRef={areaGesture} onChange={setArea} />}
      </div>}
    </div>
    {!ready && <p className={current && preview?.error ? 'reports-map-notice' : undefined} role="status">{current && preview?.error ? preview.error : 'Preparando pizarra…'}</p>}
  </div>
}
