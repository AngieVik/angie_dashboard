import { renderAnalysis, markdownTable as table, sourceReference } from './findings.mjs'
import { createProjectContext, isCode } from './project.mjs'
import { collectUnusedCode } from './unused-code.mjs'

const kinds = ['runtime', 'type', 'dynamic', 'worker', 'url', 'resolution']
const ordered = values => [...values].sort((a, b) => a.localeCompare(b, 'en'))
const edgeKey = edge => `${edge.from}\0${edge.to}\0${edge.dependencyType}\0${edge.kind}\0${edge.specifier}`
const edgeOrder = (a, b) => edgeKey(a).localeCompare(edgeKey(b), 'en') || a.line - b.line
const counts = edges => Object.fromEntries(kinds.map(kind => [kind, edges.filter(edge => edge.dependencyType === kind).length]))

export function areaForFile(file) {
  const parts = file.split('/')
  if (parts[0] !== 'src') return 'fuera de src'
  if (parts.length === 2) return 'raíz'
  if (['features', 'domain'].includes(parts[1]) && parts.length > 3) return `${parts[1]}/${parts[2]}`
  if (parts[1] === 'components' && parts[2] === 'ui') return 'components/ui'
  return parts[1]
}

// Iterative Kosaraju with deterministic ordering, no recursion limit or
// enumeration of every circuit. A component can contain overlapping cycles.
export function stronglyConnectedComponents(nodes, edges) {
  const names = ordered(new Set(nodes)), valid = new Set(names)
  const outgoing = new Map(names.map(name => [name, new Set()]))
  const incoming = new Map(names.map(name => [name, new Set()]))
  for (const { from, to } of edges) if (valid.has(from) && valid.has(to)) {
    outgoing.get(from).add(to); incoming.get(to).add(from)
  }
  const visited = new Set(), finished = []
  for (const start of names) {
    if (visited.has(start)) continue
    visited.add(start)
    const stack = [{ node: start, next: 0, targets: ordered(outgoing.get(start)) }]
    while (stack.length) {
      const frame = stack.at(-1)
      if (frame.next >= frame.targets.length) { finished.push(frame.node); stack.pop(); continue }
      const target = frame.targets[frame.next++]
      if (!visited.has(target)) {
        visited.add(target); stack.push({ node: target, next: 0, targets: ordered(outgoing.get(target)) })
      }
    }
  }
  visited.clear()
  const components = []
  for (const start of finished.reverse()) {
    if (visited.has(start)) continue
    const members = [], stack = [start]
    visited.add(start)
    while (stack.length) {
      const node = stack.pop()
      members.push(node)
      for (const target of incoming.get(node)) if (!visited.has(target)) { visited.add(target); stack.push(target) }
    }
    members.sort((a, b) => a.localeCompare(b, 'en'))
    if (members.length > 1 || outgoing.get(start).has(start)) components.push(members)
  }
  return components.sort((a, b) => a.join('|').localeCompare(b.join('|'), 'en'))
}

function witness(members, edges) {
  const start = members[0], outgoing = new Map(members.map(file => [file, []]))
  for (const edge of edges) outgoing.get(edge.from).push(edge)
  const first = outgoing.get(start)[0]
  if (first.to === start) return [first]
  const queue = [first.to], previous = new Map([[first.to, null]])
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const edge of outgoing.get(queue[cursor])) {
      if (previous.has(edge.to)) continue
      previous.set(edge.to, edge)
      if (edge.to === start) {
        const route = []
        for (let target = start; target !== first.to;) {
          const step = previous.get(target)
          route.push(step); target = step.from
        }
        return [first, ...route.reverse()]
      }
      queue.push(edge.to)
    }
  }
  throw new Error('Componente cíclico sin recorrido cerrado verificable.')
}

function cycleGroups(files, edges, detached) {
  return stronglyConnectedComponents(files, edges).map(members => {
    const memberSet = new Set(members), internal = edges.filter(edge => memberSet.has(edge.from) && memberSet.has(edge.to))
    const detachedFiles = members.filter(file => detached.has(file))
    return { members, areas: ordered(new Set(members.map(areaForFile))), edges: internal, witness: witness(members, internal),
      connectedFiles: members.length - detachedFiles.length, detachedFiles, counts: counts(internal) }
  })
}

