import { point } from 'leaflet'
import type { Map as LeafletMap, TileLayer } from 'leaflet'
import type { AssetId, MapGpxReference, MapMarker } from '../../domain/document/types'
import type { LoadedGpx } from '../map/gpx'
import { readGpxFile } from '../map/gpxFileAccess'
import { getGpxMetrics } from '../map/gpxMetrics'
import { MAP_BACKGROUNDS, PNOA_INFORMATION } from '../map/mapBackgrounds'
import type { MapBackground } from '../map/mapBackgrounds'
import { ICON_CATALOG } from '../elements/iconCatalog'
import { coversReportArea, createMapReportLegend, drawReportMap, drawReportMapScale } from './mapReport'
import type { MapReportContent } from './mapReport'
import { getPlanReportResourceBounds } from './planReport'
import type { PlanReportDrawing } from './planReport'
import type { ReportMapCrop } from './reportMapFraming'
import { freezeReportMapProjection } from './reportMapProjection'
import { freezeReportImage, loadReportImage, renderReportRaster } from './reportImages'
import { DEFAULT_REPORT_PAGE } from './reportPagination'
import type { ReportPageOptions } from './reportPagination'
import { createReportIssue, reportIssueKey } from './reportIssues'
import type { ReportGraphicSection, ReportIssue, ReportRecovery } from './reportIssues'

interface FrozenTile extends ReportMapCrop { source: string; pixels?: string }
interface FrozenLayer { resourceId: string; label: string; tiles: FrozenTile[]; omitted: boolean }

