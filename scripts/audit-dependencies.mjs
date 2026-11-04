import { collectDependencies, renderDependencies } from './lib/dependencies.mjs'
import { runCli, individualReportPaths } from './lib/runtime.mjs'

runCli(import.meta.url, {
  name: 'audit-dependencies.mjs', analysis: 'dependencies', collect: collectDependencies, render: renderDependencies,
  ...individualReportPaths('dependencies'),
  summary: report => `Dependencias: ${report.coverage.direct} directas; ${report.undeclaredUses.length} usos sin declaración; ${report.reviewCandidates.length} candidatos; ${report.npm.problems.length} problemas npm; ${report.uncertainties.length} limitaciones.`,
})
