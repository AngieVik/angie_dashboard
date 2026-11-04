import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import ts from 'typescript'
import { parseCssText } from './css.mjs'

export const root = fileURLToPath(new URL('../../', import.meta.url))
export const relative = file => path.relative(root, file).replaceAll('\\', '/')
export const read = file => fs.readFileSync(path.resolve(root, file), 'utf8')
export const readJson = file => JSON.parse(read(file))
export const isCode = file => /\.[cm]?[jt]sx?$/.test(file)

export function absoluteFilesIn(directory) {
  const absolute = path.resolve(root, directory)
  if (!fs.existsSync(absolute)) return []
  return fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap(entry => {
    const file = path.join(absolute, entry.name)
    return entry.isDirectory() ? absoluteFilesIn(file) : entry.isFile() ? [file] : []
  })
}

export const filesIn = directory => absoluteFilesIn(directory).map(relative)
export const parseCss = (file, options) => parseCssText(file, read(file), options)

export function createProjectContext() {
  const src = filesIn('src')
  const tooling = [...filesIn('scripts'), ...filesIn('server')].filter(isCode)
  const configuration = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'eslint.config.js', 'server/server.mjs'].filter(file => fs.existsSync(path.join(root, file)))
  const inputs = [...new Set([...src, ...tooling, ...configuration, 'index.html'])].filter(file => fs.existsSync(path.join(root, file)))
  const textCache = new Map(), cssCache = new Map()
  let program
  const cachedRead = file => {
    const key = path.isAbsolute(file) ? relative(file) : file
    if (!textCache.has(key)) textCache.set(key, read(key))
    return textCache.get(key)
  }
  const getProgram = () => {
    if (!program) {
      const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), file => cachedRead(file))
      if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, ' '))
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
      if (parsed.errors.length) throw new Error(ts.flattenDiagnosticMessageText(parsed.errors[0].messageText, ' '))
      const options = { ...parsed.options, allowJs: true, checkJs: false, noEmit: true }
      const host = ts.createCompilerHost(options, true)
      program = ts.createProgram({ rootNames: inputs.filter(isCode).map(file => path.join(root, file)), options, host })
    }
    return program
  }
  return {
    src, tooling, configuration, inputs, read: cachedRead, readJson: file => JSON.parse(cachedRead(file)),
    getProgram,
    resolveLocal(specifier, from) {
      const clean = specifier.split(/[?#]/)[0]
      if (!/^(?:\.|@\/|\/src\/)/.test(clean)) return null
      const resolved = ts.resolveModuleName(clean, path.resolve(root, from), getProgram().getCompilerOptions(), ts.sys).resolvedModule
      if (resolved && inputs.includes(relative(resolved.resolvedFileName))) return relative(resolved.resolvedFileName)
      const target = clean.startsWith('@/') ? `src/${clean.slice(2)}` : clean.startsWith('/src/') ? clean.slice(1) : relative(path.resolve(root, path.dirname(from), clean))
      return [target, ...['.ts', '.tsx', '.js', '.mjs', '.json', '/index.ts', '/index.tsx', '/index.js'].map(extension => target + extension)].find(file => inputs.includes(file)) ?? null
    },
    source(file) {
      const source = getProgram().getSourceFile(path.resolve(root, file))
      if (!source) throw new Error(`No se pudo analizar ${file}`)
      if (source.parseDiagnostics.length) throw new Error(`${file}: ${ts.flattenDiagnosticMessageText(source.parseDiagnostics[0].messageText, ' ')}`)
      return source
    },
    css(file, options = {}) {
      const key = `${file}:${Boolean(options.allDeclarations)}`
      if (!cssCache.has(key)) cssCache.set(key, parseCssText(file, cachedRead(file), options))
      return cssCache.get(key)
    },
    dispose() { program = undefined; textCache.clear(); cssCache.clear() },
  }
}
