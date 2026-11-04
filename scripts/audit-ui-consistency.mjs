import { collectUiConsistency, renderUiConsistency } from './lib/ui-consistency.mjs'
import { runCli, individualReportPaths } from './lib/runtime.mjs'
import { collectUiStyles } from './lib/ui-styles.mjs'

runCli(import.meta.url, {
  name: 'audit-ui-consistency.mjs', analysis: 'consistency', collect: project => collectUiConsistency(collectUiStyles(project)), render: renderUiConsistency,
  ...individualReportPaths('consistency'),
  summary: report => `Coherencia: ${new Set(report.differences.map(item=>item.groupId??item.group)).size} grupos / ${report.differences.length} propiedades discrepantes.`,
})
