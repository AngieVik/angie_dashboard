import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import console from 'node:console'
import Ajv from 'ajv'
import { root, createProjectContext } from './lib/project.mjs'
import { atomicWrite, isMain } from './lib/runtime.mjs'
import { snapshot, changedInputs, digest } from './lib/snapshot.mjs'
import { collectAppInventory, renderAppInventory } from './lib/app-inventory.mjs'
import { collectUiStyles, renderUiStyles } from './lib/ui-styles.mjs'
import { collectUnusedCode, renderUnusedCode } from './lib/unused-code.mjs'
import { collectUiConsistency, renderUiConsistency } from './lib/ui-consistency.mjs'
import { collectPublicAssets, renderPublicAssets } from './lib/public-assets.mjs'
import { collectDependencies, renderDependencies } from './lib/dependencies.mjs'
import { collectArchitecture, renderArchitecture } from './lib/architecture.mjs'
import { collectFindings, finding, bundleMetrics, diagnosticReport, diagnosticVersion, relateFindings, renderFindings, findingSchema, validateFindings, analysisLabels, markdownTable as table } from './lib/findings.mjs'
import { workflowFolder, workflowRunName, reserveWorkflowRun } from './lib/workflow-paths.mjs'

const directory = path.join(root, workflowFolder)
const analysisVersion = 2
const validate = new Ajv({ allErrors: true }).compile({
  type: 'object', required: ['schemaVersion', 'kind', 'runId', 'profile', 'status', 'input', 'stages', 'findings', 'comparison'],
  properties: {
    schemaVersion: { enum: [1,2] }, kind: { const: 'angie-diagnostics-run' }, runId: { type: 'string', pattern: '^[A-Za-z0-9_-]+$' },
    profile: { enum: ['quick', 'full'] }, status: { enum: ['complete', 'partial', 'failed'] },
    input: { type: 'object', required: ['hash', 'engineHash', 'files', 'git'] },
    stages: { type: 'object', additionalProperties: { type: 'object', required: ['status'], properties: { status: { enum: ['complete', 'partial', 'failed'] } } } },
    findings: { type: 'array', items: { anyOf: [findingSchema, { type: 'object', required: ['id', 'analyzer', 'rule', 'title', 'priority', 'confidence', 'evidence', 'action', 'risk', 'validation', 'fingerprint'], properties: {
      id: { type: 'string' }, analyzer: { type: 'string' }, rule: { type: 'string' }, title: { type: 'string' },
      priority: { enum: ['P1', 'P2', 'P3'] }, confidence: { enum: ['alta', 'media', 'baja'] }, evidence: { type: 'array' },
      action: { type: 'string' }, risk: { type: 'string' }, validation: { type: 'string' }, fingerprint: { type: 'string' },
    } }] } }, comparison: { type: 'object', required: ['status'] },
  },
})

export function validateRun(report) {
  if (!validate(report)) throw new Error(`Contrato de informe inválido: ${validate.errors[0].instancePath} ${validate.errors[0].message}`)
  if (report.analysisVersion !== (report.schemaVersion === 1 ? 1 : analysisVersion)) throw new Error('Versión de análisis incompatible.')
  if (report.schemaVersion === 2) {
    if (report.diagnosticSchemaVersion!==diagnosticVersion) throw new Error('Contrato común de hallazgos incompatible.')
    validateFindings(report.findings)
  }
}

export function loadBaseline(selection, profile) {
  if (selection === 'none') return null
  let id = selection
  if (selection === 'latest') {
    const pointer = path.join(directory, `latest-${profile}.json`)
    if (!fs.existsSync(pointer)) return null
    id = JSON.parse(fs.readFileSync(pointer, 'utf8')).runId
  }
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Baseline no válido: usa un identificador de ejecución, latest o none.')
  const report = JSON.parse(fs.readFileSync(path.join(directory, id, 'report.json'), 'utf8'))
  validateRun(report)
  return report
}

