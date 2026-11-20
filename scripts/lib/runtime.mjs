import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { root, createProjectContext } from './project.mjs'
import { diagnosticReport } from './findings.mjs'
import { renderStageFailure } from './report-format.mjs'

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
  return { markdownFile: `${directory}/report.md` }
}

export function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try { fs.writeFileSync(temporary, text); fs.renameSync(temporary, file) }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
}

export function runCli(url, { name, analysis, collect, render, markdownFile, summary }) {
  if (!isMain(url)) return
  const main = async () => {
    const args = process.argv.slice(2)
    if (args.length) {
      if (args.length !== 1 || !['--help', '-h'].includes(args[0])) throw new Error('Argumentos no reconocidos. Usa --help.')
      console.log(`Uso: node scripts/${name}\nSobrescribe ${markdownFile}. No modifica código de la app.`)
      return
    }
    let context
    try {
      context = createProjectContext()
      const report = diagnosticReport(analysis, await collect(context))
      atomicWrite(path.resolve(root, markdownFile), render(report))
      console.log(`${summary(report)}\nHallazgos: ${report.findings.length}.\nInforme: ${markdownFile}`)
    } catch (error) {
      atomicWrite(path.resolve(root, markdownFile), renderStageFailure(analysis, error.message))
      throw error
    } finally { context?.dispose() }
  }
  main().catch(error => { console.error(`${name}: ${error.message}`); process.exitCode = 1 })
}
