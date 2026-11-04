import { collectPublicAssets, renderPublicAssets } from './lib/public-assets.mjs'
import { runCli, individualReportPaths } from './lib/runtime.mjs'

runCli(import.meta.url, {
  name: 'audit-public-assets.mjs', analysis: 'assets', collect: collectPublicAssets, render: renderPublicAssets,
  ...individualReportPaths('assets'),
  summary: report => `Recursos públicos: ${report.coverage.files} archivos; ${report.missingReferences.length} referencias sin archivo y ${report.duplicates.length} grupos de duplicados.`,
})
