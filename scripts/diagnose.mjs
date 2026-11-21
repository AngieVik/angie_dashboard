import path from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { root, createProjectContext } from './lib/project.mjs'
import { writeReport, isMain, individualReportPaths } from './lib/runtime.mjs'
import { snapshot, changedInputs } from './lib/snapshot.mjs'
import { collectAppInventory, renderAppInventory } from './lib/app-inventory.mjs'
import { collectUiStyles, renderUiStyles } from './lib/ui-styles.mjs'
import { collectUnusedCode, renderUnusedCode } from './lib/unused-code.mjs'
import { collectUiConsistency, renderUiConsistency } from './lib/ui-consistency.mjs'
import { collectPublicAssets, renderPublicAssets } from './lib/public-assets.mjs'
import { collectDependencies, renderDependencies } from './lib/dependencies.mjs'
import { collectArchitecture, renderArchitecture } from './lib/architecture.mjs'
import { diagnosticReport, analysisLabels, reportRule, relateFindings } from './lib/findings.mjs'
import { reportDate, failureDocument, initialGzipSize } from './lib/report-format.mjs'

const analyses = Object.keys(analysisLabels).filter(name => name !== 'pipeline')
const destination = 'output/analize-app-scripts/diagnostic workflow/report.md'
const states = { complete: 'completo', partial: 'parcial', failed: 'error' }

function ruleSummary(items) {
  return [...Map.groupBy(items, item => item.rule)].map(([rule, cases]) =>
    cases.length === 1 ? cases[0].title : reportRule(rule) + ' (' + cases.length + ')').join(' · ')
}

export function render(report) {
  const rows = []
  let reviews = 0, exceptions = 0
  const gaps = []
  for (const name of analyses) {
    const stage = report.stages[name]
    const file = path.posix.relative(path.posix.dirname(destination), individualReportPaths(name).markdownFile)
    const label = '[' + analysisLabels[name] + '](' + file + ')'
    if (stage.status === 'failed') {
      rows.push('- ' + label + ' · **Error** · ' + stage.error)
      continue
    }
    const data = report.published[name]
    reviews += data.findings.length
    exceptions += data.exceptions.length
    gaps.push(...data.limitations)
    const details = []
    if (name === 'inventory') {
      const { total, resolved } = data.moduleCoverage
      const pending = total - resolved
      details.push(total + (total === 1 ? ' módulo registrado' : ' módulos registrados') + ', ' +
        pending + (pending === 1 ? ' entrada sin resolver' : ' entradas sin resolver'))
    }
    if (name === 'bundle') details.push(initialGzipSize(data.chunks) + ' de JavaScript de carga inicial')
    if (data.findings.length) details.push('Revisar: ' + ruleSummary(data.findings))
    else if (!details.length) details.push('Revisión: 0')
    if (data.exceptions.length) details.push('Excepciones verificadas: ' + data.exceptions.length)
    if (data.limitations.length) details.push('Limitaciones: ' + data.limitations.length)
    rows.push('- ' + label + ' · ' + details.join(' · '))
  }
  const uniqueGaps = relateFindings(gaps)
  const sections = [{ title: 'Resultados por área', blocks: rows }]
  if (exceptions) {
    const blocks = []
    for (const [name, data] of Object.entries(report.published)) {
      for (const [reason, cases] of Map.groupBy(data.exceptions, item => item.reason)) {
        blocks.push('- ' + analysisLabels[name] + ' · ' + [...new Set(cases.map(item => item.title))].join(', ') + ' · ' + reason)
      }
    }
    sections.push({ title: 'Motivos de excepción por área', blocks })
  }
  if (report.changedInputs.length) sections.push({ title: 'Entradas que cambiaron durante la revisión', blocks: report.changedInputs.map(file => '- ' + file) })
  return {
    title: 'Auditoría general',
    intro: [reportDate(report.finishedAt) + ' (Madrid) · ' + states[report.status],
      'Hallazgos para revisión: **' + reviews + '** · excepciones verificadas: **' + exceptions + '** · limitaciones distintas: **' + uniqueGaps.length + '**.'],
    sections,
  }
}

export async function publish({ stages: collectedStages, changedInputs }, reports, renderers, write = writeReport) {
  const stages = { ...collectedStages }, published = {}
  for (const name of analyses) {
    let stage = stages[name]
    let document
    if (stage.status !== 'failed') {
      try { document = renderers[name](reports[name]) }
      catch (error) { stage = stages[name] = { status: 'failed', error: error.message } }
    }
    if (stage.status === 'failed') document = failureDocument(analysisLabels[name], stage.error)
    try {
      await write(path.join(root, individualReportPaths(name).markdownFile), document)
      if (stage.status !== 'failed') published[name] = reports[name]
    } catch (error) {
      stages[name] = { status: 'failed', error: [stage.error, 'No se pudo actualizar el informe: ' + error.message + '. Puede corresponder a una ejecución anterior.'].filter(Boolean).join(' ') }
    }
  }
  const failed = Object.values(stages).filter(stage => stage.status === 'failed').length
  const status = failed === analyses.length ? 'failed'
    : failed || changedInputs.length || Object.values(stages).some(stage => stage.status === 'partial') ? 'partial' : 'complete'
  const report = { status, finishedAt: new Date().toISOString(), stages, published, changedInputs }
  await write(path.join(root, destination), render(report))
  return report
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Uso: npm run diagnose\nEjecuta las ocho áreas y actualiza sus informes y el resumen general.')
    return
  }
  if (args.length) throw new Error('Argumentos no reconocidos. Usa --help.')
  if (process.env.NODE_ENV === undefined) process.env.NODE_ENV = 'production'
  const input = snapshot()
  const context = createProjectContext(), reports = {}, stages = {}
  const renderers = { inventory: renderAppInventory, unused: renderUnusedCode, architecture: renderArchitecture, dependencies: renderDependencies, assets: renderPublicAssets, styles: renderUiStyles, consistency: renderUiConsistency }
  const stage = async (name, collect) => {
    console.log('Analizando ' + name + '…')
    try {
      reports[name] = diagnosticReport(name, await collect())
      stages[name] = { status: reports[name].uncertainties?.length ? 'partial' : 'complete' }
    } catch (error) { stages[name] = { status: 'failed', error: error.message } }
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
  await stage('bundle', async () => {
    const bundle = await import('./lib/bundle.mjs')
    renderers.bundle = bundle.renderBundle
    return bundle.collectBundle()
  })
  const changed = changedInputs(input, snapshot())
  const report = await publish({ stages, changedInputs: changed }, reports, renderers)
  console.log('Estado del flujo: ' + states[report.status] + '.\nInforme: ' + destination)
  if (changed.length || Object.values(report.stages).some(stage => stage.status === 'failed')) process.exitCode = 1
}

if (isMain(import.meta.url)) main().catch(error => {
  console.error('Diagnóstico no completado: ' + error.message)
  process.exitCode = 1
})
