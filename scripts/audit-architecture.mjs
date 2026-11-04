import { collectArchitecture, renderArchitecture } from './lib/architecture.mjs'
import { runCli, individualReportPaths } from './lib/runtime.mjs'

runCli(import.meta.url, {
  name: 'audit-architecture.mjs', analysis: 'architecture', collect: collectArchitecture, render: renderArchitecture,
  ...individualReportPaths('architecture'),
  summary: report => `Arquitectura: ${report.runtimeCycles.length} grupos cíclicos de valores; ${report.typeRelatedCycles.length} adicionales con tipos; ${report.deferredCycles.length} con cargas diferidas; ${report.crossFeatureRelations.length} relaciones entre funcionalidades; ${report.uncertainties.length} limitaciones.`,
})
