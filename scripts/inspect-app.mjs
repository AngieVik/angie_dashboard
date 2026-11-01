import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { fileURLToPath, URL } from 'node:url'
import ts from 'typescript'

// Read syntax only: never import or evaluate application code.
const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'output/app-inventory')
const relative = value => path.relative(root, value).replaceAll('\\', '/')
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => compare(a.name, b.name))
    .flatMap(entry => {
      const file = path.join(directory, entry.name)
      // Ignore symlinks: the inventory stays inside the source tree.
      return entry.isDirectory() ? filesIn(file) : entry.isFile() ? [file] : []
    })
}

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

function markdown(report) {
  const escape = value => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', '<br>')
  const table = (headers, rows) => [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(escape).join(' | ')} |`),
  ].join('\n')
  const ref = item => `${item.file}:${item.line}`
  return [
    '# Inventario de Angie Dashboard',
    `Generado: ${report.generatedAt}. Proyecto: ${report.project.name} ${report.project.version}.`,
    'Análisis estático del checkout actual. Incluye código aunque no se use en ejecución. No representa el DOM, instancias montadas ni datos de UIBoards.',
    '## Resumen',
    table(['Archivos en src', 'Archivos analizados', 'Componentes candidatos', 'Usos JSX', 'Módulos', 'Iconos'], [[
      report.files.length, report.sources.length, report.components.length,
      report.sources.reduce((sum, source) => sum + source.jsx.reduce((count, tag) => count + tag.count, 0), 0),
      Object.keys(report.modules.values).length, Object.keys(report.elements.catalog.values).length,
    ]]),
    '## Stack y dependencias directas',
    `Node de referencia: ${report.environment.referenceNode ?? 'no indicado'}. npm de referencia: ${report.environment.referenceNpm ?? 'no indicado'}. Node que genera el informe: ${report.environment.currentNode}.`,
    table(['Configuración', 'Archivo'], report.configuration.map(file => [path.basename(file), file])),
    table(['Paquete', 'Grupo', 'Declarada', 'Resuelta en lock', 'Archivos que lo importan'], report.dependencies.map(item => [item.name, item.group, item.declared, item.locked, item.importedBy.length])),
    'Los usos de paquetes se detectan en src y en las configuraciones/servidor listados; no son una medición del bundle. La versión del lock no acredita la versión instalada.',
    '## Comandos npm',
    table(['Comando', 'Ejecución'], Object.entries(report.project.scripts)),
    '## Módulos registrados',
    `Fuente: ${ref(report.modules)}. Valores leídos sin ejecutar el registro.`,
    table(['Id', 'Nombre', 'Inicial', 'Mínimo', 'Modo', 'Altura por contenido', 'Límite automático'], Object.entries(report.modules.values).map(([id, item]) => [id, item.name, JSON.stringify(item.initial), JSON.stringify(item.minimum), item.sizeMode, item.contentHeight ?? false, item.autoHeightLimit])),
    '## Componentes React candidatos',
    'Declaraciones con nombre en PascalCase y JSX en su árbol sintáctico, incluidas funciones, clases y variables con wrappers. Reexportaciones y alias sin JSX no se duplican. Puede haber omisiones o falsos positivos; el nombre y el JSX son una heurística.',
    table(['Componente', 'Clase de declaración', 'Export directo', 'Ubicación'], report.components.map(item => [item.name, item.kind, item.exported, ref(item)])),
    '## Elementos JSX por archivo',
    'Cuenta apariciones en el código, incluidas ramas condicionales. Las etiquetas intrínsecas pueden ser HTML, SVG o elementos personalizados. El JSON conserva el origen importado y la primera línea de cada etiqueta.',
    table(['Archivo', 'Etiquetas intrínsecas (apariciones)', 'Componentes usados (apariciones)'], report.sources.filter(source => source.jsx.length).map(source => [
      source.file,
      source.jsx.filter(tag => tag.kind === 'intrinsic').map(tag => `${tag.name} (${tag.count})`).join(', '),
      source.jsx.filter(tag => tag.kind === 'component').map(tag => `${tag.name} (${tag.count})`).join(', '),
    ])),
    '## Catálogo de elementos operativos',
    `Fuente: ${ref(report.elements.catalog)}. Las instancias creadas por el usuario no se leen.`,
    table(['Id', 'Nombre', 'Recurso', 'Clase visual'], Object.entries(report.elements.catalog.values).map(([id, item]) => [id, item.name, item.path, item.visualClass])),
    '### Contratos de los elementos',
    ...report.elements.types.map(item => `**${item.name}** (${ref(item)})\n\n\`\`\`typescript\n${item.declaration}\n\`\`\``),
    '## Archivos fuente y estilos',
    table(['Archivo', 'Bytes'], report.files.map(file => [file.file, file.bytes])),
    'El JSON incluye además imports estáticos, reexportaciones e imports dinámicos literales por archivo. Las expresiones no literales de los registros se conservan como { expression }; no se evalúan.',
    '',
  ].join('\n\n')
}

function main() {
  const args = process.argv.slice(2)
  if (args.length) {
    if (args.length !== 1 || !['--help', '-h'].includes(args[0])) throw new Error('Argumentos no reconocidos. Usa node scripts/inspect-app.mjs --help')
    console.log('Uso: node scripts/inspect-app.mjs\nGenera output/app-inventory/report.md y report.json desde el código local. No ejecuta la app.')
    return
  }
  const manifest = readJson('package.json')
  const lock = readJson('package-lock.json')
  const guidance = fs.existsSync(path.join(root, 'AGENTS.md')) ? fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8') : ''
  const files = filesIn(path.join(root, 'src'))
  const configuration = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'eslint.config.js', 'server/server.mjs'].filter(file => fs.existsSync(path.join(root, file)))
  const sourcePaths = [...files.filter(file => /\.[cm]?[jt]sx?$/.test(file)), ...configuration.filter(file => /\.[cm]?[jt]s$/.test(file)).map(file => path.join(root, file))]
  const parsed = new Map(sourcePaths.map(file => [relative(file), ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)]))
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
  const report = {
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
  fs.mkdirSync(output, { recursive: true })
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  fs.writeFileSync(path.join(output, 'report.md'), markdown(report))
  console.log(`Inventario: ${report.files.length} archivos, ${report.components.length} componentes candidatos, ${Object.keys(report.modules.values).length} módulos.\nInformes: ${relative(output)}/report.md y report.json`)
}

try {
  main()
} catch (error) {
  console.error(`Inventario no generado: ${error.message}`)
  process.exitCode = 1
}