export function analyzeImportGraph(files, inputEdges, detachedFiles = []) {
  const names = ordered(new Set(files)), included = new Set(names), detached = new Set(detachedFiles)
  const uncertainties = []
  const edges = inputEdges.filter(edge => included.has(edge.from) && included.has(edge.to)).flatMap(edge => {
    if (!kinds.includes(edge.dependencyType)) {
      uncertainties.push({ file: edge.from, line: edge.line, kind: 'arista de módulo sin clasificar', expression: `${edge.kind}: ${edge.specifier}` })
      return []
    }
    return [{ ...edge, fromConnected: !detached.has(edge.from), toConnected: !detached.has(edge.to), dependencyType: /\.d\.[cm]?ts$/.test(edge.from) || /\.d\.[cm]?ts$/.test(edge.to) ? 'type' : edge.dependencyType }]
  }).sort(edgeOrder)
  const staticEdges = edges.filter(edge => edge.dependencyType === 'runtime')
  const typedEdges = edges.filter(edge => ['runtime', 'type'].includes(edge.dependencyType))
  const deferredEdges = edges.filter(edge => ['runtime', 'dynamic'].includes(edge.dependencyType))
  const runtimeCycles = cycleGroups(names, staticEdges, detached)
  const runtimeKeys = new Set(runtimeCycles.map(cycle => cycle.members.join('|')))
  const typeRelatedCycles = cycleGroups(names, typedEdges, detached).filter(cycle => !runtimeKeys.has(cycle.members.join('|'))).map(cycle => ({
    ...cycle, containsRuntimeCycle: runtimeCycles.some(runtime => runtime.members.every(file => cycle.members.includes(file))),
    onlyTypes: cycle.counts.runtime === 0,
  }))
  const deferredCycles = cycleGroups(names, deferredEdges, detached).filter(cycle => !runtimeKeys.has(cycle.members.join('|'))).map(cycle => ({
    ...cycle, containsRuntimeCycle: runtimeCycles.some(runtime => runtime.members.every(file => cycle.members.includes(file))),
  }))
  const areaNames = ordered(new Set(names.map(areaForFile)))
  const groups = new Map()
  for (const edge of edges) {
    const from = areaForFile(edge.from), to = areaForFile(edge.to)
    if (from === to) continue
    const key = `${from}\0${to}`
    if (!groups.has(key)) groups.set(key, { from, to, edges: [] })
    groups.get(key).edges.push(edge)
  }
  const relations = [...groups.values()].map(relation => ({ ...relation, counts: counts(relation.edges),
    importerFiles: ordered(new Set(relation.edges.map(edge => edge.from))), targetFiles: ordered(new Set(relation.edges.map(edge => edge.to))),
  })).sort((a, b) => b.importerFiles.length - a.importerFiles.length || b.edges.length - a.edges.length || `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`, 'en'))
  const areaCycles = stronglyConnectedComponents(areaNames, relations.filter(relation => relation.counts.runtime > 0)).map(members => ({
    members, relations: relations.filter(relation => members.includes(relation.from) && members.includes(relation.to) && relation.counts.runtime > 0).map(relation => ({ from: relation.from, to: relation.to, imports: relation.counts.runtime })),
  }))
  const fileMetrics = names.map(file => {
    const incoming = edges.filter(edge => edge.to === file && edge.from !== file), outgoing = edges.filter(edge => edge.from === file && edge.to !== file)
    return { file, area: areaForFile(file), connected: !detached.has(file),
      fanIn: new Set(incoming.map(edge => edge.from)).size, fanOut: new Set(outgoing.map(edge => edge.to)).size,
      runtimeFanIn: new Set(incoming.filter(edge => edge.dependencyType === 'runtime').map(edge => edge.from)).size,
      runtimeFanOut: new Set(outgoing.filter(edge => edge.dependencyType === 'runtime').map(edge => edge.to)).size,
      incoming: counts(incoming), outgoing: counts(outgoing) }
  })
  const areaMetrics = areaNames.map(area => ({ area, files: names.filter(file => areaForFile(file) === area).length,
    fanIn: relations.filter(relation => relation.to === area).length, fanOut: relations.filter(relation => relation.from === area).length,
    incoming: counts(relations.filter(relation => relation.to === area).flatMap(relation => relation.edges)),
    outgoing: counts(relations.filter(relation => relation.from === area).flatMap(relation => relation.edges)),
  }))
  return { edges, runtimeCycles, typeRelatedCycles, deferredCycles, areaCycles, relations, areaMetrics, fileMetrics,
    crossFeatureRelations: relations.filter(relation => relation.from.startsWith('features/') && relation.to.startsWith('features/')),
    uncertainties }
}

