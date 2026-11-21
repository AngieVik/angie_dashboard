import { analysisLabels, reportRule } from './findings.mjs'
import { reportCode, reportDate, reportScope } from './report-format.mjs'

function evidenceRows(entries) {
  const files = Map.groupBy(entries, entry => entry.file ?? entry.artifact ?? 'Ejecución')
  return [...files].map(([file, evidence]) => {
    const details = evidence.map(entry => {
      const line = entry.line ? 'L' + entry.line : ''
      const detail = entry.componentLine ? entry.detail + ' L' + entry.componentLine : entry.detail
      return [line, detail].filter(Boolean).join(' ')
    })
    return '  - ' + reportCode(file) + ' · ' + [...new Set(details)].join(' | ')
  })
}

function cssRows(item) {
  return item.evidence.map(entry => {
    const context = item.facts.context?.join(' / ')
    const reasons = []
    if (entry.repeat) reasons.push(`Repetido ${entry.repeat.occurrences} veces en ${entry.repeat.sheets} hojas`)
    for (const match of entry.matches) reasons.push(match.literal + ' → ' + match.tokens.map(token =>
      token.name + ' (L' + token.line + (token.value === match.literal ? '' : ', ' + token.value) + ')').join(', '))
    return ['L' + entry.line + ' ' + reportCode(item.title), context, ...reasons].filter(Boolean).join(' · ')
  })
}

function findingBlock(item) {
  const head = '- **' + reportRule(item.rule) + '** · ' + reportCode(item.ref ?? item.id)
  const location = item.element.file ?? item.files[0]
  if (item.rule === 'css-coincidence') return [head + ' · ' + reportCode(location), ...cssRows(item).map(row => '  - ' + row)].join('\n')
  const observation = item.observed !== item.title && !item.evidence.some(entry => entry.detail === item.observed) ? item.observed : ''
  return [head + ' · ' + item.title, observation && '  - ' + observation, ...evidenceRows(item.evidence)].filter(Boolean).join('\n')
}

function exceptionBlock(item) {
  const lines = item.finding ? [findingBlock(item.finding)] : ['- **' + item.title + '**', ...evidenceRows(item.evidence)]
  lines.push('  - Motivo: ' + item.reason)
  if (item.sources?.length) lines.push('  - Referencias: ' + item.sources.map(reportCode).join(', '))
  return lines.join('\n')
}

function groupedBlocks(items, accepted) {
  const groups = new Map(), blocks = []
  for (const item of items) {
    const finding = accepted ? item.finding : item
    if (!finding?.facts.symbol || !['internal-exports', 'unreferenced-exports'].includes(finding.rule)) {
      blocks.push(accepted ? exceptionBlock(item) : findingBlock(item))
      continue
    }
    const key = JSON.stringify([finding.rule, finding.element.file, item.reason])
    if (!groups.has(key)) {
      const rows = ['- **' + reportRule(finding.rule) + '** · ' + reportCode(finding.element.file)]
      if (accepted) rows.push('  - Motivo: ' + item.reason)
      groups.set(key, rows)
      blocks.push(rows)
    }
    const facts = finding.facts
    groups.get(key).push('  - ' + reportCode(facts.symbol) + ' L' + finding.evidence[0].line + ' (' + facts.localReferences + '/' + facts.disconnectedReferences + ') · ' + reportCode(finding.ref))
  }
  return blocks.map(block => Array.isArray(block) ? block.join('\n') : block)
}

export function areaDocument(area, report, coverage) {
  const { findings, exceptions, limitations } = report
  const intro = [reportDate(report.generatedAt) + ' (Madrid). ' + reportScope(area), ...coverage]
  if (area === 'unused' && report.unusedExports.length) {
    intro.push('En los exports candidatos, cada pareja cuenta referencias locales / externas desconectadas. Las externas conectadas son cero.')
  }
  if (area === 'consistency' && report.cssCoincidences.some(entry => entry.matches.length)) intro.push('Las líneas de tokens remiten a src/styles/tokens.css. Las coincidencias expresan igualdad de valor.')
  const sections = [
    { title: 'Hallazgos para revisión', count: findings.length, blocks: groupedBlocks(findings, false) },
    { title: 'Excepciones verificadas', count: exceptions.length, blocks: groupedBlocks(exceptions, true) },
  ]
  if (limitations.length) sections.push({ title: 'Limitaciones del análisis', blocks: limitations.map(findingBlock) })
  if (report.observations.length) {
    const files = Map.groupBy(report.observations, item => item.evidence[0].file)
    sections.push({ title: 'Coincidencias numéricas por archivo · referencia', blocks: [...files].map(([file, items]) =>
      ['- ' + reportCode(file), ...items.flatMap(cssRows).map(row => '  - ' + row)].join('\n')) })
  }
  return { title: analysisLabels[area], intro, sections }
}
