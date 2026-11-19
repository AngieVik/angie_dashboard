import { collectFindings, markdownDocument, markdownText, renderFindings, sourceReference } from './findings.mjs'
import { reportDate, reportSection, wrapReport } from './report-format.mjs'
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

function inventoryArea(file) {
  const parts = file.split('/')
  if (parts.length <= 2) return parts.slice(0, -1).join('/') || 'Raíz'
  const depth = ['components', 'domain', 'features'].includes(parts[1]) ? 3 : 2
  return parts.slice(0, Math.min(depth, parts.length - 1)).join('/')
}

function renderInventoryFiles(report, reference) {
  const sources = new Map(report.sources.map(item => [item.file, item]))
  const files = new Map(report.files.map(item => [item.file, item.bytes]))
  for (const item of report.sources) {
    if (!files.has(item.file) && (item.components.length || item.jsx.length)) files.set(item.file, null)
  }
  const areas = new Map()
  const declarations = { class: 'clase', function: 'función', variable: 'variable' }
  for (const [file, bytes] of [...files].sort(([left], [right]) => compare(left, right))) {
    const area = inventoryArea(file)
    if (!areas.has(area)) areas.set(area, [])
    const label = area === 'Raíz' ? file : file.slice(area.length + 1)
    const rows = areas.get(area)
    rows.push(`- ${reference(file, 1, label)}${bytes === null ? '' : ` · ${bytes} B`}`)

    const source = sources.get(file)
    if (source?.components.length) {
      const items = source.components.map(item =>
        `\`${item.name}\` (${declarations[item.kind]}, ${item.exported ? 'export directo, ' : ''}L${item.line})`)
      rows.push(`  - Declaraciones React: ${items.join(', ')}`)
    }
    for (const [kind, description] of [['intrinsic', 'JSX intrínseco'], ['component', 'JSX de componentes']]) {
      const tags = source?.jsx.filter(tag => tag.kind === kind) ?? []
      if (tags.length) rows.push(`  - ${description}: ${tags.map(tag => `\`${tag.name}\` ×${tag.count}`).join(', ')}`)
    }
  }
  return [...areas].map(([area, rows]) => `### ${area}\n\n${rows.map(row => wrapReport(row)).join('\n')}`).join('\n\n')
}

export function renderAppInventory(report, { sourceRoot } = {}) {
  const reference = (file, line, label = path.posix.basename(file)) => sourceReference(file, line, sourceRoot, markdownText(label))
  const modules = Object.entries(report.modules.values)
  const elements = Object.entries(report.elements.catalog.values)
  const jsxFiles = report.sources.filter(item => item.jsx.length).length
  const { referenceNode, referenceNpm, currentNode } = report.environment
  const findings = report.findings ?? collectFindings({ inventory: report })

  return markdownDocument('Inventario de la aplicación',
    `**${report.files.length} archivos fuente · ${report.components.length} componentes candidatos · ${modules.length} módulos · ${elements.length} elementos**`,
    `${jsxFiles} archivos con JSX · ${report.elements.types.length} contratos · ${report.dependencies.length} dependencias directas.`,
    `${reportDate(report.generatedAt)} (Madrid). Lectura estática de las declaraciones y registros del proyecto.`,
    wrapReport('[Módulos](#módulos) · [Configuración](#configuración-y-comandos) · [Elementos](#elementos)'
      + ' · [Contratos](#contratos) · [Fuentes por área](#fuentes-por-área)'),
    findings.length ? renderFindings(findings, { sourceRoot, report }) : '',
    reportSection('Módulos', [
      `Registro en ${reference(report.modules.file, report.modules.line)}. La asociación se basa en el nombre del componente.`,
      ...modules.map(([id, item]) => {
        const name = id[0].toUpperCase() + id.slice(1) + 'Module'
        const candidates = report.components.filter(component => component.name === name)
        const component = candidates.length === 1 ? candidates[0]
          : candidates.find(candidate => candidate.file.startsWith(`src/features/${id}/`))
        const owner = component ? reference(component.file, component.line, component.name) : 'propietario sin identificar'
        return `- **${markdownText(item.name)}** (\`${id}\`) · ${owner}`
      }),
    ]),
    reportSection('Configuración y comandos', [
      `Proyecto \`${report.project.name}\` ${report.project.version}. Node de la revisión ${currentNode}.`,
      `Entorno de referencia: Node ${referenceNode ?? 'sin indicar'}, npm ${referenceNpm ?? 'sin indicar'}.`,
      `Archivos: ${report.configuration.map(file => reference(file, 1)).join(', ')}.`,
      ...Object.entries(report.project.scripts).map(([name, command]) => `- \`npm run ${name}\` → \`${command}\``),
    ]),
    reportSection('Elementos', [
      `Registro en ${reference(report.elements.catalog.file, report.elements.catalog.line)}.`,
      ...elements.map(([id, item]) =>
        `- **${markdownText(item.name)}** (\`${id}\`) · ${markdownText(item.visualClass)} · \`${item.path}\``),
    ]),
    '## Contratos\n\n' + report.elements.types.map(item =>
      `### ${item.name}\n\n${reference(item.file, item.line, `${path.posix.basename(item.file)}:${item.line}`)}`
      + `\n\n\`\`\`typescript\n${item.declaration}\n\`\`\``).join('\n\n'),
    '## Fuentes por área\n\n' + wrapReport('Tamaño en disco, declaraciones React y apariciones JSX, incluidas las ramas condicionales. '
      + 'React se reconoce por nombre y JSX. Los wrappers pueden requerir revisar la fuente. '
      + '«Export directo» indica que la declaración lleva export.') + '\n\n' + renderInventoryFiles(report, reference),
  ).trimEnd() + '\n'
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
    configuration, dependencies,
    files: files.map(file => ({ file: relative(file), bytes: fs.statSync(file).size })),
    sources,
    components: sources.flatMap(source => source.components),
    modules: registry('src/layout/moduleRegistry.ts', 'MODULE_REGISTRY'),
    elements: { catalog: registry('src/features/elements/iconCatalog.ts', 'ICON_CATALOG'), types },
  }
}
