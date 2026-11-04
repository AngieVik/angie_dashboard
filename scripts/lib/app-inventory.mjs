import { renderAnalysis, markdownTable as table, sourceReference, entryReference, readableBytes } from './findings.mjs'
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

export function renderAppInventory(report, options = {}) {
  const { sourceRoot } = options
  return renderAnalysis('inventory',report,[
    '## Datos de referencia · inventario',
    table(['Archivos de src','Componentes candidatos','Módulos registrados','Elementos del catálogo'],[[report.files.length,report.components.length,Object.keys(report.modules.values).length,Object.keys(report.elements.catalog.values).length]]),
    `Node de referencia: ${report.environment.referenceNode??'no indicado'}; npm: ${report.environment.referenceNpm??'no indicado'}; Node de esta lectura: ${report.environment.currentNode}.`,
    '## Datos de referencia · configuración y comandos',
    table(['Configuración','Archivo'],report.configuration.map(file=>[path.basename(file),sourceReference(file,1,sourceRoot)])),
    table(['Comando npm','Ejecución'],Object.entries(report.project.scripts)),
    `${report.dependencies.length} dependencias directas declaradas en package.json. La declaración, instalación, requisitos y consumidores se diagnostican en dependencies.`,
    '## Datos de referencia · módulos y componentes propietarios',
    table(['Módulo','Id','Componente candidato','Fuente del componente','Registro'],Object.entries(report.modules.values).map(([id,item])=>{
      const name=id[0].toUpperCase()+id.slice(1)+'Module'
      const candidates=report.components.filter(component=>component.name===name)
      const component=candidates.length===1?candidates[0]:candidates.find(part=>part.file.startsWith(`src/features/${id}/`))
      return [item.name,id,component?.name??'No localizado por convención',component?entryReference(component,sourceRoot):'Sin propietario único reconocido',entryReference(report.modules,sourceRoot)]
    })),
    'La asociación por nombre es una convención del inventario, no prueba de montaje. Las medidas del registro se conservan en JSON y se presentan con su contexto en styles.',
    '## Datos de referencia · componentes React candidatos',
    table(['Componente','Declaración','Export directo','Ubicación'],report.components.map(item=>[item.name,item.kind,item.exported,entryReference(item,sourceRoot)])),
    'Los componentes se reconocen por nombre y JSX; factories o wrappers pueden limitar la detección. Una aparición en el inventario no es un hallazgo de código sin uso.',
    '## Datos de referencia · JSX por archivo',
    table(['Archivo','Etiquetas intrínsecas (apariciones)','Componentes usados (apariciones)'],report.sources.filter(source=>source.jsx.length).map(source=>[
      sourceReference(source.file,1,sourceRoot),source.jsx.filter(tag=>tag.kind==='intrinsic').map(tag=>`${tag.name} (${tag.count})`).join(', '),source.jsx.filter(tag=>tag.kind==='component').map(tag=>`${tag.name} (${tag.count})`).join(', '),
    ])),
    'Las apariciones JSX son texto del código, incluidas ramas condicionales; no son instancias visibles.',
    '## Datos de referencia · catálogo de elementos operativos',
    `Registro: ${entryReference(report.elements.catalog,sourceRoot)}. No se leen instancias creadas por el usuario.`,
    table(['Id','Nombre','Recurso declarado','Clase visual'],Object.entries(report.elements.catalog.values).map(([id,item])=>[id,item.name,item.path,item.visualClass])),
    ...report.elements.types.map(item=>`### Contrato: ${item.name}\n\n${entryReference(item,sourceRoot)}\n\n\`\`\`typescript\n${item.declaration}\n\`\`\``),
    '## Datos de referencia · archivos fuente',
    table(['Archivo','Tamaño fuente'],report.files.map(item=>[sourceReference(item.file,1,sourceRoot),readableBytes(item.bytes)])),
    'El JSON conserva también imports y expresiones de registros sin resolver. Los tamaños fuente no son coste del bundle ni consumo de memoria.',
  ],options)
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
