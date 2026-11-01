import L from 'leaflet'
import type { LoadedGpx } from './gpx'
import { iterateKilometerMarks } from './gpxMetrics'

// One task queue for every file and both Mapa/Plano. Each step builds at most
// 256 vertices or 16 dots. No job owns a long loop over the full GPX.
const jobs = new Set<Generator<void>>()
let timer: ReturnType<typeof setTimeout> | undefined
let maximumStepMs = 0, maximumSliceMs = 0
function schedule() {
  if (timer !== undefined || !jobs.size) return
  timer = setTimeout(() => {
    timer = undefined
    const start = performance.now(), deadline = start + 4
    do {
      const job = jobs.values().next().value
      if (!job) break
      jobs.delete(job)
      const stepStart = performance.now()
      if (!job.next().done) jobs.add(job)
      maximumStepMs = Math.max(maximumStepMs, performance.now() - stepStart)
    } while (performance.now() < deadline && jobs.size)
    maximumSliceMs = Math.max(maximumSliceMs, performance.now() - start)
    schedule()
  }, 0)
}
function enqueue(job: Generator<void>) { jobs.add(job); schedule(); return () => { jobs.delete(job); job.return(undefined); if (!jobs.size && timer !== undefined) { clearTimeout(timer); timer = undefined } } }

// Diagnostics count owned jobs/layers, without retaining maps or geometries.
let ownedLayers = 0
export function gpxLayerMemory() { return { jobs: jobs.size, layers: ownedLayers, maximumStepMs, maximumSliceMs } }

interface LayerTask { key: string; data: LoadedGpx['data']; group: L.LayerGroup; cancel: () => void; count: number }
export class GpxLayers {
  private geometry = new Map<string, LayerTask>()
  private kilometers = new Map<string, LayerTask>()
  constructor(private map: L.Map) {}
  private remove(entries: Map<string, LayerTask>, id: string) {
    const task = entries.get(id)
    if (!task) return
    task.cancel(); task.group.remove(); task.group.clearLayers()
    ownedLayers -= task.count; task.count = 0; entries.delete(id)
  }
  private add(task: LayerTask, layer: L.Layer) { task.group.addLayer(layer); task.count++; ownedLayers++ }
  sync(files: readonly LoadedGpx[], zoom: number) {
    const visible = files.filter(file => file.visible)
    const labeled = visible.filter(file => file.kilometers)
    const labelBudget = Math.floor(1000 / Math.max(1, labeled.length))
    for (const id of this.geometry.keys()) if (!visible.some(file => file.id === id)) this.remove(this.geometry, id)
    for (const id of this.kilometers.keys()) if (!labeled.some(file => file.id === id)) this.remove(this.kilometers, id)
    for (const file of visible) {
      const key = file.color
      const previous = this.geometry.get(file.id)
      if (!previous || previous.key !== key || previous.data !== file.data) {
        this.remove(this.geometry, file.id)
        const task: LayerTask = { key, data: file.data, group: L.layerGroup().addTo(this.map), cancel: () => {}, count: 0 }
        this.geometry.set(file.id, task)
        task.cancel = enqueue(this.drawGeometry(task, file))
      }
      if (file.kilometers) {
        const key = `${file.color}/${file.kilometerInterval}/${zoom}/${labelBudget}`
        const previous = this.kilometers.get(file.id)
        if (!previous || previous.key !== key || previous.data !== file.data) {
          this.remove(this.kilometers, file.id)
          const task: LayerTask = { key, data: file.data, group: L.layerGroup().addTo(this.map), cancel: () => {}, count: 0 }
          this.kilometers.set(file.id, task)
          task.cancel = enqueue(this.drawKilometers(task, file, zoom, labelBudget))
        }
      }
    }
  }
  private *drawGeometry(task: LayerTask, file: LoadedGpx): Generator<void> {
    const color = file.color
    let dots = 0
    for (const line of file.data.lines) {
      if (line.length === 1) {
        const point = line[0]!
        this.add(task, L.circleMarker([point.latitude, point.longitude], { radius: 4, color, interactive: false }))
        if (++dots % 16 === 0) yield
      } else for (let start = 0; start < line.length - 1; start += 255) {
        const points: L.LatLngTuple[] = []
        for (let i = start; i < Math.min(start + 256, line.length); i++) points.push([line[i]!.latitude, line[i]!.longitude])
        // Neighboring chunks share their boundary point; distinct GPX segments
        // never connect. This affects only the visual layer, never calculations.
        this.add(task, L.polyline(points, { color, weight: 3, interactive: false }))
        yield
      }
    }
    for (const point of file.data.waypoints) {
      const marker = L.circleMarker([point.latitude, point.longitude], { radius: 5, color, weight: 2, fillColor: color, fillOpacity: 1 })
      if (point.name) { const label = document.createElement('span'); label.textContent = point.name; marker.bindTooltip(label) }
      this.add(task, marker)
      if (++dots % 16 === 0) yield
    }
  }
  private *drawKilometers(task: LayerTask, file: LoadedGpx, zoom: number, budget: number): Generator<void> {
    for (const mark of iterateKilometerMarks(file.data, Math.max(file.kilometerInterval ?? 1, 2 ** (13 - zoom)), budget)) {
      if (mark) {
        const label = document.createElement('span')
        label.textContent = mark.kilometer.toLocaleString('es-ES'); label.style.borderColor = file.color
        label.title = 'PK ' + mark.kilometer.toLocaleString('es-ES')
        this.add(task, L.marker([mark.point.latitude, mark.point.longitude], {
          icon: L.divIcon({ className: 'map-kilometer', html: label, iconSize: [30, 20], iconAnchor: [15, 10] }),
          interactive: false, keyboard: false, zIndexOffset: 200,
        }))
      }
      yield
    }
  }
  dispose() {
    for (const id of this.geometry.keys()) this.remove(this.geometry, id)
    for (const id of this.kilometers.keys()) this.remove(this.kilometers, id)
  }
}
