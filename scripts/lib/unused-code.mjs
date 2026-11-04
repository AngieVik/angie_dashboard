import { renderAnalysis, markdownTable as table, sourceReference, entryReference } from './findings.mjs'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { root, relative, isCode as code, createProjectContext } from './project.mjs'
import { resolveCssKeys } from './css-keys.mjs'

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, child => { walk(child, visit) })
}

function location(node) {
  const source = node.getSourceFile()
  return { file: relative(source.fileName), line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 }
}

export function moduleDependencyType(node) {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause
    if (clause?.isTypeOnly) return 'type'
    const bindings = clause?.namedBindings
    if (!clause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length && bindings.elements.every(item => item.isTypeOnly)) return 'type'
  }
  if (ts.isExportDeclaration(node)) {
    if (node.isTypeOnly) return 'type'
    const clause = node.exportClause
    if (clause && ts.isNamedExports(clause) && clause.elements.length && clause.elements.every(item => item.isTypeOnly)) return 'type'
  }
  return 'runtime'
}

export function collectUnusedCode(project = createProjectContext()) {
  const sourceFiles = project.src.filter(file => !file.endsWith('/.gitkeep'))
  const tooling = project.tooling
  const configs = ['index.html', 'vite.config.ts', 'eslint.config.js'].filter(file => fs.existsSync(path.join(root, file)))
  const files = new Set([...sourceFiles, ...tooling, ...configs])
  const entries = [...tooling, ...configs, ...sourceFiles.filter(file => file.endsWith('.d.ts'))]
  const program = project.getProgram()
  const checker = program.getTypeChecker()
  const sources = new Map([...files].filter(code).map(file => [file, project.source(file)]))
  for (const [file, source] of sources) {
    if (!source) throw new Error(`No se pudo analizar ${file}`)
    if (source.parseDiagnostics.length) throw new Error(`${file}: ${ts.flattenDiagnosticMessageText(source.parseDiagnostics[0].messageText, ' ')}`)
  }
  const edges = [], uncertainties = [], cssBindings = new Map(), cssUsage = new Map(), resolvedCssAccesses = []
  const resolve = (specifier, from) => {
    const target = project.resolveLocal(specifier, from)
    return target && files.has(target) ? target : null
  }
  const addEdge = (from, specifier, kind, line, dependencyType = 'resource') => {
    const to = resolve(specifier, from)
    if (to) edges.push({ from, to, kind, line, specifier, dependencyType: /\.d\.[cm]?ts$/.test(from) || /\.d\.[cm]?ts$/.test(to) ? 'type' : dependencyType })
    else if (/^(?:\.|@\/|\/src\/)/.test(specifier) && !specifier.endsWith('/')) {
      const target = path.resolve(root, path.dirname(from), specifier)
      if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) uncertainties.push({ file: from, line, kind: 'referencia local sin resolver', expression: specifier })
    }
    return to
  }
  for (const [file, source] of sources) {
    const bindings = new Map()
    walk(source, node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        const to = addEdge(file, node.moduleSpecifier.text, ts.isImportDeclaration(node) ? 'import' : 'reexport', location(node).line, moduleDependencyType(node))
        if (to?.endsWith('.module.css') && ts.isImportDeclaration(node)) {
          const name = node.importClause?.name ?? (node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings) ? node.importClause.namedBindings.name : null)
          if (name) bindings.set(name.text, to)
        }
      }
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) addEdge(file, node.argument.literal.text, 'import de tipo', location(node).line, 'type')
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) addEdge(file, node.arguments[0].text, 'import dinámico literal', location(node).line, 'dynamic')
        else uncertainties.push({ ...location(node), kind: 'import dinámico no literal', expression: node.getText() })
      }
      if (ts.isCallExpression(node) && node.expression.getText() === 'import.meta.glob') uncertainties.push({ ...location(node), kind: 'glob no expandido', expression: node.getText() })
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) addEdge(file, node.moduleReference.expression.text, 'import require', location(node).line, node.isTypeOnly ? 'type' : 'runtime')
      if (ts.isCallExpression(node) && ['require', 'require.resolve', 'import.meta.resolve'].includes(node.expression.getText())) {
        const argument = node.arguments[0]
        const kind = node.expression.getText()
        if (argument && ts.isStringLiteralLike(argument)) addEdge(file, argument.text, kind, location(node).line, kind === 'require' ? 'runtime' : 'resolution')
        else uncertainties.push({ ...location(node), kind: 'carga/resolución no literal', expression: node.getText() })
      }
      if (ts.isNewExpression(node) && node.expression.getText() === 'URL' && node.arguments?.[1]?.getText() === 'import.meta.url') {
        const argument = node.arguments[0]
        const worker = ts.isNewExpression(node.parent) && ['Worker', 'SharedWorker'].includes(node.parent.expression.getText()) && node.parent.arguments?.[0] === node
        if (argument && ts.isStringLiteralLike(argument)) addEdge(file, argument.text, 'URL local / worker', location(node).line, worker ? 'worker' : 'url')
        else uncertainties.push({ ...location(node), kind: 'URL local no literal', expression: node.getText() })
      }
    })
    cssBindings.set(file, bindings)
  }
  for (const file of files) {
    if (file.endsWith('.css')) {
      const text = project.read(file)
      for (const match of text.matchAll(/(?:url\(\s*['"]?([^)'"\s]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"])/g)) {
        const specifier = match[1] ?? match[2]
        if (!/^(?:data:|https?:|\/|#)/.test(specifier)) {
          const local = specifier.startsWith('.') ? specifier : './' + specifier
          // Bare @import can name a package; url() remains relative to the sheet.
          if (match[1] || specifier.startsWith('.') || resolve(local, file)) addEdge(file, local, 'recurso CSS', text.slice(0, match.index).split('\n').length)
        }
      }
    }
    if (file.endsWith('.html')) {
      const text = project.read(file)
      for (const match of text.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g)) addEdge(file, match[1], 'entrada HTML', text.slice(0, match.index).split('\n').length)
    }
    if (file.endsWith('.json') && file.startsWith('src/')) {
      const text = project.read(file)
      for (const match of text.matchAll(/"\$ref"\s*:\s*"([^"#]+)(?:#[^"]*)?"/g)) if (!/^[a-z]+:/i.test(match[1])) addEdge(file, match[1].startsWith('.') ? match[1] : './' + match[1], 'referencia de esquema', text.slice(0, match.index).split('\n').length)
    }
  }
  const outgoing = new Map(), incoming = new Map()
  for (const edge of edges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, [])
    if (!incoming.has(edge.to)) incoming.set(edge.to, [])
    outgoing.get(edge.from).push(edge)
    incoming.get(edge.to).push(edge)
  }
  const reachable = new Set(), queue = [...entries]
  while (queue.length) {
    const file = queue.pop()
    if (reachable.has(file)) continue
    reachable.add(file)
    for (const edge of outgoing.get(file) ?? []) queue.push(edge.to)
  }
  const detached = sourceFiles.filter(file => !reachable.has(file)).map(file => ({ file, line: 1, bytes: fs.statSync(path.join(root, file)).size, consumers: incoming.get(file) ?? [] }))

  const canonical = symbol => symbol && (symbol.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(symbol) : symbol
  const exported = [], tracked = new Set(), forwarded = new Map(), references = new Map()
  for (const [file, source] of sources) {
    if (!file.startsWith('src/') || !reachable.has(file) || source.isDeclarationFile) continue
    const moduleSymbol = checker.getSymbolAtLocation(source)
    if (!moduleSymbol) continue
    for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
      const target = canonical(symbol)
      const declaration = target?.declarations?.find(node => relative(node.getSourceFile().fileName) === file)
      // Barrels forward the original declaration; do not duplicate their findings.
      if (!declaration) continue
      exported.push({ name: symbol.name, symbol: target, ...location(declaration), declarationKind: ts.SyntaxKind[declaration.kind] })
      tracked.add(target)
    }
  }
  for (const source of sources.values()) walk(source, node => {
    if (ts.isBindingElement(node) && ts.isIdentifier(node.name) && ts.isObjectBindingPattern(node.parent) && ts.isVariableDeclaration(node.parent.parent) && node.parent.parent.initializer) {
      const property = (node.propertyName ?? node.name).getText().replace(/^['"]|['"]$/g, '')
      const target = canonical(checker.getPropertyOfType(checker.getTypeAtLocation(node.parent.parent.initializer), property))
      const local = checker.getSymbolAtLocation(node.name)
      if (local && tracked.has(target)) forwarded.set(local, target)
    }
  })
  const wiring = node => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true
      if (ts.isStatement(parent)) break
    }
    return false
  }
  const declarationName = node => {
    const parent = node.parent
    return parent.name === node && (ts.isVariableDeclaration(parent) || ts.isBindingElement(parent) || ts.isParameter(parent) || ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent) || ts.isEnumDeclaration(parent) || ts.isTypeParameterDeclaration(parent))
  }
  for (const [file, source] of sources) walk(source, node => {
    if (!ts.isIdentifier(node) || wiring(node) || declarationName(node)) return
    const rawSymbol = ts.isShorthandPropertyAssignment(node.parent) ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node)
    const symbol = forwarded.get(rawSymbol) ?? canonical(rawSymbol)
    if (tracked.has(symbol)) {
      if (!references.has(symbol)) references.set(symbol, [])
      references.get(symbol).push(location(node))
    }
    const stylesheet = cssBindings.get(file).get(node.text)
    if (!stylesheet || !ts.isIdentifier(node)) return
    // Confirm binding identity so a shadowed local named "styles" cannot count.
    const imported = rawSymbol?.declarations?.some(declaration => ts.isImportClause(declaration) || ts.isNamespaceImport(declaration))
    if (!imported) return
    if (!cssUsage.has(stylesheet)) cssUsage.set(stylesheet, { classes: new Set(), dynamic: [] })
    const usage = cssUsage.get(stylesheet), parent = node.parent
    if (ts.isPropertyAccessExpression(parent) && parent.expression === node) usage.classes.add(parent.name.text)
    else if (ts.isElementAccessExpression(parent) && parent.expression === node) {
      const resolved = resolveCssKeys(parent.argumentExpression, checker)
      if (resolved) {
        for (const name of resolved.classes) usage.classes.add(name)
        if (!parent.argumentExpression || !ts.isStringLiteralLike(parent.argumentExpression)) resolvedCssAccesses.push({ ...location(parent), stylesheet, expression: parent.getText(), ...resolved })
      } else usage.dynamic.push({ ...location(node), expression: parent.getText().slice(0, 180) })
    }
    else usage.dynamic.push({ ...location(node), expression: parent.getText().slice(0, 180) })
  })
  const unusedExports = exported.flatMap(item => {
    const uses = references.get(item.symbol) ?? []
    const outside = uses.filter(use => use.file !== item.file && reachable.has(use.file))
    if (outside.length) return []
    const local = uses.filter(use => use.file === item.file)
    const detachedUses = uses.filter(use => use.file !== item.file && !reachable.has(use.file))
    return [{ name: item.name, file: item.file, line: item.line, declarationKind: item.declarationKind,
      category: local.length ? 'export usado solo dentro de su archivo' : 'export sin referencias detectadas desde archivos conectados',
      localReferences: local.length, disconnectedReferences: detachedUses.length, examples: [...local, ...detachedUses].slice(0, 5),
    }]
  })
  const unusedClasses = []
  for (const file of sourceFiles.filter(file => file.endsWith('.module.css') && reachable.has(file))) {
    const usage = cssUsage.get(file) ?? { classes: new Set(), dynamic: [] }
    if (usage.dynamic.length) { uncertainties.push(...usage.dynamic.map(item => ({ ...item, kind: `acceso dinámico a clases de ${file}` }))); continue }
    const classes = new Map()
    for (const rule of project.css(file, { allDeclarations: true })) {
      if (rule.selector.startsWith('@') || rule.context.some(context => /keyframes\b/.test(context))) continue
      const localSelector = rule.selector.replace(/:global\([^()]*\)/g, '').replace(/\[[^\]]*\]/g, '')
      for (const match of localSelector.matchAll(/\.([A-Za-z_][\w-]*)/g)) if (!classes.has(match[1])) classes.set(match[1], { file, line: rule.line, selector: rule.selector, context: rule.context })
    }
    for (const [name, declaration] of classes) if (!usage.classes.has(name)) unusedClasses.push({ name, ...declaration })
  }
  const localUnused = program.getSemanticDiagnostics().filter(diagnostic => [6133, 6192, 6196, 6198].includes(diagnostic.code) && diagnostic.file && relative(diagnostic.file.fileName).startsWith('src/') && reachable.has(relative(diagnostic.file.fileName)))
    .map(diagnostic => ({ code: diagnostic.code, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '), file: relative(diagnostic.file.fileName), line: diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1 }))
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), analysis: 'static-candidates', entries,
    coverage: { sourceFiles: sourceFiles.length, codeFiles: sources.size, connectedFiles: sourceFiles.filter(file => reachable.has(file)).length, edges: edges.length },
    detachedFiles: detached, unusedExports, localUnused, unusedClasses, uncertainties, resolvedCssAccesses, graph: edges,
  }
}

