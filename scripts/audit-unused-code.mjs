import { collectUnusedCode, renderUnusedCode } from './lib/unused-code.mjs'
import { runCli, individualReportPaths } from './lib/runtime.mjs'

runCli(import.meta.url, {
  name: 'audit-unused-code.mjs', analysis: 'unused', collect: collectUnusedCode, render: renderUnusedCode,
  ...individualReportPaths('unused'),
  summary: report => `Limpieza: ${report.detachedFiles.length} archivos sin recorrido y ${report.unusedExports.length} exports candidatos.`,
})
