import { renderAnalysis, markdownTable as table, sourceReference, entryReference, readableBytes } from './findings.mjs'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { root, filesIn, isCode, createProjectContext } from './project.mjs'
import { digest } from './snapshot.mjs'

const external = value => /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)
const license = file => /(?:^|\/)(?:licenses?\/|(?:OFL|LICENSE|LICENCE|COPYING|NOTICE)(?:[.-]|$))/i.test(file)
const unwrap = node => {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression
  return node
}
const walk = (node, visit, parent = null) => { visit(node, parent); ts.forEachChild(node, child => { walk(child, visit, node) }) }

export function resolvePublicUrl(value, from, declaredPublic = false) {
  const text = value.trim()
  if (!text || external(text)) return null
  let clean
  try { clean = decodeURIComponent(text.split(/[?#]/)[0]) }
  catch { return text.includes('/assets/') ? { uncertainty: 'URL pública no decodificable' } : null }
  const fromPublic = from.startsWith('public/')
  let target
  if (clean.startsWith('/')) {
    if (!clean.startsWith('/assets/') && !declaredPublic) return null
    target = path.posix.join('public', clean)
  } else if (clean.startsWith('assets/')) target = path.posix.join('public', clean)
  else if (fromPublic) target = path.posix.normalize(path.posix.join(path.posix.dirname(from), clean))
  else if (declaredPublic) target = path.posix.normalize(path.posix.join('public', clean))
  else return null
  if (!target.startsWith('public/') || target.includes('\\') || target.includes('\0')) return { uncertainty: 'Referencia fuera del alcance de public' }
  return { file: target, url: '/' + target.slice('public/'.length), directory: clean.endsWith('/') }
}

export function collectPublicAssets(project = createProjectContext(), inputFiles = []) {
  const initial = new Map(inputFiles.map(item => [item.file, item]))
  const assets = filesIn('public').map(file => {
    const bytes = initial.has(file) ? null : fs.readFileSync(path.join(root, file))
    return { file, url: '/' + file.slice(7), bytes: initial.get(file)?.bytes ?? bytes.length,
      hash: initial.get(file)?.hash ?? digest(bytes), references: [], configuredBy: [], protectedOriginal: true, license: license(file) }
  })
  const byPath = new Map(assets.map(item => [item.file, item]))
  const byLower = new Map()
  for (const asset of assets) {
    const key = asset.file.toLowerCase()
    if (!byLower.has(key)) byLower.set(key, [])
    byLower.get(key).push(asset)
  }
  const references = [], missingReferences = [], caseMismatches = [], directoryReferences = [], uncertainties = [], patterns = []
  const seen = new Set(), seenGaps = new Set()
  const gap = (file, line, kind, expression) => {
    const key = `${file}:${line}:${kind}:${expression}`
    if (!seenGaps.has(key)) { seenGaps.add(key); uncertainties.push({ file, line, kind, expression }) }
  }
  const add = (value, file, line, kind, declaredPublic = false) => {
    const knownRoot = byPath.has('public/' + value.split(/[?#]/)[0].replace(/^\//, ''))
    const target = resolvePublicUrl(value, file, declaredPublic || knownRoot)
    if (!target) return
    if (target.uncertainty) { gap(file, line, target.uncertainty, value); return }
    const key = `${file}:${line}:${target.file}:${kind}`
    if (seen.has(key)) return
    seen.add(key)
    const reference = { source: file, line, value, kind, target: target.file }
    if (target.directory) { directoryReferences.push(reference); return }
    const asset = byPath.get(target.file)
    references.push(reference)
    if (asset) asset.references.push(reference)
    else if (byLower.has(target.file.toLowerCase())) {
      const alternatives = byLower.get(target.file.toLowerCase())
      caseMismatches.push({ ...reference, actualFiles: alternatives.map(item => item.file) })
      alternatives.forEach(item => item.references.push({ ...reference, caseMismatch: true }))
    } else {
      const absolute = path.resolve(root, target.file)
      if (fs.existsSync(absolute)) gap(file, line, 'Recurso existente fuera del inventario de archivos regulares', value)
      else missingReferences.push(reference)
    }
  }
  const urls = (text, file, line, kind) => {
    for (const match of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) add(match[1] ?? match[2] ?? match[3], file, line + text.slice(0, match.index).split('\n').length - 1, kind)
    if (/url\(\s*var\(/i.test(text)) gap(file, line, 'URL CSS con variable no resuelta', text.slice(0, 200))
  }
  const looksLikeAsset = (value, file) => /^\/?assets\//.test(value) || /\.(?:png|jpe?g|svg|ico|webp|avif|woff2?|ttf|otf|mp3|wav|ogg|css|pdf|html|webmanifest)(?:[?#]|$)/i.test(value)
    || byPath.has(path.posix.normalize(path.posix.join(path.posix.dirname(file), value.split(/[?#]/)[0])))
  const markup = (text, file, line) => {
    for (const match of text.matchAll(/\b(src|href|poster|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      const value = match[2] ?? match[3]
      const values = match[1].toLowerCase() === 'srcset' && !external(value) ? value.split(',').map(item => item.trim().split(/\s+/)[0]) : [value]
      for (const url of values) if (match[1].toLowerCase() !== 'href' || looksLikeAsset(url, file)) add(url, file, line + text.slice(0, match.index).split('\n').length - 1, 'atributo ' + match[1])
    }
    urls(text, file, line, 'URL en marcado')
  }
  for (const file of project.src.filter(isCode)) {
    const source = project.source(file)
    walk(source, (node, parent) => {
      const line = () => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
      if (ts.isTemplateExpression(node) && node.getText(source).includes('/assets/')) { gap(file, line(), 'Ruta pública interpolada no resuelta', node.getText(source).slice(0, 240)); return }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken && node.getText(source).includes('/assets/')) gap(file, line(), 'Ruta pública concatenada no resuelta', node.getText(source).slice(0, 240))
      if (!ts.isStringLiteralLike(node)) return
      if (parent && ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && ['startsWith', 'endsWith', 'includes'].includes(parent.expression.name.text)) return
      if (parent && ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.PlusToken) return
      if (node.text.startsWith('/assets/') || node.text.startsWith('assets/')) add(node.text, file, line(), 'literal en código')
      else if (node.text.includes('/assets/')) markup(node.text, file, line())
    })
  }
  for (const file of [...project.src, ...assets.map(item => item.file)]) {
    if (file.endsWith('.css')) {
      for (const rule of project.css(file, { allDeclarations: true })) for (const declaration of rule.declarations) urls(declaration.value, file, declaration.line, 'URL CSS')
      const text = project.read(file).replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '))
      for (const match of text.matchAll(/@import\s+['"]([^'"]+)['"]/gi)) add(match[1], file, text.slice(0, match.index).split('\n').length, 'import CSS')
    } else if (/\.(?:html|svg)$/.test(file)) markup(project.read(file), file, 1)
  }
  markup(project.read('index.html'), 'index.html', 1)
  for (const asset of assets.filter(item => /\.(?:json|webmanifest)$/.test(item.file))) {
    try {
      const inspect = value => {
        if (!value || typeof value !== 'object') return
        for (const [key, entry] of Object.entries(value)) {
          if (['src', 'href', 'url'].includes(key) && typeof entry === 'string' && looksLikeAsset(entry, asset.file)) add(entry, asset.file, 1, 'recurso JSON público', true)
          else inspect(entry)
        }
      }
      inspect(project.readJson(asset.file))
    } catch (error) { gap(asset.file, 1, 'JSON público no analizable', error.message) }
  }

  const config = project.source('vite.config.ts'), constants = new Map(), pwaNames = new Set()
  let pwaImportSeen = false
  for (const statement of config.statements) {
    if (ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.initializer) constants.set(declaration.name.text, declaration.initializer)
    if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === 'vite-plugin-pwa') {
      pwaImportSeen = true
      if (statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) for (const name of statement.importClause.namedBindings.elements) if ((name.propertyName ?? name.name).text === 'VitePWA') pwaNames.add(name.name.text)
    }
  }
  const staticNode = (node, seenNames = new Set()) => {
    node = unwrap(node)
    if (node && ts.isIdentifier(node) && constants.has(node.text) && !seenNames.has(node.text)) return staticNode(constants.get(node.text), new Set([...seenNames, node.text]))
    return node
  }
  const configLine = node => config.getLineAndCharacterOfPosition(node.getStart(config)).line + 1
  const property = (object, name) => {
    object = staticNode(object)
    if (!object || !ts.isObjectLiteralExpression(object)) return undefined
    const selected = object.properties.find(item => (ts.isPropertyAssignment(item) || ts.isShorthandPropertyAssignment(item)) && (ts.isIdentifier(item.name) || ts.isStringLiteralLike(item.name)) && item.name.text === name)
    return selected && (ts.isShorthandPropertyAssignment(selected) ? selected.name : selected.initializer)
  }
  const strings = (node, kind) => {
    if (!node) return
    const resolved = staticNode(node)
    if (resolved?.kind === ts.SyntaxKind.FalseKeyword) return
    const elements = resolved && ts.isArrayLiteralExpression(resolved) ? resolved.elements : [resolved]
    for (const value of elements) {
      const literal = value && staticNode(value)
      if (!literal || !ts.isStringLiteralLike(literal)) { gap('vite.config.ts', configLine(node), 'Patrón PWA no literal', `${kind}: ${node.getText(config)}`); continue }
      patterns.push({ kind, pattern: literal.text, source: 'vite.config.ts', line: configLine(literal), matchedFiles: [] })
    }
  }
  let pwaDeclarations = 0
  walk(config, node => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || !pwaNames.has(node.expression.text)) return
    pwaDeclarations++
    const options = staticNode(node.arguments[0])
    if (!options || !ts.isObjectLiteralExpression(options)) { gap('vite.config.ts', configLine(node), 'Opciones PWA no literales', node.getText(config).slice(0, 240)); return }
    const strategy = staticNode(property(options, 'strategies')), disabled = staticNode(property(options, 'disable'))
    if (strategy && (!ts.isStringLiteralLike(strategy) || strategy.text !== 'generateSW')) gap('vite.config.ts', configLine(strategy), 'Estrategia PWA no modelada', strategy.getText(config))
    if (disabled && disabled.kind !== ts.SyntaxKind.FalseKeyword) gap('vite.config.ts', configLine(disabled), 'Activación PWA condicional o deshabilitada no modelada', disabled.getText(config))
    strings(property(options, 'includeAssets'), 'includeAssets')
    const workbox = staticNode(property(options, 'workbox'))
    const manifest = staticNode(property(options, 'manifest'))
    for (const object of [options, workbox, manifest]) if (object && ts.isObjectLiteralExpression(object) && object.properties.some(ts.isSpreadAssignment)) gap('vite.config.ts', configLine(object), 'Objeto PWA con spread no resuelto', object.getText(config).slice(0, 240))
    if (workbox && !ts.isObjectLiteralExpression(workbox)) gap('vite.config.ts', configLine(workbox), 'Opciones Workbox no literales', workbox.getText(config))
    strings(property(workbox, 'globPatterns'), 'workbox.globPatterns')
    strings(property(workbox, 'globIgnores'), 'workbox.globIgnores')
    const icons = staticNode(property(manifest, 'icons'))
    if (icons && ts.isArrayLiteralExpression(icons)) for (const icon of icons.elements) {
      const src = staticNode(property(icon, 'src'))
      if (src && ts.isStringLiteralLike(src)) add(src.text, 'vite.config.ts', configLine(src), 'icono de manifiesto PWA', true)
      else gap('vite.config.ts', configLine(icon), 'Icono PWA no literal', icon.getText(config).slice(0, 200))
    }
    else if (icons) gap('vite.config.ts', configLine(icons), 'Iconos PWA no literales', icons.getText(config).slice(0, 200))
    if (manifest && manifest.kind !== ts.SyntaxKind.FalseKeyword && !ts.isObjectLiteralExpression(manifest)) gap('vite.config.ts', configLine(manifest), 'Manifiesto PWA no literal', manifest.getText(config).slice(0, 200))
  })
  if (pwaImportSeen && !pwaDeclarations) gap('vite.config.ts', 1, 'Declaración PWA no reconocida', 'Se reconoce el import de VitePWA, pero no una llamada de configuración interpretable.')
  // A relocated publicDir/base needs a separate URL model; do not silently apply /assets.
  for (const statement of config.statements) if (ts.isExportAssignment(statement)) {
    const exported = unwrap(statement.expression)
    const options = staticNode(ts.isCallExpression(exported) ? exported.arguments[0] : exported)
    if (!options || !ts.isObjectLiteralExpression(options)) gap('vite.config.ts', configLine(statement), 'Configuración Vite no literal', 'No se pudo verificar publicDir/base sin ejecutar configuración.')
    else {
      if (options.properties.some(ts.isSpreadAssignment)) gap('vite.config.ts', configLine(options), 'Configuración Vite con spread no resuelto', options.getText(config).slice(0, 240))
      for (const [name, expected] of [['publicDir', 'public'], ['base', '/']]) {
      const value = staticNode(property(options, name))
      if (value && (!ts.isStringLiteralLike(value) || value.text !== expected)) gap('vite.config.ts', configLine(value), `${name} personalizado no modelado`, value.getText(config))
      }
    }
  }
  const matches = (file, pattern) => path.posix.matchesGlob(file.slice(7), pattern)
  for (const pattern of patterns) {
    const negative = pattern.pattern.startsWith('!')
    if (negative) { gap(pattern.source, pattern.line, 'Patrón PWA con negación no modelado', pattern.pattern); continue }
    pattern.matchedFiles = assets.filter(asset => matches(asset.file, pattern.pattern)).map(asset => asset.file)
  }
  for (const asset of assets) {
    asset.configuredBy = patterns.filter(pattern => pattern.kind === 'includeAssets' && pattern.matchedFiles.includes(asset.file)).map(pattern => ({ kind: pattern.kind, pattern: pattern.pattern, source: pattern.source, line: pattern.line }))
    const workboxPatterns = patterns.filter(pattern => pattern.kind === 'workbox.globPatterns' && pattern.matchedFiles.includes(asset.file))
    const ignored = patterns.filter(pattern => pattern.kind === 'workbox.globIgnores' && pattern.matchedFiles.includes(asset.file))
    asset.workboxIgnores = ignored.map(pattern => pattern.pattern)
    if (!ignored.length) asset.configuredBy.push(...workboxPatterns.map(pattern => ({ kind: pattern.kind, pattern: pattern.pattern, source: pattern.source, line: pattern.line })))
    asset.status = asset.references.length ? 'referencia declarada' : asset.configuredBy.length ? 'solo configuración declarada' : 'sin coincidencia detectada'
  }
  const duplicateMap = new Map()
  for (const asset of assets) {
    if (!duplicateMap.has(asset.hash)) duplicateMap.set(asset.hash, [])
    duplicateMap.get(asset.hash).push(asset)
  }
  const duplicates = [...duplicateMap].filter(([, members]) => members.length > 1).map(([hash, members]) => ({ hash, bytesPerFile: members[0].bytes, files: members.map(item => item.file), includesLicenses: members.some(item => item.license) }))
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), analysis: 'static-public-resources',
    coverage: { files: assets.length, totalBytes: assets.reduce((sum, item) => sum + item.bytes, 0), sourceFiles: project.src.length, pwaDeclarations, model: 'public/ y configuración explícita; sin peticiones de red ni build' },
    assets, references, directoryReferences, missingReferences, caseMismatches, duplicates, patterns,
    configurationOnly: assets.filter(item => item.status === 'solo configuración declarada').map(item => item.file),
    unreferenced: assets.filter(item => item.status === 'sin coincidencia detectada').map(item => ({ file: item.file, bytes: item.bytes, license: item.license })),
    unmatchedIncludePatterns: patterns.filter(item => item.kind === 'includeAssets' && !item.pattern.startsWith('!') && !item.matchedFiles.length), uncertainties,
  }
}

export function renderPublicAssets(report, options = {}) {
  const { sourceRoot } = options
  return renderAnalysis('assets',report,[
    '## Datos de referencia · inventario público',
    table(['Archivos','Tamaño total','Solo configuración declarada','Sin referencia reconocida'],[[report.coverage.files,readableBytes(report.coverage.totalBytes),report.configurationOnly.length,report.unreferenced.length]]),
    table(['Recurso','Tamaño','Situación','Referencias declaradas','Configuración coincidente','Licencia / original protegido'],report.assets.map(item=>[sourceReference(item.file,1,sourceRoot),readableBytes(item.bytes),item.status,item.references.map(entry=>`${entryReference(entry,sourceRoot)} (${entry.kind})`).join('; ')||'Ninguna',item.configuredBy.map(entry=>`${entry.kind}: ${entry.pattern}`).join('; ')||'Ninguna',`${item.license} / ${item.protectedOriginal}`])),
    '## Datos de referencia · configuración PWA declarada',
    table(['Ubicación','Opción','Patrón','Coincidencias públicas'],report.patterns.map(item=>[entryReference(item,sourceRoot),item.kind,item.pattern,item.matchedFiles.length])),
    'Los globs se contrastan con archivos de public/. globIgnores no cancela includeAssets; globPatterns puede cubrir archivos generados por el build. No se infieren opciones predeterminadas, límites de caché ni recursos efectivamente precacheados.',
    '## Datos de referencia · directorios reconocidos',
    table(['Ubicación','Referencia','Directorio'],report.directoryReferences.map(item=>[entryReference(item,sourceRoot),item.value,item.target])),
    'Las referencias pueden proceder de código o CSS sin carga comprobada. No se consultan URLs externas, no se descargan teselas y no se leen documentos del usuario. Las ausencias, diferencias de mayúsculas, duplicados y limitaciones se reúnen una sola vez en los hallazgos anteriores.',
  ],options)
}