export function renderUnusedCode(report, options = {}) {
  const { sourceRoot } = options
  return renderAnalysis('unused',report,[
    '## Datos de referencia · cobertura',
    table(['Archivos de src','Conectados desde entradas','Archivos sin recorrido','Relaciones del grafo'],[[report.coverage.sourceFiles,report.coverage.connectedFiles,report.detachedFiles.length,report.coverage.edges]]),
    'Las familias de archivos, declaraciones y clases detectadas se reúnen en los hallazgos anteriores, con sus consumidores y ubicaciones. Los bytes de fuente no son bytes del bundle ni memoria de ejecución.',
    '## Datos de referencia · accesos computados a CSS resueltos',
    'Son alternativas estáticas posibles, no clases observadas simultáneamente en navegador. Los accesos no acotados se identifican como limitaciones.',
    table(['Ubicación','Hoja','Expresión','Clases posibles','Base de la resolución'],(report.resolvedCssAccesses??[]).map(item=>[entryReference(item,sourceRoot),sourceReference(item.stylesheet,1,sourceRoot),item.expression,item.classes.join(', '),item.basis.join('; ')])),
    '## Datos de referencia · entradas del recorrido',
    table(['Entrada protegida'],report.entries.map(file=>[sourceReference(file,1,sourceRoot)])),
    'HTML/configuraciones conocidas, herramientas, servidor y declaraciones ambientales son entradas. Los originales públicos y los datos guardados del usuario quedan fuera de este análisis. No se reconstruye la intención de componentes reservados ni se acredita ausencia de todos los usos dinámicos.',
  ],options)
}