export function collectArchitecture(project = createProjectContext(), unused = collectUnusedCode(project)) {
  const files = project.src.filter(isCode)
  const analysis = analyzeImportGraph(files, unused.graph, unused.detachedFiles.map(item => item.file))
  const included = new Set(files)
  const graphGaps = unused.uncertainties.filter(item => included.has(item.file) && !item.kind.startsWith('acceso dinámico a clases'))
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), analysis: 'static-architecture-candidates',
    coverage: { files: files.length, connectedFiles: files.length - unused.detachedFiles.filter(item => included.has(item.file)).length,
      edges: analysis.edges.length, excludedGraphEdges: unused.graph.length - analysis.edges.length, areas: analysis.areaMetrics.length, counts: counts(analysis.edges) },
    ...analysis, uncertainties: [...graphGaps, ...analysis.uncertainties],
  }
}

export function renderArchitecture(report, options = {}) {
  const { sourceRoot } = options
  const files = report.fileMetrics.filter(item=>item.fanIn>0 || item.fanOut>0).toSorted((a,b)=>b.fanIn-a.fanIn || b.fanOut-a.fanOut || a.file.localeCompare(b.file,'en'))
  const metrics = items => table(['Archivo','Conectado desde entradas','Consumidores / dependencias','De valores: consumidores / dependencias'],items.map(item=>[sourceReference(item.file,1,sourceRoot),item.connected,`${item.fanIn} / ${item.fanOut}`,`${item.runtimeFanIn} / ${item.runtimeFanOut}`]))
  return renderAnalysis('architecture',report,[
    '## Datos de referencia · alcance del grafo',
    table(['Archivos','Relaciones locales','Áreas','Relaciones excluidas del grafo de código'],[[report.coverage.files,report.coverage.edges,report.coverage.areas,report.coverage.excludedGraphEdges]]),
    'Los ciclos y relaciones entre funcionalidades aparecen una sola vez en los hallazgos anteriores. Los grupos cíclicos son componentes de archivos, no el número de todos los circuitos posibles.',
    '## Datos de referencia · áreas',
    table(['Área','Archivos','Áreas consumidoras / importadas','Imports salientes de valores / tipos'],report.areaMetrics.map(item=>[item.area,item.files,`${item.fanIn} / ${item.fanOut}`,`${item.outgoing.runtime} / ${item.outgoing.type}`])),
    '## Datos de referencia · proyección circular entre áreas',
    'Una proyección por carpetas puede formar un círculo con archivos independientes. Estos datos no prueban un ciclo entre archivos.',
    table(['Áreas','Relaciones de valores'],report.areaCycles.map(item=>[item.members.join('; '),item.relations.map(edge=>`${edge.from} → ${edge.to} (${edge.imports})`).join('; ')])),
    '## Datos de referencia · consumidores y dependencias por archivo',metrics(files),
    'Los recuentos incluyen tipos y referencias no ejecutables. Las columnas de valores aíslan imports estáticos; no son medidas de tamaño del bundle o coste de ejecución.',
    '## Datos de referencia · workers, URL y resolución',
    table(['Origen','Destino','Tipo','Declaración'],report.edges.filter(edge=>['worker','url','resolution'].includes(edge.dependencyType)).map(edge=>[sourceReference(edge.from,edge.line,sourceRoot),sourceReference(edge.to,1,sourceRoot),edge.dependencyType,`${edge.kind}: ${edge.specifier}`])),
    'Workers tienen contextos de ejecución separados. Una URL o resolución de nombre no acredita ejecución. No se incluyen paquetes externos, CSS, JSON o scripts como nodos del grafo de arquitectura.',
  ],options)
}

