import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import os from 'node:os'
import { root, createProjectContext } from './project.mjs'
import { diagnosticReport } from './findings.mjs'
import { failureDocument, partName, reportPages } from './report-format.mjs'
import { digest } from './snapshot.mjs'

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

export async function writeReport(file, doc) {
  const [main, ...continuations] = reportPages(doc)
  const directory = path.dirname(file)
  const key = 'angie-audit-' + digest(process.platform === 'win32' ? file.toLowerCase() : file).slice(0, 24)
  const socket = process.platform === 'win32' ? '\\\\.\\pipe\\' + key
    : process.platform === 'linux' ? '\0' + key : path.join(os.tmpdir(), key + '.sock')
  // Serialize the pair across CLI and workflow processes. The OS releases the listener on exit.
  const lock = createServer(connection => connection.destroy())
  await new Promise((resolve, reject) => { lock.once('error', reject); lock.listen(socket, resolve) })
  try {
    fs.mkdirSync(directory, { recursive: true })
    const obsolete = new Set(fs.readdirSync(directory).filter(name => /^report-(?:[2-9]|[1-9]\d+)\.md$/.test(name)))
    const previous = new Map()
    try {
      for (const [index, page] of continuations.entries()) {
        const name = partName(index + 2)
        const target = path.join(directory, name)
        previous.set(target, obsolete.delete(name) ? fs.readFileSync(target, 'utf8') : null)
        atomicWrite(target, page)
      }
      atomicWrite(file, main)
    }
    catch (error) {
      for (const [target, content] of previous) {
        if (content === null) fs.rmSync(target, { force: true })
        else atomicWrite(target, content)
      }
      throw error
    }
    for (const name of obsolete) fs.unlinkSync(path.join(directory, name))
  } finally { await new Promise(resolve => lock.close(resolve)) }
}

export function runCli(url, { name, analysis, collect, render, markdownFile, summary }) {
  if (!isMain(url)) return
  const main = async () => {
    const args = process.argv.slice(2)
    const command = 'node ' + path.relative(root, fileURLToPath(url)).split(path.sep).join('/')
    if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
      console.log(`Uso: ${command}\nActualiza el informe detallado del área en ${markdownFile}.`)
      return
    }
    if (args.length) throw new Error('Argumentos no reconocidos. Usa --help.')
    const file = path.resolve(root, markdownFile)
    let context, report, document
    try {
      context = createProjectContext()
      report = diagnosticReport(analysis, await collect(context))
      document = render(report)
    } catch (error) {
      await writeReport(file, failureDocument(analysis, error.message))
      throw error
    } finally { context?.dispose() }
    await writeReport(file, document)
    console.log(`${summary(report)}\nPara revisión: ${report.findings.length}. Excepciones: ${report.exceptions.length}. Limitaciones: ${report.limitations.length}.\nInforme: ${markdownFile}`)
  }
  main().catch(error => { console.error(`${name}: ${error.message}`); process.exitCode = 1 })
}
