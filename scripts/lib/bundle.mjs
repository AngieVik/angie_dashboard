import { renderAnalysis, reportSection, sourceReference, markdownText } from './findings.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Buffer } from 'node:buffer'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'
import ts from 'typescript'

import { root, relative, absoluteFilesIn as filesIn } from './project.mjs'
import { checkNoticeCatalog } from '../collect-notice-messages.mjs'

const packageVersions = new Map()
const slash = value => value.replaceAll('\\', '/')
const kb = bytes => (bytes / 1000).toFixed(2)

function staticImports(source) {
  return source.statements.flatMap(statement => {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteralLike(statement.moduleSpecifier)) {
      return [statement.moduleSpecifier.text]
    }
    return []
  })
}

function sourceIdentity(mapFile, source, sourceRoot = '') {
  let absolute = slash(path.resolve(path.dirname(mapFile), sourceRoot, source))
  // Vite's worker maps can use paths relative to the project rather than the
  // emitted worker. Resolve only existing project/package files as a fallback.
  if (!fs.existsSync(absolute)) {
    const normalized = slash(source)
    const marker = normalized.match(/(?:^|\/)(node_modules|src)\//)
    if (marker) {
      const candidate = path.resolve(root, normalized.slice(marker.index).replace(/^\//, ''))
      if (fs.existsSync(candidate)) absolute = slash(candidate)
    }
  }
  const marker = '/node_modules/'
  const index = absolute.lastIndexOf(marker)
  if (index >= 0) {
    const tail = absolute.slice(index + marker.length).split('/')
    const name = tail[0].startsWith('@') ? tail.slice(0, 2).join('/') : tail[0]
    const packageRoot = absolute.slice(0, index + marker.length) + name
    if (!packageVersions.has(packageRoot)) {
      const manifest = path.join(packageRoot, 'package.json')
      packageVersions.set(packageRoot, fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')).version : null)
    }
    const version = packageVersions.get(packageRoot)
    return { source: `node_modules/${name}/${absolute.slice(packageRoot.length + 1)}`, package: name, version, group: version ? `${name}@${version}` : name, kind: 'dependency' }
  }
  const local = relative(absolute)
  return local.startsWith('src/')
    ? { source: local, package: null, group: 'Código de Angie', kind: 'app' }
    : { source: source.startsWith('\0') ? source.slice(1) : source, package: null, group: 'Auxiliares del empaquetador', kind: 'generated' }
}

// Decode v3 source-map segments. Column positions are UTF-16; count UTF-8
// bytes in the emitted span so attributed bytes add up to the real file size.
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const values = new Map([...alphabet].map((character, index) => [character, index]))
function segmentValues(segment) {
  const decoded = []
  let position = 0
  while (position < segment.length) {
    let value = 0, shift = 0, digit
    do {
      digit = values.get(segment[position++])
      if (digit === undefined || shift > 45) throw new Error('Segmento de mapa de fuentes inválido.')
      value += (digit & 31) * 2 ** shift
      shift += 5
    } while (digit & 32)
    decoded.push(value & 1 ? -Math.floor(value / 2) : Math.floor(value / 2))
  }
  return decoded
}

function attribute(code, map, mapFile, syntax) {
  const identities = map.sources.map(source => sourceIdentity(mapFile, source, map.sourceRoot))
  const totals = new Map()
  const lines = code.split('\n'), mappings = map.mappings.split(';')
  // A missing map (notably native JSON modules) may leave no reset segment.
  // Never extend the previous owner across a top-level statement/declaration.
  // Conservatively leave the remainder unattributed rather than guess its owner.
  const boundaries = [...new Set(syntax.statements.flatMap(statement => [statement.getStart(syntax), statement.end,
    ...(ts.isVariableStatement(statement) ? statement.declarationList.declarations.flatMap(item => [item.getStart(syntax), item.end]) : [])]))].sort((a, b) => a - b)
  let sourceIndex = 0, unmappedBytes = 0, unreliableBytes = 0, boundaryIndex = 0, lineOffset = 0
  function add(source, start, end) {
    while (boundaryIndex < boundaries.length && boundaries[boundaryIndex] <= start) boundaryIndex++
    const mappedEnd = source === null ? end : Math.min(end, boundaries[boundaryIndex] ?? end)
    const bytes = Buffer.byteLength(code.slice(start, mappedEnd))
    if (source === null) unmappedBytes += bytes
    else totals.set(source, (totals.get(source) ?? 0) + bytes)
    const uncertain = Buffer.byteLength(code.slice(mappedEnd, end))
    unmappedBytes += uncertain
    unreliableBytes += uncertain
  }
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    let column = 0, previousColumn = 0, owner = null
    for (const segment of (mappings[lineIndex] ?? '').split(',')) {
      if (!segment) continue
      const fields = segmentValues(segment)
      column += fields[0]
      if (column < previousColumn || column > line.length) throw new Error('Columna fuera del archivo generado.')
      add(owner, lineOffset + previousColumn, lineOffset + column)
      owner = fields.length >= 4 ? sourceIndex += fields[1] : null
      if (owner !== null && !identities[owner]) throw new Error('Fuente inexistente en el mapa.')
      previousColumn = column
    }
    add(owner, lineOffset + previousColumn, lineOffset + line.length)
    if (lineIndex < lines.length - 1) unmappedBytes++
    lineOffset += line.length + 1
  }
  const sources = [...totals].map(([index, bytes]) => ({ ...identities[index], bytes })).sort((a, b) => b.bytes - a.bytes)
  const sum = sources.reduce((total, item) => total + item.bytes, unmappedBytes)
  if (sum !== Buffer.byteLength(code)) throw new Error('La atribución no coincide con los bytes del archivo.')
  return { sources, unmappedBytes, unreliableBytes }
}

function aggregate(chunks, key) {
  const groups = new Map()
  for (const chunk of chunks) for (const item of chunk.sources) {
    const id = item[key]
    const row = groups.get(id) ?? { name: id, package: item.package, kind: item.kind, bytes: 0, initialBytes: 0, workerBytes: 0, chunks: new Set() }
    row.bytes += item.bytes
    if (chunk.initial) row.initialBytes += item.bytes
    if (chunk.worker) row.workerBytes += item.bytes
    row.chunks.add(chunk.file)
    groups.set(id, row)
  }
  return [...groups.values()].map(row => ({ ...row, chunks: [...row.chunks] })).sort((a, b) => b.bytes - a.bytes)
}

export function renderBundle(report, options = {}) {
  const { sourceRoot } = options
  const main = report.chunks.find(chunk => chunk.entry)
  const initial = report.chunks.filter(chunk => chunk.initial)
  const mainGroups = main ? aggregate([main], 'group') : []
  const share = size => main.bytes ? `${(size / main.bytes * 100).toFixed(1)} %` : '0 %'
  const amount = bytes => `${kb(bytes)} kB`
  const sourcesByOwner = new Map()
  for (const item of report.sources) {
    const owner = item.group ?? item.package ?? item.kind
    if (!sourcesByOwner.has(owner)) sourcesByOwner.set(owner, [])
    sourcesByOwner.get(owner).push(item)
  }
  const source = (file, label = file) => fs.existsSync(path.resolve(root, file))
    ? sourceReference(file, 1, sourceRoot, markdownText(label)) : `\`${file}\``
  const split = item => `${kb(item.bytes)} / ${kb(item.initialBytes)} / ${kb(item.workerBytes)}`
  const withoutAttribution = report.chunks.flatMap(chunk => {
    const modules = (chunk.modules ?? []).filter(item => item.renderedLength > 0 && !item.attributedBytes)
    return modules.length ? [
      `- \`${chunk.file}\``,
      ...modules.map(item => `  - ${source(item.source)} · ${item.group} · longitud ${item.renderedLength}`),
    ].join('\n') : []
  })
  return renderAnalysis('bundle', report, [
    reportSection('Medidas', [
      main ? `- Principal: \`${main.file}\` · ${amount(main.bytes)} · ${amount(main.gzipBytes)} gzip.` : '- Principal sin identificar.',
      `- JS inicial: ${initial.length} archivos · ${amount(initial.reduce((sum, item) => sum + item.bytes, 0))} · ${amount(initial.reduce((sum, item) => sum + item.gzipBytes, 0))} gzip.`,
      `- JS emitido: ${amount(report.chunks.reduce((sum, item) => sum + item.bytes, 0))}, incluidos diferidos y workers.`,
      `- Precaché: ${report.precache.files} archivos · ${amount(report.precache.bytes)} sin compresión.`,
      main ? `- Principal sin atribución: ${amount(main.unmappedBytes)}. Cruzan límites sintácticos ${amount(main.unreliableBytes)}.` : '',
      main ? `- Principal en dist: ${main.matchesCurrentDist === true ? 'idéntico byte a byte' : main.matchesCurrentDist === false ? 'mismo nombre, distinto contenido' : 'sin archivo equivalente'}.` : '',
      'Método: segmentos de source map v3 acotados por sintaxis, pertenencia de módulos según el empaquetador y gzip nivel 6. kB decimales.',
    ]),
    reportSection('Precaché por clase', report.precache.groups.map(item => `- ${item.kind} · ${item.files} archivos · ${amount(item.bytes)}`)),
    main ? reportSection('Composición del principal', [
      ...mainGroups.map(item => `- ${item.name} · ${amount(item.bytes)} · ${share(item.bytes)}`),
      `- Sin atribución · ${amount(main.unmappedBytes)} · ${share(main.unmappedBytes)}`,
    ]) : '',
    reportSection('JavaScript emitido', [
      'Por archivo: tipo de carga · kB reales / gzip / sin atribución.',
      ...report.chunks.map(item => `- \`${item.file}\` · ${item.initial ? 'inicial' : item.worker ? 'worker' : 'diferida o compartida'} · ${kb(item.bytes)} / ${kb(item.gzipBytes)} / ${kb(item.unmappedBytes)}`),
    ]),
    reportSection('Recursos emitidos', report.assets.map(item => `- \`${item.file}\` · ${amount(item.bytes)}${item.precached ? ' · precaché' : ''}`)),
    reportSection('Atribución por propietario', [
      'Cada terna indica kB atribuidos al total / carga inicial / workers. Los totales por fuente son aproximados.',
      ...report.groups.map(item => `- ${item.name} · ${split(item)}`),
    ]),
    reportSection('Fuentes emitidas', [
      'kB atribuidos al total / carga inicial / workers.',
      ...[...sourcesByOwner].flatMap(([owner, items]) => [
        `\n### ${owner}\n`,
        ...items.map(item => {
          const label = item.name.replace(/^src\//, '').replace(/^node_modules\/(?:@[^/]+\/)?[^/]+\//, '')
          return `- ${source(item.name, label)} · ${split(item)}`
        }),
      ]),
    ]),
    withoutAttribution.length ? reportSection('Módulos incluidos sin bytes atribuibles', [
      'La longitud informada por el empaquetador precede a la minificación.', ...withoutAttribution,
    ]) : '',
    report.dependenciesWithoutMappedJavaScript.length ? reportSection('Dependencias declaradas sin JavaScript atribuible', [
      'Pueden aportar CSS, tipos o requisitos de otros paquetes.',
      ...report.dependenciesWithoutMappedJavaScript.map(name => `- ${name}`),
    ]) : '',
  ], options)
}

export async function collectBundle() {
  // Match prebuild's catalog without mutating sources during a diagnostic run.
  checkNoticeCatalog()
  const temporaryBase = path.join(os.tmpdir(), 'angie-bundle-')
  const temporary = fs.mkdtempSync(temporaryBase)
  if (path.dirname(temporary) !== path.dirname(temporaryBase) || !temporary.startsWith(temporaryBase)) throw new Error('Directorio temporal fuera del destino previsto.')
  const chunkModules = new Map()
  const inspectionPlugin = () => ({
    name: 'angie-bundle-attribution',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk') {
        chunkModules.set(chunk.fileName, Object.entries(chunk.modules).map(([id, module]) => ({
          ...sourceIdentity(path.join(temporary, chunk.fileName + '.map'), slash(id)),
          renderedLength: module.renderedLength,
          renderedExports: module.renderedExports,
        })))
      }
    },
  })
  try {
    await build({ root, logLevel: 'silent', plugins: [inspectionPlugin()], worker: { plugins: () => [inspectionPlugin()] },
      build: { outDir: temporary, emptyOutDir: true, sourcemap: 'hidden' } })
    const files = filesIn(temporary)
    const html = fs.readFileSync(path.join(temporary, 'index.html'), 'utf8')
    const entryFiles = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(match => match[1].replace(/^\//, ''))
    const records = new Map()
    for (const file of files.filter(file => file.endsWith('.js'))) {
      const name = slash(path.relative(temporary, file))
      if (name === 'sw.js' || name.startsWith('workbox-')) continue
      const code = fs.readFileSync(file, 'utf8'), bytes = Buffer.from(code)
      const syntax = ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
      const mapFile = file + '.map'
      const attribution = fs.existsSync(mapFile) ? attribute(code, JSON.parse(fs.readFileSync(mapFile, 'utf8')), mapFile, syntax) : { sources: [], unmappedBytes: bytes.length, unreliableBytes: 0 }
      const currentDist = path.join(root, 'dist', name)
      records.set(name, { file: name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, worker: /\.worker-/.test(name),
        entry: entryFiles.includes(name), initial: false, ...attribution,
        modules: (chunkModules.get(name) ?? []).map(module => ({ ...module, attributedBytes: attribution.sources.find(source => source.source === module.source)?.bytes ?? 0 })),
        imports: staticImports(syntax).filter(specifier => specifier.startsWith('.')).map(specifier => path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier))),
        matchesCurrentDist: fs.existsSync(currentDist) ? bytes.equals(fs.readFileSync(currentDist)) : null,
      })
    }
    function initial(name) { const record = records.get(name); if (!record || record.initial) return; record.initial = true; record.imports.forEach(initial) }
    entryFiles.forEach(initial)
    const chunks = [...records.values()].sort((a, b) => b.bytes - a.bytes)
    const serviceWorker = fs.readFileSync(path.join(temporary, 'sw.js'), 'utf8')
    const assets = files.filter(file => !/\.(?:js|map)$/.test(file)).map(file => {
      const name = slash(path.relative(temporary, file))
      return { file: name, bytes: fs.statSync(file).size, precached: serviceWorker.includes(`url:"${name}"`) || serviceWorker.includes(`url:'${name}'`) }
    }).sort((a, b) => b.bytes - a.bytes)
    const precached = files.filter(file => {
      const name = slash(path.relative(temporary, file))
      return serviceWorker.includes(`url:"${name}"`) || serviceWorker.includes(`url:'${name}'`)
    })
    const precacheGroups = new Map()
    for (const file of precached) {
      const name = slash(path.relative(temporary, file))
      const kind = name.startsWith('assets/pins/') ? 'Pines SVG'
        : name === 'assets/elements/icon_chincheta.png' ? 'Icono de la aplicación PNG' : name.endsWith('.wasm') ? 'WASM'
        : name.endsWith('.js') ? 'JavaScript' : name.includes('/fonts/') ? 'Fuentes' : name.endsWith('.css') ? 'CSS'
          : /\.(?:png|jpe?g|svg|webp|avif)$/.test(name) ? 'Otras imágenes' : 'Otros'
      const row = precacheGroups.get(kind) ?? { kind, files: 0, bytes: 0 }
      row.files++; row.bytes += fs.statSync(file).size; precacheGroups.set(kind, row)
    }
    const precache = { files: precached.length, bytes: precached.reduce((sum, file) => sum + fs.statSync(file).size, 0),
      groups: [...precacheGroups.values()].sort((a, b) => b.bytes - a.bytes) }
    const groups = aggregate(chunks, 'group'), sources = aggregate(chunks, 'source')
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    const presentPackages = new Set(groups.map(row => row.package).filter(Boolean))
    const versions = new Map()
    for (const chunk of chunks) for (const source of chunk.sources) if (source.package && source.version) {
      const row = versions.get(source.package) ?? { package: source.package, versions: new Set(), bytes: 0 }
      row.versions.add(source.version); row.bytes += source.bytes; versions.set(source.package, row)
    }
    const multipleVersions = [...versions.values()].filter(row => row.versions.size > 1)
      .map(row => ({ ...row, versions: [...row.versions] })).sort((a, b) => b.bytes - a.bytes)
    return { schemaVersion: 2, generatedAt: new Date().toISOString(), method: 'UTF-8 bytes attributed by v3 source-map segments bounded by top-level syntax; bundler module membership; gzip level 6; decimal kB',
      chunks, groups, sources, assets, precache, multipleVersions, dependenciesWithoutMappedJavaScript: Object.keys(manifest.dependencies).filter(name => !presentPackages.has(name)) }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}
