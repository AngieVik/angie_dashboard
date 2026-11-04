import { collectUiStyles, renderUiStyles } from './lib/ui-styles.mjs'
import { runCli, individualReportPaths } from './lib/runtime.mjs'
export { collectUiStyles } from './lib/ui-styles.mjs'
export { parseCss } from './lib/project.mjs'

runCli(import.meta.url, {
  name: 'inspect-ui-styles.mjs', analysis: 'styles', collect: collectUiStyles, render: renderUiStyles,
  ...individualReportPaths('styles'),
  summary: report => `Estilos: ${report.modules.length} módulos y ${report.surfaces.length} superficies.`,
})
