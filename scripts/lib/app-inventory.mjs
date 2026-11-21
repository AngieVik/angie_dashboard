import { areaDocument } from './audit-report.mjs'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'
import { root, relative, createProjectContext } from './project.mjs'

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, child => { walk(child, visit) })
}

function unwrap(node) {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression
  return node
}

function location(source, node) {
  return { file: relative(source.fileName), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 }
}

function declarations(source) {
  const result = new Map()
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) result.set(declaration.name.text, declaration.initializer)
    }
  }
  return result
}

function literal(node, constants, seen = new Set()) {
  node = unwrap(node)
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (node.kind === ts.SyntaxKind.NullKeyword) return null
  if (ts.isIdentifier(node) && constants.has(node.text) && !seen.has(node.text)) {
    return literal(constants.get(node.text), constants, new Set([...seen, node.text]))
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(item => literal(item, constants, seen))
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.map(property => {
      if (ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name)) {
        return [property.name.text, literal(property.initializer, constants, seen)]
      }
      // Keep unsupported expressions visible instead of guessing their value.
      return [property.getText(), { expression: property.getText() }]
    }))
  }
  return { expression: node.getText() }
}

function jsxTag(node) {
  return ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
}

function hasJsx(node) {
  let found = false
  walk(node, child => {
    if (jsxTag(child) || ts.isJsxFragment(child)) found = true
  })
  return found
}

function analyze(source) {
  const imports = []
  const bindings = new Map()
  const components = []
  const tags = new Map()
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
      const from = statement.moduleSpecifier.text
      const clause = statement.importClause
      if (clause?.name) bindings.set(clause.name.text, { from, imported: 'default' })
      const named = clause?.namedBindings
      if (named && ts.isNamespaceImport(named)) bindings.set(named.name.text, { from, imported: '*' })
      if (named && ts.isNamedImports(named)) {
        for (const item of named.elements) bindings.set(item.name.text, { from, imported: item.propertyName?.text ?? item.name.text })
      }
    }
  }
  walk(source, node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      imports.push({ specifier: node.moduleSpecifier.text, kind: ts.isImportDeclaration(node) ? 'import' : 'reexport', ...location(source, node) })
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      imports.push({ specifier: node.arguments[0].text, kind: 'dynamic', ...location(source, node) })
    }
    const namedDeclaration = ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isVariableDeclaration(node)
    if (namedDeclaration && node.name && ts.isIdentifier(node.name) && /^[A-Z]/.test(node.name.text) && hasJsx(node)) {
      const statement = ts.isVariableDeclaration(node) ? node.parent.parent : node
      components.push({
        name: node.name.text,
        kind: ts.isClassDeclaration(node) ? 'class' : ts.isFunctionDeclaration(node) ? 'function' : 'variable',
        exported: Boolean(statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)),
        ...location(source, node),
      })
    }
    if (jsxTag(node)) {
      const name = node.tagName.getText(source)
      const item = tags.get(name) ?? {
        name,
        kind: /^[a-z]/.test(name) && !name.includes('.') ? 'intrinsic' : 'component',
        origin: bindings.get(name.split('.')[0]) ?? null,
        count: 0,
        ...location(source, node),
      }
      item.count++
      tags.set(name, item)
    }
  })
  return { file: relative(source.fileName), imports, components, jsx: [...tags.values()].sort((a, b) => compare(a.name, b.name)) }
}

export function renderAppInventory(r) {
  return areaDocument('inventory', r, [
    `${r.files.length} archivos, ${r.components.length} componentes candidatos y ${r.elements.types.length} contratos.`,
    `Módulos registrados: ${Object.values(r.modules.values).map(item => item.name).join(', ')}. Catálogo: ${Object.keys(r.elements.catalog.values).length} elementos.`,
    `Entradas con icono, carga y vista resueltos: ${r.moduleCoverage.resolved} de ${r.moduleCoverage.total}.`,
  ])
}

