import { collectAppInventory, renderAppInventory } from './lib/app-inventory.mjs'
import { runCli, individualReportPaths } from './lib/runtime.mjs'

runCli(import.meta.url, {
  name: 'inspect-app.mjs', analysis: 'inventory', collect: collectAppInventory, render: renderAppInventory,
  ...individualReportPaths('inventory'),
  summary: report => `Inventario: ${report.files.length} archivos y ${report.components.length} componentes candidatos.`,
})