function compareRuns(current, previous) {
  if (!previous) return { status: 'unavailable', reason: 'Sin ejecución anterior seleccionada.' }
  if (current.profile !== previous.profile || current.input.engineHash !== previous.input.engineHash || !current.stableInputs || !previous.stableInputs || previous.status === 'failed') {
    return { status: 'incompatible', baseline: previous.runId, reason: 'Perfil, motor o estabilidad de entradas no compatibles. No se calculan desapariciones.' }
  }
  const comparable = new Set(), skipped = []
  for (const analyzer of ['unused', 'architecture', 'assets', 'dependencies', 'consistency', 'bundle']) {
    const left = current.stages[analyzer], right = previous.stages[analyzer]
    if (!left && !right) continue
    if (!left || !right || left.status === 'failed' || right.status === 'failed' || left.coverageSignature !== right.coverageSignature) skipped.push(analyzer)
    else comparable.add(analyzer)
  }
  const select = report => new Map(report.findings.filter(item => comparable.has(item.analyzer)).map(item => [item.id, item]))
  const now = select(current), before = select(previous)
  const brief = item => ({ id: item.id, title: item.title, analyzer: item.analyzer, priority: item.priority })
  const added = [], changed = [], unchanged = [], noLongerReported = []
  for (const [id, item] of now) {
    if (!before.has(id)) added.push(brief(item))
    else if (item.fingerprint !== before.get(id).fingerprint) changed.push(brief(item))
    else unchanged.push(brief(item))
  }
  for (const [id, item] of before) if (!now.has(id)) noLongerReported.push(brief(item))
  const metrics = comparable.has('bundle') ? Object.entries(current.metrics).map(([name, value]) => ({ name, before: previous.metrics[name], current: value, delta: value - previous.metrics[name] })) : []
  return { status: skipped.length ? 'partial' : 'available', baseline: previous.runId, added, changed, unchanged, noLongerReported, metrics, skipped,
    note: 'Dejar de aparecer no demuestra una corrección; solo compara resultados dentro de una cobertura compatible.' }
}

export function render(report) {
  const state = { complete: 'completo', partial: 'parcial', failed: 'fallido' }
  const counts = report.comparison
  return [
    '# Diagnóstico de Angie Dashboard',
    `Ejecución: ${report.runId}. Perfil: ${report.profile}. Estado: **${state[report.status]}**.`,
    ...(report.organization ? [`Informe anterior reubicado; no es un análisis nuevo. Identificador original: ${report.organization.originalRunId}. La fecha de la carpeta usa Europe/Madrid.`] : []),
    `Inicio: ${report.startedAt}. Fin: ${report.finishedAt}. Commit: ${report.input.git.head ?? 'no disponible'}. Cambios locales: ${report.input.git.dirty ?? 'desconocido'}. Huella: ${report.input.hash}.`,
    'Cada hallazgo se presenta una sola vez, agrupado por análisis de origen y naturaleza. El informe describe hechos, alcance y riesgo del hallazgo; no decide acciones ni prioridades de reparación.',
    '## Estado y alcance',
    table(['Análisis', 'Estado', 'Hallazgos / de ellos limitaciones', 'Datos de la etapa'], Object.entries(analysisLabels).filter(([name])=>name!=='pipeline').map(([name,label])=>{
      const stage=report.stages[name], items=report.findings.filter(item=>item.origins.includes(name))
      return [`${label} (${name})`,stage?state[stage.status]:'No ejecutado',`${items.length} / ${items.filter(item=>item.classification==='limitación').length}`,stage?stage.error??stage.note??'Lectura completada':name==='bundle'?'Disponible en el perfil full':'Fuera de esta ejecución']
    })),
    `${report.findings.length} hallazgos únicos. Un hallazgo cruzado puede tener varios análisis de origen; sus datos y evidencias permanecen reunidos. El estado completo se refiere al análisis, no al funcionamiento de la app.`,
    report.stableInputs ? 'Las entradas inventariadas conservaron su huella durante la ejecución.' : `Las entradas cambiaron durante la ejecución: ${report.changedInputs.join(', ')}. El diagnóstico es parcial y la comparación queda desactivada.`,
    'No se mide el DOM ni se valida el funcionamiento real. El conjunto de archivos, las variables relevantes (solo hashes), las limitaciones explícitas y los informes de cada etapa están en el JSON y los detalles asociados. No se ejecutan migraciones ni se alteran UIBoards u originales.',
    '## Cambios respecto a la referencia',
    counts.added ? table(['Referencia', 'Nuevos', 'Cambiados', 'Sin cambios', 'Dejan de aparecer', 'Etapas excluidas'], [[counts.baseline, counts.added.length, counts.changed.length, counts.unchanged.length, counts.noLongerReported.length, counts.skipped.join(', ') || 'ninguna']]) : counts.reason,
    ...(counts.added ? [
      counts.note,
      table(['Cambio', 'Intervención'], [['nuevo', counts.added], ['cambiado', counts.changed], ['deja de aparecer', counts.noLongerReported]].flatMap(([label, items]) => items.map(item => [label, `${item.title} (${item.id})`]))),
    ] : []),
    ...(counts.metrics?.length ? ['### Diferencia del bundle (bytes)', table(['Medida', 'Antes', 'Ahora', 'Delta'], counts.metrics.map(item => [item.name, item.before, item.current, item.delta]))] : []),
    renderFindings(report.findings,{analyses:[...Object.keys(analysisLabels).filter(name=>report.stages[name]),...(report.findings.some(item=>item.analyzer==='pipeline')?['pipeline']:[])],sourceRoot:'../../../'}),
    '## Informes detallados',
    ...Object.entries(report.stages).filter(([, stage]) => stage.status !== 'failed').map(([name]) => `- [${name}](./${name}/report.md) · [JSON](./${name}/report.json)`),
    '',
  ].join('\n\n')
}

