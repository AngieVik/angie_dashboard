import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { Buffer } from 'node:buffer'
import { fileURLToPath, URL } from 'node:url'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const reportDirectory = path.join(root, 'output/bundle-analysis')
const markdownPath = path.join(root, 'docs/peso-del-build.md')
const packageVersions = new Map()
const slash = value => value.replaceAll('\\', '/')
const relative = value => slash(path.relative(root, value))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const kb = bytes => (bytes / 1000).toFixed(2)
const percent = (part, whole) => whole ? (100 * part / whole).toFixed(1) + '%' : '0%'
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : [file]
  })
}

function staticImports(code, filename) {
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
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

function attribute(code, map, mapFile) {
  const identities = map.sources.map(source => sourceIdentity(mapFile, source, map.sourceRoot))
  const totals = new Map()
  const lines = code.split('\n'), mappings = map.mappings.split(';')
  let sourceIndex = 0, unmappedBytes = 0
  function add(source, text) {
    const bytes = Buffer.byteLength(text)
    if (source === null) unmappedBytes += bytes
    else totals.set(source, (totals.get(source) ?? 0) + bytes)
  }
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    let column = 0, previousColumn = 0, owner = null
    for (const segment of (mappings[lineIndex] ?? '').split(',')) {
      if (!segment) continue
      const fields = segmentValues(segment)
      column += fields[0]
      if (column < previousColumn || column > line.length) throw new Error('Columna fuera del archivo generado.')
      add(owner, line.slice(previousColumn, column))
      owner = fields.length >= 4 ? sourceIndex += fields[1] : null
      if (owner !== null && !identities[owner]) throw new Error('Fuente inexistente en el mapa.')
      previousColumn = column
    }
    add(owner, line.slice(previousColumn))
    if (lineIndex < lines.length - 1) unmappedBytes++
  }
  const sources = [...totals].map(([index, bytes]) => ({ ...identities[index], bytes })).sort((a, b) => b.bytes - a.bytes)
  const sum = sources.reduce((total, item) => total + item.bytes, unmappedBytes)
  if (sum !== Buffer.byteLength(code)) throw new Error('La atribución no coincide con los bytes del archivo.')
  return { sources, unmappedBytes }
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

function table(headers, rows) {
  return [headers, headers.map(() => '---'), ...rows].map(row => '| ' + row.map(escape).join(' | ') + ' |').join('\n')
}

function markdown(report) {
  const main = report.chunks.find(chunk => chunk.entry)
  const initial = report.chunks.filter(chunk => chunk.initial)
  const mainGroups = aggregate([main], 'group')
  const mainSources = main.sources.filter(item => item.kind === 'app')
  return `# Peso del build de Angie\n\nGenerado: ${report.generatedAt}. Comando: \`node scripts/analyze-bundle.mjs\`.\n\n` +
    `## Cómo leer las cifras\n\nLos tamaños de archivos y gzip son reales del build analizado (kB decimales, gzip con Node). La atribución a paquetes y fuentes es aproximada: reparte los bytes minificados por los segmentos del mapa de fuentes. El empaquetador y las partes sin mapa se indican aparte. No es consumo de RAM ni tiempo de ejecución. El gzip de paquetes individuales no es sumable, por eso solo se muestra para archivos completos.\n\n` +
    `Se reconstruye con la configuración actual y mapas ocultos en un directorio temporal, que se elimina al terminar. No se modifica \`dist/\` ni la configuración de producción. El JSON detallado está en \`output/bundle-analysis/report.json\`.\n\n` +
    `## Resumen\n\n` + table(['Dato', 'Valor'], [
      ['Principal', `${main.file}: ${kb(main.bytes)} kB; ${kb(main.gzipBytes)} kB gzip`],
      ['JavaScript estático inicial', `${initial.length} archivos; ${kb(initial.reduce((s, c) => s + c.bytes, 0))} kB; ${kb(initial.reduce((s, c) => s + c.gzipBytes, 0))} kB gzip`],
      ['Todo el JavaScript emitido', `${kb(report.chunks.reduce((s, c) => s + c.bytes, 0))} kB, incluidos workers y módulos diferidos`],
      ['Precaché PWA: bytes reales de los archivos locales', `${report.precache.files} archivos; ${(report.precache.bytes / 1_000_000).toFixed(2)} MB sin compresión`],
      ['Contribución mapeada del principal', percent(main.bytes - main.unmappedBytes, main.bytes)],
      ['Comparación con dist actual', main.matchesCurrentDist === true ? 'Principal idéntico byte a byte' : main.matchesCurrentDist === false ? 'Principal distinto: dist puede pertenecer a otro código/build' : 'No hay un principal equivalente en dist'],
    ]) + '\n\n' +
    `## Recursos de la precaché por clase\n\nSuma los tamaños de los archivos realmente nombrados en el service worker, incluidos los recursos públicos añadidos por includeAssets. La cifra resumida que imprime el plugin puede no incluir el tamaño de esos recursos públicos. No es tráfico de red medido ni tamaño físico garantizado de Cache Storage.\n\n` + table(['Clase', 'Archivos', 'MB sin compresión'], report.precache.groups.map(row => [row.kind, row.files, (row.bytes / 1_000_000).toFixed(2)])) + '\n\n' +
    `## Qué compone el chunk principal\n\n` + table(['Paquete o propietario', 'kB atribuidos', '% del principal'], mainGroups.map(row => [row.name, kb(row.bytes), percent(row.bytes, main.bytes)]).concat([['Sin atribución de fuente', kb(main.unmappedBytes), percent(main.unmappedBytes, main.bytes)]])) + '\n\n' +
    `## Fuentes de Angie más pesadas dentro del principal\n\n` + table(['Fuente', 'kB atribuidos'], mainSources.slice(0, 25).map(item => [item.source, kb(item.bytes)])) + '\n\n' +
    `## Paquetes y propietarios: todo el JavaScript\n\nIncluye copias emitidas dentro de workers; no confundir el total con el arranque.\n\n` + table(['Paquete o propietario', 'Total kB', 'Inicial kB', 'Dentro de workers kB'], report.groups.slice(0, 35).map(row => [row.name, kb(row.bytes), kb(row.initialBytes), kb(row.workerBytes)])) + '\n\n' +
    `## Paquetes con varias versiones emitidas\n\n` + table(['Paquete', 'Versiones', 'Total kB atribuidos'], report.multipleVersions.map(item => [item.package, item.versions.join(', '), kb(item.bytes)])) + '\n\nLa coexistencia no demuestra que se pueda deduplicar sin revisar compatibilidad. Las copias de una misma versión en un worker y en la interfaz no aparecen aquí como versiones distintas.\n\n' +
    `## Archivos JavaScript, de mayor a menor\n\n` + table(['Archivo', 'Carga', 'kB', 'gzip kB'], report.chunks.map(chunk => [chunk.file, chunk.initial ? 'Inicial estático' : chunk.worker ? 'Worker' : 'Bajo demanda / compartido', kb(chunk.bytes), kb(chunk.gzipBytes)])) + '\n\n' +
    `## Recursos no JavaScript más pesados\n\nLas imágenes públicas pueden estar copiadas en dist sin estar precacheadas ni descargarse al arrancar. La columna PWA comprueba su presencia en el service worker generado. CSS y WASM también consumen almacenamiento/descarga, aunque no engorden un chunk JS.\n\n` + table(['Archivo', 'kB', 'Precaché PWA'], report.assets.slice(0, 20).map(asset => [asset.file, kb(asset.bytes), asset.precached ? 'Sí' : 'No'])) + '\n\n' +
    `## Dependencias declaradas sin JavaScript atribuible\n\n${report.dependenciesWithoutMappedJavaScript.map(name => '- ' + name).join('\n') || 'Todas tienen contribución JS identificada.'}\n\nEsta lista identifica candidatas a revisar, no autoriza a retirarlas: pueden ser requisitos transitivos, recursos sin JS o consumidores no alcanzados por el mapa.\n`
}

async function main() {
  console.log('Analizando el build con mapas de fuentes ocultos…')
  const temporaryBase = path.join(os.tmpdir(), 'angie-bundle-')
  const temporary = fs.mkdtempSync(temporaryBase)
  if (path.dirname(temporary) !== path.dirname(temporaryBase) || !temporary.startsWith(temporaryBase)) throw new Error('Directorio temporal fuera del destino previsto.')
  try {
    await build({ root, logLevel: 'silent', build: { outDir: temporary, emptyOutDir: true, sourcemap: 'hidden' } })
    const files = filesIn(temporary)
    const html = fs.readFileSync(path.join(temporary, 'index.html'), 'utf8')
    const entryFiles = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(match => match[1].replace(/^\//, ''))
    const records = new Map()
    for (const file of files.filter(file => file.endsWith('.js'))) {
      const name = slash(path.relative(temporary, file))
      if (name === 'sw.js' || name.startsWith('workbox-')) continue
      const code = fs.readFileSync(file, 'utf8'), bytes = Buffer.from(code)
      const mapFile = file + '.map'
      const attribution = fs.existsSync(mapFile) ? attribute(code, JSON.parse(fs.readFileSync(mapFile, 'utf8')), mapFile) : { sources: [], unmappedBytes: bytes.length }
      records.set(name, { file: name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, worker: /\.worker-/.test(name),
        entry: entryFiles.includes(name), initial: false, ...attribution,
        imports: staticImports(code, name).filter(specifier => specifier.startsWith('.')).map(specifier => path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier))),
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
    const report = { generatedAt: new Date().toISOString(), method: 'UTF-8 bytes attributed by v3 source-map segments; gzip level 6; decimal kB',
      chunks, groups, sources, assets, precache, multipleVersions, dependenciesWithoutMappedJavaScript: Object.keys(manifest.dependencies).filter(name => !presentPackages.has(name)) }
    fs.mkdirSync(reportDirectory, { recursive: true })
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true })
    fs.writeFileSync(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2))
    fs.writeFileSync(markdownPath, markdown(report))
    console.log(`Informe: ${relative(markdownPath)}. Detalle: ${relative(path.join(reportDirectory, 'report.json'))}. ${chunks.length} paquetes JS analizados.`)
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