// Follow the keys used by AppHeader and by DashboardGrid's renderModule callback.
// An unrelated JSX use or an id comparison inside a button handler is not a render branch.
export function inspectModuleConsumers(registrySource, app, checker) {
  const objects = (source, name) => {
    const node = declarations(source).get(name)
    if (!node || !ts.isObjectLiteralExpression(unwrap(node))) throw new Error('No se pudo leer ' + name)
    const entries = new Map()
    for (const property of unwrap(node).properties) {
      if (!(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) || ts.isComputedPropertyName(property.name))
        throw new Error('Entrada no reconocida en ' + name + ': ' + property.getText())
      entries.set(property.name.text, property)
    }
    return entries
  }
  const registry = objects(registrySource, 'MODULE_REGISTRY'), icons = objects(registrySource, 'MODULE_ICONS')
  const factories = objects(app, 'moduleFactories'), branches = new Map(), uncertainties = [], issues = []
  let callback
  walk(app, node => {
    if (!jsxTag(node) || node.tagName.getText() !== 'DashboardGrid') return
    const attr = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText() === 'renderModule')
    if (attr?.initializer && ts.isJsxExpression(attr.initializer)) callback = attr.initializer.expression
  })
  let understood = false
  if (callback && ts.isArrowFunction(callback) && callback.parameters.length === 1) {
    let branch = unwrap(callback.body)
    while (ts.isConditionalExpression(branch)) {
      const condition = unwrap(branch.condition)
      if (!ts.isBinaryExpression(condition) || condition.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken ||
          condition.left.getText() !== callback.parameters[0].name.getText() || !ts.isStringLiteralLike(condition.right)) break
      branches.set(condition.right.text, unwrap(branch.whenTrue))
      branch = unwrap(branch.whenFalse)
    }
    understood = branch.kind === ts.SyntaxKind.NullKeyword
  }
  if (!understood) uncertainties.push({ ...location(app, callback ?? app), kind: 'renderModule no se pudo interpretar por completo', expression: 'DashboardGrid.renderModule' })
  let resolved = 0
  for (const [id, property] of registry) {
    const missing = []
    const icon = icons.get(id)
    if (!icon) missing.push('Falta el icono en MODULE_ICONS.')
    else {
      const symbol = ts.isShorthandPropertyAssignment(icon) ? checker.getShorthandAssignmentValueSymbol(icon) : checker.getSymbolAtLocation(icon.initializer)
      const target = symbol && (symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol)
      if (!target?.valueDeclaration) missing.push('El icono declarado en MODULE_ICONS no se resuelve.')
    }
    const factory = factories.get(id)
    if (!factory) missing.push('Falta la carga diferida en moduleFactories.')
    else {
      // Resolve the actual imported export using the TypeScript program, including reexports.
      let member, importCall
      walk(factory, n => {
        if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) importCall = n
        if (ts.isPropertyAssignment(n) && n.name.getText() === 'default' && ts.isPropertyAccessExpression(n.initializer)) member = n.initializer.name
      })
      if (!importCall || !member) uncertainties.push({ ...location(app, factory), kind: 'carga diferida no reconocida', expression: id })
      else if (!checker.getSymbolAtLocation(member)) missing.push('Importación o exportación sin resolver: ' + importCall.getText() + ' → ' + member.text)
    }
    const view = branches.get(id)
    if (!view && understood) missing.push('Falta la rama de renderizado en DashboardGrid.renderModule.')
    if (view) {
      const tag = ts.isJsxElement(view) ? view.openingElement.tagName : ts.isJsxSelfClosingElement(view) ? view.tagName : undefined
      const binding = tag && checker.getSymbolAtLocation(tag)?.valueDeclaration
      if (binding && ts.isBindingElement(binding) && binding.parent.parent.initializer?.getText() === 'moduleViews') {
        const key = (binding.propertyName ?? binding.name).getText()
        if (key !== id) missing.push('La rama dibuja la vista de ' + key + '.')
      } else if (view.kind === ts.SyntaxKind.NullKeyword || (tag && !binding)) missing.push('La rama carece de una vista resoluble.')
      else uncertainties.push({ ...location(app, view), kind: 'vínculo de vista no reconocido', expression: id })
    }
    if (missing.length) issues.push({ id, registry: location(registrySource, property), consumer: location(app, view ?? factory ?? callback ?? app), missing })
    else if (view && !uncertainties.some(gap => gap.expression === id)) resolved++
  }
  return { total: registry.size, resolved, issues, uncertainties }
}