export function createMapReportRecovery(input: {
  documentId: string; section: ReportGraphicSection; map: LeafletMap; layers: TileLayer[]; crop: ReportMapCrop; fields: string[]
  markers: MapMarker[]; references: MapGpxReference[]; files: LoadedGpx[]; labels: boolean; routes: boolean; legend: boolean
  background: MapBackground | null; information: boolean; plan?: PlanReportDrawing; readGpx: (reference: MapGpxReference) => Promise<File | null>
  image?: MapReportContent['image']; page?: ReportPageOptions
}): ReportRecovery<MapReportContent> {
  const projection = freezeReportMapProjection(input.map), crop = { ...input.crop }, fields = [...input.fields]
  const page = { ...(input.page ?? DEFAULT_REPORT_PAGE) }
  const markers = structuredClone(input.markers), routes = input.routes, labels = input.labels
  const preservedImage = input.image ? structuredClone(input.image) : undefined
  let references = structuredClone(input.references), files = structuredClone(input.files), imageEnabled = fields.includes('image'), legendEnabled = input.legend
  const plan = input.plan ? { ...input.plan, resources: structuredClone(input.plan.resources), strokes: structuredClone(input.plan.strokes), images: new Map<AssetId, HTMLImageElement>() } : undefined
  const icons = new Map<AssetId, string>(), iconPaths = new Map<AssetId, string>()
  for (const resource of plan?.resources ?? []) if (resource.element.visual.type === 'asset') {
    const id = resource.element.visual.assetId
    iconPaths.set(id, ICON_CATALOG[id].path)
    const image = input.plan?.images.get(id)
    if (image && !icons.has(id)) { try { icons.set(id, freezeReportImage(image)) } catch { /* Retrying keeps the original icon reference. */ } }
  }
  const metricCanvas = document.createElement('canvas'), metrics = metricCanvas.getContext('2d')
  const represented = new Set(plan?.resources.filter(resource => {
    if (!fields.includes('image') || !metrics) return true
    const box = getPlanReportResourceBounds(metrics, projection, resource, labels, plan!.fontFamily)
    return box.right > crop.left && box.bottom > crop.top && box.left < crop.left + crop.width && box.top < crop.top + crop.height
  }).map(resource => resource.element.id) ?? [])
  metricCanvas.width = metricCanvas.height = 0
  const layerSources = [
    ...(input.background ? [{ resourceId: 'background', label: MAP_BACKGROUNDS[input.background].name, url: MAP_BACKGROUNDS[input.background].url }] : []),
    ...(input.information ? [{ resourceId: 'pnoaInformation', label: 'Callejero IGN', url: PNOA_INFORMATION.url }] : []),
  ]
  const zoom = Math.round(input.map.getZoom()), scale = input.map.getZoomScale(input.map.getZoom(), zoom), world = 2 ** zoom
  const origin = input.map.project(input.map.containerPointToLatLng([0, 0]), zoom)
  const bounds = input.map.getContainer().getBoundingClientRect(), mapSize = input.map.getSize()
  const frozenLayers: FrozenLayer[] = layerSources.map((source, index) => {
    const size = input.layers[index]?.getTileSize() ?? point(256, 256)
    const known = new Map<string, HTMLImageElement>()
    const positions = new Map<string, ReportMapCrop[]>()
    for (const image of input.layers[index]?.getContainer()?.querySelectorAll<HTMLImageElement>('img.leaflet-tile') ?? []) {
      if (image.complete && image.naturalWidth && image.classList.contains('leaflet-tile-loaded')) known.set(image.src, image)
      const rect = image.getBoundingClientRect()
      if (bounds.width && bounds.height && rect.width && rect.height) positions.set(image.src, [...(positions.get(image.src) ?? []), {
        left: (rect.left - bounds.left) * mapSize.x / bounds.width, top: (rect.top - bounds.top) * mapSize.y / bounds.height,
        width: rect.width * mapSize.x / bounds.width, height: rect.height * mapSize.y / bounds.height,
      }])
    }
    const saved = new Map<string, string>(), tiles: FrozenTile[] = []
    const x1 = Math.floor((origin.x + crop.left / scale) / size.x) - 1, x2 = Math.ceil((origin.x + (crop.left + crop.width) / scale) / size.x) + 1
    const y1 = Math.max(0, Math.floor((origin.y + crop.top / scale) / size.y) - 1), y2 = Math.min(world, Math.ceil((origin.y + (crop.top + crop.height) / scale) / size.y) + 1)
    let offset: { x: number; y: number } | undefined
    for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) {
      const url = source.url.replace('{z}', String(zoom)).replace('{x}', String((x % world + world) % world)).replace('{-y}', String(world - 1 - y)).replace('{y}', String(y))
      const image = known.get(url)
      if (image && !saved.has(url)) { try { saved.set(url, freezeReportImage(image)) } catch { /* Keep its exact URL for a user-initiated retry. */ } }
      tiles.push({ left: (x * size.x - origin.x) * scale, top: (y * size.y - origin.y) * scale, width: size.x * scale, height: size.y * scale, source: url, pixels: saved.get(url) })
      const tile = tiles[tiles.length - 1]!
      const observed = positions.get(url)?.find(rect => Math.abs(rect.left - tile.left) < 2 && Math.abs(rect.top - tile.top) < 2)
      if (!offset && observed) offset = { x: observed.left - tile.left, y: observed.top - tile.top }
    }
    if (offset) for (const tile of tiles) { tile.left += offset.x; tile.top += offset.y }
    return { resourceId: source.resourceId, label: source.label,
      tiles: tiles.filter(tile => tile.left + tile.width > crop.left && tile.top + tile.height > crop.top && tile.left < crop.left + crop.width && tile.top < crop.top + crop.height), omitted: false }
  })
  const omitted: ReportIssue[] = []
  let fontUnavailable = input.section === 'plan' && document.fonts.status === 'loading'
  const recovery: ReportRecovery<MapReportContent> = { async apply(issue, action) {
    if (action === 'omit') {
      if (!omitted.some(item => reportIssueKey(item) === reportIssueKey(issue))) omitted.push({ ...issue, omitted: true })
      if (issue.kind === 'gpx') { references = references.filter(file => file.id !== issue.resourceId); files = files.filter(file => file.id !== issue.resourceId) }
      else if (issue.kind === 'background') { const layer = frozenLayers.find(layer => layer.resourceId === issue.resourceId); if (layer) layer.omitted = true }
      else if (issue.kind === 'icon' && plan) plan.resources = plan.resources.filter(resource => resource.element.visual.type !== 'asset' || resource.element.visual.assetId !== issue.resourceId)
      else if (issue.kind === 'legend') legendEnabled = false
      else imageEnabled = false
    } else {
      try {
        if (issue.kind === 'gpx') {
          const reference = references.find(file => file.id === issue.resourceId)
          const file = reference ? await input.readGpx(reference) : null
          if (!reference || !file) throw new Error('GPX no disponible.')
          const result = await readGpxFile(file, reference.fingerprint)
          files = [...files.filter(file => file.id !== reference.id), { ...reference, data: result.data }]
        } else if (issue.kind === 'icon') {
          const id = issue.resourceId as AssetId, source = iconPaths.get(id)
          if (!source) throw new Error('Icono no disponible.')
          const pixels = icons.get(id)
          if (pixels) await loadReportImage(pixels)
          else icons.set(id, freezeReportImage(await loadReportImage(source)))
        } else if (issue.kind === 'background') {
          const layer = frozenLayers.find(layer => layer.resourceId === issue.resourceId)
          const results = await Promise.allSettled([...new Set(layer?.tiles.filter(tile => !tile.pixels).map(tile => tile.source) ?? [])].map(async source => [source, freezeReportImage(await loadReportImage(source))] as const))
          for (const result of results) if (result.status === 'fulfilled') for (const tile of layer?.tiles ?? []) if (tile.source === result.value[0]) tile.pixels = result.value[1]
        } else if (issue.resourceId === 'font') { await document.fonts.ready; fontUnavailable = false }
      } catch (error) {
        const result = await render()
        result.issues = result.issues?.map(item => reportIssueKey(item) === reportIssueKey(issue) ? { ...item, message: error instanceof Error ? error.message : 'No disponible.' } : item)
        return result
      }
    }
    return render()
  } }
  async function render(): Promise<MapReportContent> {
    const issues: ReportIssue[] = []
    const neededReferences = fields.includes('gpx') || imageEnabled && routes ? references : []
    for (const reference of neededReferences) if (!files.some(file => file.id === reference.id)) issues.push(createReportIssue(input.section, 'GPX no disponible.', { kind: 'gpx', resourceId: reference.id, label: reference.name }))
    const result: MapReportContent = { documentId: input.documentId, recovery, omittedImage: !imageEnabled,
      markers: structuredClone(markers), gpx: references.map(reference => {
        const file = files.find(file => file.id === reference.id)
        return { name: reference.name, distance: file ? (getGpxMetrics(file.data).totalMeters / 1000).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' km' : '—', points: file ? file.data.pointCount.toLocaleString('es-ES') : '—', availability: file ? 'Disponible' : 'No disponible' }
      }) }
    if (plan) result.resources = plan.resources.filter(resource => represented.has(resource.element.id)).map(({ element, pin }) => ({ name: element.name, type: element.isUnit ? 'Dotación' : 'Elemento', information: element.information, latitude: pin.latitude.toFixed(6), longitude: pin.longitude.toFixed(6) }))
    if (imageEnabled && preservedImage && !routes) result.image = { ...preservedImage, legend: legendEnabled ? preservedImage.legend : [] }
    else if (imageEnabled) {
      const imageIssues = routes ? [...issues] : []
      if (plan) {
        plan.images = new Map()
        for (const id of new Set(plan.resources.flatMap(resource => resource.element.visual.type === 'asset' ? [resource.element.visual.assetId] : []))) {
          try { const pixels = icons.get(id); if (!pixels) throw new Error('Icono no disponible.'); plan.images.set(id, await loadReportImage(pixels)) }
          catch (error) { imageIssues.push(createReportIssue(input.section, error, { kind: 'icon', resourceId: id, label: ICON_CATALOG[id].name })) }
        }
        if (fontUnavailable) imageIssues.push(createReportIssue(input.section, 'Tipografía no disponible.', { kind: 'representation', resourceId: 'font', label: 'Imagen del plano' }))
      }
      try {
        const tiles: { image: HTMLImageElement; area: FrozenTile }[] = []
        for (const layer of frozenLayers.filter(layer => !layer.omitted)) {
          if (!coversReportArea(layer.tiles, crop) || layer.tiles.some(tile => !tile.pixels)) imageIssues.push(createReportIssue(input.section, 'Cartografía incompleta o no disponible.', { kind: 'background', resourceId: layer.resourceId, label: layer.label }))
          else for (const tile of layer.tiles) {
            try { tiles.push({ image: await loadReportImage(tile.pixels!), area: tile }) }
            catch (error) { imageIssues.push(createReportIssue(input.section, error, { kind: 'background', resourceId: layer.resourceId, label: layer.label })); break }
          }
        }
        if (!imageIssues.length) {
          const drawingFiles = routes ? files : []
          result.image = renderReportRaster(crop.width, crop.height, page, 1, ([context], encode) => {
            if (!context) throw new Error('No se pudo crear la imagen.')
            context.translate(-crop.left, -crop.top); context.fillStyle = '#FFFFFF'; context.fillRect(crop.left, crop.top, crop.width, crop.height)
            for (const { image, area } of tiles) context.drawImage(image, area.left, area.top, area.width, area.height)
            drawReportMap(context, projection, markers, drawingFiles, labels, plan); drawReportMapScale(context, projection, crop)
            return { dataUrl: encode(), background: frozenLayers.some(layer => layer.resourceId === 'background' && !layer.omitted) ? input.background : null,
              pnoaInformation: frozenLayers.some(layer => layer.resourceId === 'pnoaInformation' && !layer.omitted), legend: legendEnabled ? createMapReportLegend(projection, markers, drawingFiles, labels, plan, crop, page.quality) : [] }
          })
        }
      } catch (error) { imageIssues.push(createReportIssue(input.section, error)) }
      for (const issue of imageIssues) if (!issues.some(item => reportIssueKey(item) === reportIssueKey(issue))) issues.push(issue)
    }
    result.issues = [...issues, ...omitted]
    return result
  }
  return recovery
}

