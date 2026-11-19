import path from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { root, createProjectContext } from './lib/project.mjs'
import { atomicWrite, isMain, individualReportPaths } from './lib/runtime.mjs'
import { snapshot, changedInputs } from './lib/snapshot.mjs'
import { collectAppInventory, renderAppInventory } from './lib/app-inventory.mjs'
import { collectUiStyles, renderUiStyles } from './lib/ui-styles.mjs'
import { collectUnusedCode, renderUnusedCode } from './lib/unused-code.mjs'
import { collectUiConsistency, renderUiConsistency } from './lib/ui-consistency.mjs'
import { collectPublicAssets, renderPublicAssets } from './lib/public-assets.mjs'
import { collectDependencies, renderDependencies } from './lib/dependencies.mjs'
import { collectArchitecture, renderArchitecture } from './lib/architecture.mjs'
import { collectFindings, finding, diagnosticReport, relateFindings, analysisLabels, findingCounts, reportRule } from './lib/findings.mjs'
import { reportDate, wrapReport, renderStageStatus } from './lib/report-format.mjs'

const analyses = Object.keys(analysisLabels).filter(name => name !== 'pipeline')
const destination = 'output/analize-app-scripts/diagnostic workflow/report.md'
const states = { complete: 'completo', partial: 'parcial', failed: 'error' }

export function render(report) {
  const sections = [
    '# Auditoría',
    '**' + report.findings.length + (report.findings.length === 1 ? ' hallazgo**' : ' hallazgos**') + (findingCounts(report.findings) ? ' · ' + findingCounts(report.findings) : ''),
    reportDate(report.finishedAt) + ' (Madrid) · ' + report.profile + ' · ' + states[report.status],
  ]
  const rows = []
  for (const name of analyses) {
    const stage = report.stages[name]
    const items = report.findings.filter(item => (item.origins ?? [item.analyzer]).includes(name))
    const file = path.posix.relative(path.posix.dirname(destination), individualReportPaths(name).markdownFile)
    const counts = new Map()
    for (const item of items) counts.set(item.rule, (counts.get(item.rule) ?? 0) + 1)
    const label = stage ? states[stage.status] : 'no ejecutado'
    const rules = [...counts].map(([rule, count]) => `${reportRule(rule)}: ${count}`).join(' · ')
    rows.push(`- [${name}](${file}) · ${label}${items.length ? ` · **${items.length}**` : ''}${rules ? ` · ${rules}` : ''}`)
    if (stage?.error) rows.push('  - ' + stage.error)
  }
  sections.push('## Informes\n\n' + wrapReport(rows.join('\n')))
  if (!report.stableInputs) sections.push('## Entradas cambiantes', wrapReport(report.changedInputs.join(', ')))
  return sections.join('\n\n').trimEnd() + '\n'
}

export function publish({ profile, stages: collectedStages, changedInputs: changed }, reports, renderers, write = atomicWrite) {
  const stages = { ...collectedStages }
  const published = {}
  for (const name of analyses) {
    const file = path.join(root, individualReportPaths(name).markdownFile)
    let stage = stages[name]
    let markdown
    if (stage && stage.status !== 'failed') {
      try { markdown = renderers[name](reports[name]) }
      catch (error) {
        stage = stages[name] = { status: 'failed', error: `No se pudo generar el Markdown: ${error?.message ?? error}` }
      }
    }
    if (!stage || stage.status === 'failed') {
      markdown = renderStageStatus(name, stage?.status, stage?.error ?? `Fuera del perfil ${profile}.`)
    }
    try {
      write(file, markdown)
      if (stage && stage.status !== 'failed') published[name] = reports[name]
    } catch (error) {
      const detail = `No se pudo actualizar el archivo: ${error?.message ?? error}. Si existe, corresponde a una ejecución anterior.`
      stages[name] = { status: 'failed', error: stage?.error ? `${stage.error} ${detail}` : detail }
    }
  }

  const findings = collectFindings(published)
  for (const [name, stage] of Object.entries(stages)) {
    if (stage.status === 'failed') findings.unshift(finding(name, 'stage-failure', name, 'Falló ' + name, [{ detail: stage.error }], { confidence: 'alta' }))
  }
  if (changed.length) findings.unshift(finding('pipeline', 'input-drift', 'inputs', 'Entradas cambiantes', changed.map(file => ({ file, detail: 'Cambió durante el análisis.' })), { confidence: 'alta' }))
  const failed = Object.values(stages).filter(stage => stage.status === 'failed').length
  const status = failed && !Object.keys(published).length ? 'failed'
    : failed || changed.length || Object.values(stages).some(stage => stage.status === 'partial') ? 'partial' : 'complete'
  const report = { profile, status, finishedAt: new Date().toISOString(), stages, findings: relateFindings(findings), stableInputs: !changed.length, changedInputs: changed }
  write(path.join(root, destination), render(report))
  return report
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Uso: node scripts/diagnose.mjs [--profile quick|full]\nquick: siete análisis; full: añade bundle. Sobrescribe el informe general y los ocho individuales, sin JSON, historial ni comparación.\nDestino: ' + destination)
    return
  }
  let profile = 'quick'
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--profile' && args[index + 1]) profile = args[++index]
    else throw new Error('Argumento no reconocido: ' + args[index] + '. Usa --help.')
  }
  if (!['quick', 'full'].includes(profile)) throw new Error('Perfil no válido: quick o full.')
  if (profile === 'full' && process.env.NODE_ENV === undefined) process.env.NODE_ENV = 'production'
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
  if (profile === 'full') await stage('bundle', async () => {
    const bundle = await import('./lib/bundle.mjs')
    renderers.bundle = bundle.renderBundle
    return bundle.collectBundle()
  })
  const changed = changedInputs(input, snapshot())
  const report = publish({ profile, stages, changedInputs: changed }, reports, renderers)
  console.log('Auditoría ' + states[report.status] + ': ' + report.findings.length + ' hallazgos.\nInforme: ' + destination)
  if (changed.length || Object.values(report.stages).some(stage => stage.status === 'failed')) process.exitCode = 1
}

if (isMain(import.meta.url)) main().catch(error => {
  console.error('Diagnóstico no completado: ' + error.message)
  process.exitCode = 1
})
