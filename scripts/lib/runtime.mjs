import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { root, createProjectContext } from './project.mjs'
import { diagnosticReport } from './findings.mjs'

export const isMain = url => Boolean(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(url))

const individualDirectories = Object.freeze({
  inventory: '01_app_inventory',
  styles: '02_ui_styles',
  consistency: '03_ui_consistency',
  unused: '04_unused_code',
  architecture: '05_architecture',
  dependencies: '06_dependencies',
  assets: '07_public_assets',
  bundle: '08_bundle_analysis',
})

export function individualReportPaths(analysis) {
  const name = individualDirectories[analysis]
  if (!name) throw new Error(`Análisis individual no reconocido: ${analysis}`)
  const directory = `output/analize-app-scripts/${name}`
  return { jsonFile: `${directory}/report.json`, markdownFile: `${directory}/report.md` }
}

export function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try { fs.writeFileSync(temporary, text); fs.renameSync(temporary, file) }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
}

export function writeReport(report, markdown, jsonFile, markdownFile) {
  atomicWrite(path.resolve(root, jsonFile), JSON.stringify(report, null, 2) + '\n')
  atomicWrite(path.resolve(root, markdownFile), markdown)
}

export function runCli(url, { name, analysis, collect, render, jsonFile, markdownFile, summary }) {
  if (!isMain(url)) return
  const main = async () => {
    const args = process.argv.slice(2)
    if (args.length) {
      if (args.length !== 1 || !['--help', '-h'].includes(args[0])) throw new Error('Argumentos no reconocidos. Usa --help.')
      console.log(`Uso: node scripts/${name}\nGenera ${jsonFile} y ${markdownFile}. No modifica código de la app.`)
      return
    }
    const context = createProjectContext()
    try {
      const report = diagnosticReport(analysis, await collect(context))
      writeReport(report, render(report), jsonFile, markdownFile)
      console.log(`${summary(report)}\nHallazgos/observaciones: ${report.findings.length}.\nInformes: ${jsonFile} y ${markdownFile}`)
    } finally { context.dispose() }
  }
  main().catch(error => { console.error(`${name}: ${error.message}`); process.exitCode = 1 })
}