export function createMapDataRecovery(content: MapReportContent, sourceReferences: MapGpxReference[], sourceFiles: LoadedGpx[], readGpx: (reference: MapGpxReference) => Promise<File | null>, fields: string[]): ReportRecovery<MapReportContent> {
  let references = structuredClone(sourceReferences), files = structuredClone(sourceFiles)
  const base = { documentId: content.documentId, image: content.image ? structuredClone(content.image) : undefined, markers: structuredClone(content.markers), resources: content.resources ? structuredClone(content.resources) : undefined }
  const otherIssues = (content.issues ?? []).filter(issue => issue.kind !== 'gpx'), omitted: ReportIssue[] = []
  const recovery: ReportRecovery<MapReportContent> = { async apply(issue, action) {
    let failure: string | undefined
    if (action === 'omit') {
      if (issue.kind === 'gpx') { references = references.filter(file => file.id !== issue.resourceId); files = files.filter(file => file.id !== issue.resourceId) }
      else if (issue.kind === 'representation') otherIssues.splice(0)
      else { const index = otherIssues.findIndex(item => reportIssueKey(item) === reportIssueKey(issue)); if (index >= 0) otherIssues.splice(index, 1) }
      omitted.push({ ...issue, omitted: true })
    } else if (issue.kind === 'gpx') {
      try {
        const reference = references.find(file => file.id === issue.resourceId), file = reference ? await readGpx(reference) : null
        if (!reference || !file) throw new Error('GPX no disponible.')
        const result = await readGpxFile(file, reference.fingerprint)
        files = [...files.filter(file => file.id !== reference.id), { ...reference, data: result.data }]
      } catch (error) { failure = error instanceof Error ? error.message : 'GPX no disponible.' }
    } else throw new Error('Preparación no disponible. Actualiza el informe.')
    const imageOmitted = omitted.some(issue => issue.kind === 'representation')
    const preparationIssues = fields.includes('image') && !base.image && !imageOmitted && !otherIssues.some(issue => issue.kind === 'representation' && issue.resourceId === 'image')
      ? [createReportIssue(issue.section, 'Preparación de imagen no disponible.')] : []
    return { ...base, recovery, omittedImage: imageOmitted,
      gpx: references.map(reference => { const file = files.find(file => file.id === reference.id); return { name: reference.name,
        distance: file ? (getGpxMetrics(file.data).totalMeters / 1000).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' km' : '—',
        points: file ? file.data.pointCount.toLocaleString('es-ES') : '—', availability: file ? 'Disponible' : 'No disponible' } }),
      issues: [...otherIssues, ...references.filter(reference => (fields.includes('gpx') || !imageOmitted) && !files.some(file => file.id === reference.id)).map(reference => createReportIssue(issue.section, reference.id === issue.resourceId && failure ? failure : 'GPX no disponible.', { kind: 'gpx', resourceId: reference.id, label: reference.name })), ...preparationIssues, ...omitted] }
  } }
  return recovery
}