function publish(report, reports, renderers) {
  validateRun(report)
  const { runId, pending, target } = reserveWorkflowRun(directory, report.startedAt, report.profile)
  report.runId = runId
  try {
    validateRun(report)
    for (const [name, data] of Object.entries(reports)) {
      const destination = path.join(pending, name)
      fs.mkdirSync(destination)
      fs.writeFileSync(path.join(destination, 'report.json'), JSON.stringify({ ...data, run: { id: report.runId, inputHash: report.input.hash } }, null, 2) + '\n')
      fs.writeFileSync(path.join(destination, 'report.md'), renderers[name](data,{sourceRoot:'../../../../',relatedReport:'../report.md'}))
    }
    fs.writeFileSync(path.join(pending, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    fs.writeFileSync(path.join(pending, 'report.md'), render(report))
    fs.renameSync(pending, target)
    const pointer = JSON.stringify({ schemaVersion: 1, runId: report.runId, profile: report.profile, status: report.status, report: `${report.runId}/report.md` }, null, 2) + '\n'
    atomicWrite(path.join(directory, 'latest.json'), pointer)
    // Failed stages or changing inputs must not become the automatic reference.
    if (report.stableInputs && !Object.values(report.stages).some(stage => stage.status === 'failed')) atomicWrite(path.join(directory, `latest-${report.profile}.json`), pointer)
  } finally {
    if (fs.existsSync(pending)) fs.rmSync(pending, { recursive: true, force: true })
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Uso: node scripts/diagnose.mjs [--profile quick|full] [--baseline latest|none|ID]\nquick (predeterminado): inventario, limpieza, arquitectura, dependencias, recursos públicos, estilos y coherencia. full: añade build aislado del bundle. Conserva cada ejecución y compara por defecto con la última referencia compatible del mismo perfil. No modifica la app. Salida 0: informe publicado con etapas ejecutadas; 1: error de ejecución o etapa fallida. Un estado parcial por límites conocidos se muestra en el informe.\nDestino: output/diagnostic workflow/AAAA-MM-DD_HH-mm_perfil/report.md (hora Europe/Madrid).')
    return
  }
  let profile = 'quick', baselineSelection = 'latest'
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) profile = args[++i]
    else if (args[i] === '--baseline' && args[i + 1]) baselineSelection = args[++i]
    else throw new Error(`Argumento no reconocido: ${args[i]}. Usa --help.`)
  }
  if (!['quick', 'full'].includes(profile)) throw new Error('Perfil no válido: quick o full.')
  // Vite defaults NODE_ENV during build. Establish that same default before
  // fingerprinting so our own preparation is not mistaken for input drift.
  if (profile === 'full' && process.env.NODE_ENV === undefined) process.env.NODE_ENV = 'production'
  const previous = loadBaseline(baselineSelection, profile)
  const startedAt = new Date().toISOString()
  const input = snapshot()
  const runId = workflowRunName(startedAt, profile)
  const context = createProjectContext(), reports = {}, stages = {}
  const renderers = { inventory: renderAppInventory, unused: renderUnusedCode, architecture: renderArchitecture, dependencies: renderDependencies, assets: renderPublicAssets, styles: renderUiStyles, consistency: renderUiConsistency }
  const stage = async (name, collect) => {
    const start = Date.now()
    console.log(`Analizando ${name}…`)
    try {
      reports[name] = diagnosticReport(name, await collect())
      const gaps = reports[name].uncertainties ?? []
      stages[name] = { status: gaps.length ? 'partial' : 'complete', elapsedMs: Date.now() - start,
        coverageSignature: digest(JSON.stringify({ gaps: gaps.map(item => `${item.file}:${item.kind}:${item.expression}`).sort(), ...(name === 'dependencies' ? { npmVersion: reports[name].npm.version } : {}) })),
        note: gaps.length ? `${gaps.length} limitaciones explícitas de cobertura.` : name === 'inventory'
          ? `${reports[name].files.length} archivos; ${reports[name].components.length} componentes candidatos; ${Object.keys(reports[name].modules.values).length} módulos registrados.` : name === 'styles'
            ? `${reports[name].modules.length} módulos; ${reports[name].surfaces.length} diálogos/alertas; ${reports[name].css.length} hojas CSS.` : name === 'unused'
              ? `${reports[name].detachedFiles.length} archivos sin recorrido; ${reports[name].unusedExports.filter(item=>!item.localReferences).length} declaraciones sin referencia local; ${reports[name].unusedExports.filter(item=>item.localReferences>0).length} exports con uso interno.` : name === 'bundle'
                ? `${reports[name].chunks.length} archivos JavaScript; ${reports[name].precache.files} recursos en precaché.` : name === 'consistency'
          ? `${reports[name].comparisonGroups.length} grupos; ${reports[name].appliedExceptions.length} excepciones verificadas; ${reports[name].ungroupedSurfaces.length} superficies sin equivalencia definida.` : name === 'assets'
            ? `${reports[name].coverage.files} archivos; ${reports[name].missingReferences.length} referencias sin archivo; ${reports[name].duplicates.length} grupos duplicados; ${reports[name].configurationOnly.length} solo por configuración.` : name === 'dependencies'
              ? `${reports[name].coverage.direct} directas; ${reports[name].undeclaredUses.length} usos sin declaración; ${reports[name].reviewCandidates.length} candidatos; ${reports[name].npm.problems.length} problemas npm.` : name === 'architecture'
                ? `${reports[name].runtimeCycles.length} grupos cíclicos de valores; ${reports[name].typeRelatedCycles.length} adicionales con tipos; ${reports[name].deferredCycles.length} con cargas diferidas; ${reports[name].crossFeatureRelations.length} relaciones entre funcionalidades.` : undefined }
    } catch (error) { stages[name] = { status: 'failed', elapsedMs: Date.now() - start, error: error.message } }
  }
  try {
    await stage('inventory', () => collectAppInventory(context))
    await stage('unused', () => collectUnusedCode(context))
    await stage('architecture', () => {
      if (!reports.unused) throw new Error('No se pudo obtener el grafo de consumidores.')
      return collectArchitecture(context, reports.unused)
    })
    await stage('dependencies', () => {
      if (!reports.unused) throw new Error('No se pudo obtener el grafo de consumidores.')
      return collectDependencies(context, reports.unused)
    })
    await stage('assets', () => collectPublicAssets(context, input.files))
    await stage('styles', () => collectUiStyles(context))
    await stage('consistency', () => {
      if (!reports.styles) throw new Error('No se pudo obtener el inventario de estilos.')
      return collectUiConsistency(reports.styles)
    })
  } finally { context.dispose() }
  if (profile === 'full') {
    const bundle = await import('./lib/bundle.mjs')
    renderers.bundle = (report, options) => bundle.renderBundle(report, options)
    await stage('bundle', bundle.collectBundle)
  }
  const after = snapshot(), changed = changedInputs(input, after)
  const findings = collectFindings(reports)
  for (const [name, value] of Object.entries(stages)) if (value.status === 'failed') findings.unshift(finding(name, 'stage-failure', name, `Falló la etapa ${name}`, [{ detail: value.error }], { confidence: 'alta', element:{kind:'Análisis',name:analysisLabels[name]??name} }))
  if (changed.length) findings.unshift(finding('pipeline', 'input-drift', 'inputs', 'Las entradas cambiaron durante el diagnóstico', changed.map(file => ({ file, detail: 'Huella distinta al terminar.' })), { confidence: 'alta',element:{kind:'Ejecución',name:runId} }))
  const failed = Object.values(stages).filter(item => item.status === 'failed').length
  const status = failed === Object.keys(stages).length ? 'failed' : failed || changed.length || Object.values(stages).some(item => item.status === 'partial') ? 'partial' : 'complete'
  const report = { schemaVersion: 2, diagnosticSchemaVersion: diagnosticVersion, kind: 'angie-diagnostics-run', analysisVersion, runId, profile, status, startedAt, finishedAt: new Date().toISOString(), input, stableInputs: !changed.length, changedInputs: changed, stages, findings:relateFindings(findings), metrics: bundleMetrics(reports.bundle), comparison: { status: 'pending' } }
  report.comparison = compareRuns(report, previous)
  publish(report, reports, renderers)
  console.log(`Diagnóstico ${status}: ${report.findings.length} hallazgos/observaciones.\nInforme: ${workflowFolder}/${report.runId}/report.md\nReferencia: ${report.comparison.baseline ?? 'sin ejecución anterior'}`)
  if (failed || changed.length) process.exitCode = 1
}

if (isMain(import.meta.url)) main().catch(error => { console.error(`Diagnóstico no completado: ${error.message}`); process.exitCode = 1 })