export function collectAppInventory(project = createProjectContext()) {
  const readJson = project.readJson
  const manifest = readJson('package.json')
  const lock = readJson('package-lock.json')
  const guidance = fs.existsSync(path.join(root, 'AGENTS.md')) ? fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8') : ''
  const files = project.src.map(file => path.join(root, file))
  const configuration = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'eslint.config.js', 'server/server.mjs'].filter(file => fs.existsSync(path.join(root, file)))
  const sourcePaths = [...files.filter(file => /\.[cm]?[jt]sx?$/.test(file)), ...configuration.filter(file => /\.[cm]?[jt]s$/.test(file)).map(file => path.join(root, file))]
  const parsed = new Map(sourcePaths.map(file => [relative(file), project.source(file)]))
  for (const source of parsed.values()) {
    const error = source.parseDiagnostics[0]
    if (error) throw new Error(`${relative(source.fileName)}: ${ts.flattenDiagnosticMessageText(error.messageText, ' ')}`)
  }
  const sources = [...parsed.values()].map(analyze)
  const moduleCoverage = inspectModuleConsumers(project.source('src/layout/moduleRegistry.ts'), project.source('src/app/App.tsx'), project.getProgram().getTypeChecker())
  const registry = (file, name) => {
    const source = parsed.get(file)
    if (!source) throw new Error(`No se encuentra la fuente ${file}`)
    const constants = declarations(source)
    const node = constants.get(name)
    if (!node) throw new Error(`No se encuentra ${name} en ${file}`)
    const values = literal(node, constants)
    if (values.expression) throw new Error(`El registro ${name} ya no es un objeto literal; revisa el analizador`)
    return { ...location(source, node), values }
  }
  const dependencies = ['dependencies', 'devDependencies'].flatMap(group => Object.entries(manifest[group] ?? {}).map(([name, declared]) => ({
    name, group, declared, locked: lock.packages?.[`node_modules/${name}`]?.version ?? null,
    importedBy: [...new Set(sources.filter(source => source.imports.some(item => item.specifier === name || item.specifier.startsWith(`${name}/`))).map(source => source.file))],
  }))).sort((a, b) => compare(a.name, b.name))
  const domain = parsed.get('src/domain/document/types.ts')
  if (!domain) throw new Error('No se encuentra src/domain/document/types.ts')
  const types = domain.statements.filter(node => (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) && ['AssetId', 'ElementVisual', 'DocumentElement', 'PinTransform'].includes(node.name.text))
    .map(node => ({ name: node.name.text, declaration: node.getText(domain), ...location(domain, node) }))
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    project: { name: manifest.name, version: manifest.version, scripts: manifest.scripts },
    environment: {
      referenceNode: manifest.engines?.node ?? guidance.match(/Node\.js\s+(\d+\.\d+\.\d+)/)?.[1] ?? null,
      referenceNpm: manifest.engines?.npm ?? guidance.match(/npm\s+(\d+\.\d+\.\d+)/)?.[1] ?? null,
      currentNode: process.version,
    },
    configuration, dependencies, moduleCoverage, uncertainties: moduleCoverage.uncertainties,
    files: files.map(file => ({ file: relative(file), bytes: fs.statSync(file).size })),
    sources,
    components: sources.flatMap(source => source.components),
    modules: registry('src/layout/moduleRegistry.ts', 'MODULE_REGISTRY'),
    elements: { catalog: registry('src/features/elements/iconCatalog.ts', 'ICON_CATALOG'), types },
  }
}
