import { renderAnalysis, markdownTable as table, sourceReference } from './findings.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'
import ts from 'typescript'

import { root, relative, absoluteFilesIn as filesIn } from './project.mjs'

const packageVersions = new Map()
const slash = value => value.replaceAll('\\', '/')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const kb = bytes => (bytes / 1000).toFixed(2)
const percent = (part, whole) => whole ? (100 * part / whole).toFixed(1) + '%' : '0%'

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
  const main=report.chunks.find(chunk=>chunk.entry)
  const initial=report.chunks.filter(chunk=>chunk.initial)
  const mainGroups=main?aggregate([main],'group'):[]
  const modules=report.chunks.flatMap(chunk=>(chunk.modules??[]).map(module=>({...module,chunk:chunk.file})))
  const sourceLabel=item=>fs.existsSync(path.resolve(root,item.source))?sourceReference(item.source,1,sourceRoot):item.source
  return renderAnalysis('bundle',report,[
    '## Datos de referencia · medidas del empaquetado',
    table(['Medida','Resultado'],[
      ['Principal',main?`${main.file}: ${kb(main.bytes)} kB; gzip ${kb(main.gzipBytes)} kB`:'Sin principal reconocido'],
      ['JavaScript de carga inicial',`${initial.length} archivos; ${kb(initial.reduce((sum,item)=>sum+item.bytes,0))} kB; gzip ${kb(initial.reduce((sum,item)=>sum+item.gzipBytes,0))} kB`],
      ['Todo el JavaScript emitido',`${kb(report.chunks.reduce((sum,item)=>sum+item.bytes,0))} kB, incluidos diferidos y workers`],
      ['Precaché PWA',`${report.precache.files} archivos; ${(report.precache.bytes/1_000_000).toFixed(2)} MB sin compresión`],
      ['Principal sin atribución fiable',main?`${kb(main.unmappedBytes)} kB; ${kb(main.unreliableBytes)} kB descartados al cruzar límites sintácticos`:'Sin principal'],
      ['Comparación del principal con dist',main?.matchesCurrentDist===true?'Idéntico byte a byte':main?.matchesCurrentDist===false?'Distinto; dist puede corresponder a otro build':'Sin archivo equivalente'],
    ]),
    `Método: ${report.method}. kB y MB decimales. Los tamaños y gzip de archivos completos son mediciones; la atribución por fuente es aproximada. El gzip de paquetes no es sumable. No se acredita latencia ni consumo de RAM.`,
    '## Datos de referencia · precaché por clase',
    table(['Clase','Archivos','Tamaño sin compresión (MB)'],report.precache.groups.map(item=>[item.kind,item.files,(item.bytes/1_000_000).toFixed(2)])),
    'Estas cifras corresponden a los archivos nombrados en el service worker generado, incluidos públicos de includeAssets. No son tráfico medido ni tamaño físico garantizado en Cache Storage.',
    '## Datos de referencia · composición del principal',
    table(['Propietario','kB atribuidos','Porcentaje del principal'],mainGroups.map(item=>[item.name,kb(item.bytes),percent(item.bytes,main.bytes)]).concat(main?[['Sin atribución de fuente',kb(main.unmappedBytes),percent(main.unmappedBytes,main.bytes)]]:[])),
    '## Datos de referencia · paquetes y propietarios emitidos',
    table(['Propietario','Total kB atribuidos','Inicial kB atribuidos','Workers kB atribuidos'],report.groups.map(item=>[item.name,kb(item.bytes),kb(item.initialBytes),kb(item.workerBytes)])),
    '## Datos de referencia · fuentes emitidas',
    table(['Fuente','Propietario','Total kB atribuidos','Inicial kB','Workers kB'],report.sources.map(item=>[sourceLabel({source:item.name}),item.group??item.package??item.kind,kb(item.bytes),kb(item.initialBytes),kb(item.workerBytes)])),
    '## Datos de referencia · archivos JavaScript',
    table(['Archivo emitido','Carga','kB reales','gzip kB','kB sin atribución'],report.chunks.map(item=>[item.file,item.initial?'Inicial':item.worker?'Worker':'Diferida / compartida',kb(item.bytes),kb(item.gzipBytes),kb(item.unmappedBytes)])),
    '## Datos de referencia · recursos no JavaScript',
    table(['Archivo emitido','kB reales','En precaché PWA'],report.assets.map(item=>[item.file,kb(item.bytes),item.precached?'Sí':'No'])),
    'Las imágenes pueden estar publicadas sin descargarse al arrancar. Las rutas emitidas describen el build temporal analizado, que se retira al terminar.',
    '## Datos de referencia · módulos con código sin bytes atribuibles',
    table(['Archivo emitido','Módulo','Propietario','Longitud anterior a minificación'],modules.filter(item=>item.renderedLength>0&&!item.attributedBytes).map(item=>[item.chunk,sourceLabel(item),item.group,item.renderedLength])),
    'El empaquetador acredita la inclusión de estos módulos. renderedLength no es tamaño final y no se suma a los bytes reales. La ausencia de atribución no acredita ausencia de uso.',
    '## Datos de referencia · declaraciones sin JavaScript atribuible',
    table(['Paquete declarado'],report.dependenciesWithoutMappedJavaScript.map(name=>[name])),
    'Esta lista solo describe la atribución del build. Un paquete puede aportar CSS, tipos, requisitos peer u otro consumo; las declaraciones y consumidores se diagnostican en dependencies. El JSON conserva todos los módulos, exports renderizados y detalles por chunk.',
  ],options)
}

export async function collectBundle() {
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
      records.set(name, { file: name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, worker: /\.worker-/.test(name),
        entry: entryFiles.includes(name), initial: false, ...attribution,
        modules: (chunkModules.get(name) ?? []).map(module => ({ ...module, attributedBytes: attribution.sources.find(source => source.source === module.source)?.bytes ?? 0 })),
        imports: staticImports(syntax).filter(specifier => specifier.startsWith('.')).map(specifier => path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier))),
        matchesCurrentDist: fs.existsSync(path.join(root, 'dist', name)) ? hash(bytes) === hash(fs.readFileSync(path.join(root, 'dist', name))) : null })
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
      const kind = name.startsWith('assets/elements/') ? 'Iconos de elementos PNG' : name.endsWith('.wasm') ? 'WASM'
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
