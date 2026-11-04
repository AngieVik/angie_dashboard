import { collectBundle, renderBundle } from './lib/bundle.mjs'
import { runCli, individualReportPaths } from './lib/runtime.mjs'

runCli(import.meta.url, {
  name: 'analyze-bundle.mjs', analysis: 'bundle', collect: collectBundle, render: renderBundle,
  ...individualReportPaths('bundle'),
  summary: report => `Bundle: ${report.chunks.length} archivos JavaScript.`,
})
