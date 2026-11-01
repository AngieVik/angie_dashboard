import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { fileURLToPath, URL } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'output/ui-styles')
const relative = file => path.relative(root, file).replaceAll('\\', '/')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const measures = /^(?:(?:min-|max-)?(?:width|height|inline-size|block-size)|font(?:-.+)?|line-height|letter-spacing|padding(?:-.+)?|gap|row-gap|column-gap|box-sizing|flex-basis)$/
const bases = {
  module: { file: 'src/layout/moduleFrame.module.css', classes: ['base', 'module-scaled-content'] },
  fileDialog: { file: 'src/features/document/fileDialog.module.css', classes: ['surface', 'body'] },
  alertDialog: { file: 'src/components/ui/alert-dialog/alert-dialog.module.css', classes: ['base'] },
  sheet: { file: 'src/components/ui/sheet/sheet.module.css', classes: ['content'] },
  toast: { file: 'src/components/ui/sonner/sonner.module.css', classes: ['toast'] },
}

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : entry.isFile() ? [relative(file)] : []
  })
}

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, child => { walk(child, visit) })
}

function at(node) {
  const source = node.getSourceFile()
  return { file: relative(source.fileName), line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 }
}

function unwrap(node) {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression
  return node
}

function literal(node, constants = new Map(), seen = new Set()) {
  node = unwrap(node)
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isIdentifier(node) && constants.has(node.text) && !seen.has(node.text)) return literal(constants.get(node.text), constants, new Set([...seen, node.text]))
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(item => literal(item, constants, seen))
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(item => [item.name.getText().replace(/^['"]|['"]$/g, ''), literal(item.initializer, constants, seen)]))
  return { expression: node.getText() }
}

function constantsOf(source) {
  const values = new Map()
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) for (const item of statement.declarationList.declarations) {
      if (ts.isIdentifier(item.name) && item.initializer) values.set(item.name.text, item.initializer)
    }
  }
  return values
}

// Preserve quoted strings, parentheses and line numbers while reading CSS blocks.
// This records declarations and their contexts; it does not implement the cascade.
function parseCss(file) {
  const text = read(file)
  let clean = '', quote = '', comment = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1]
    if (comment) {
      if (char === '*' && next === '/') { clean += '  '; i++; comment = false }
      else clean += char === '\n' ? '\n' : ' '
    } else if (quote) {
      clean += char
      if (char === '\\') clean += text[++i] ?? ''
      else if (char === quote) quote = ''
    } else if (char === '/' && next === '*') { clean += '  '; i++; comment = true }
    else { clean += char; if (char === '"' || char === "'") quote = char }
  }
  const rules = [], stack = []
  let start = 0, depth = 0
  quote = ''
  const line = index => clean.slice(0, index).split('\n').length
  const declaration = end => {
    const chunk = clean.slice(start, end).trim(), colon = chunk.indexOf(':')
    if (!stack.length || colon < 1) return
    const property = chunk.slice(0, colon).trim(), value = chunk.slice(colon + 1).trim()
    if (property.startsWith('--') || measures.test(property) || (property === 'src' && stack.at(-1).selector === '@font-face')) stack.at(-1).declarations.push({ property, value, file, line: line(start + clean.slice(start, end).search(/\S/)) })
  }
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    if (quote) { if (char === '\\') i++; else if (char === quote) quote = ''; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(' || char === '[') depth++
    if (char === ')' || char === ']') depth--
    if (depth) continue
    if (char === '{') {
      const selector = clean.slice(start, i).trim()
      stack.push({ selector, context: stack.map(item => item.selector), file, line: line(start + clean.slice(start, i).search(/\S/)), declarations: [] })
      start = i + 1
    } else if (char === ';') { declaration(i); start = i + 1 }
    else if (char === '}') {
      declaration(i)
      const rule = stack.pop()
      if (!rule) throw new Error(`Llave CSS inesperada en ${file}:${line(i)}`)
      if (rule.declarations.length) rules.push(rule)
      start = i + 1
    }
  }
  if (stack.length || quote || comment || depth) throw new Error(`CSS incompleto en ${file}`)
  return rules.sort((a, b) => a.line - b.line)
}

function expand(value, variables, seen = new Set()) {
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (match, name, fallback) => {
    if (seen.has(name)) return match
    const next = variables[name] ?? fallback
    return next === undefined ? match : expand(next, variables, new Set([...seen, name]))
  })
}

export function collectUiStyles() {
  const files = filesIn(path.join(root, 'src'))
  const sources = new Map(files.filter(file => /\.[cm]?[jt]sx?$/.test(file)).map(file => [file, ts.createSourceFile(path.join(root, file), read(file), ts.ScriptTarget.Latest, true)]))
  for (const [file, source] of sources) if (source.parseDiagnostics.length) throw new Error(`${file}: ${ts.flattenDiagnosticMessageText(source.parseDiagnostics[0].messageText, ' ')}`)
  const stylesheets = new Map(files.filter(file => file.endsWith('.css')).map(file => [file, parseCss(file)]))
  const usedCss = new Set(['src/styles/tokens.css', 'src/styles/global.css', 'src/styles/fonts.css', ...Object.values(bases).map(base => base.file)])
  const rootRules = stylesheets.get('src/styles/tokens.css').filter(rule => rule.selector === ':root')
  const rootVariables = Object.fromEntries(rootRules.flatMap(rule => rule.declarations.filter(item => item.property.startsWith('--')).map(item => [item.property, item.value])))
  const simpleRules = (file, name) => (stylesheets.get(file) ?? []).filter(rule => rule.context.every(context => context.startsWith('@layer')) && rule.selector.split(',').some(selector => (name === 'body' ? ['body'] : [`.${name}`, `:where(.${name})`, `:global(.${name})`]).includes(selector.trim())))
  const refsOfBase = name => bases[name].classes.map(className => ({ file: bases[name].file, className }))
  const rulesOfRefs = refs => refs.flatMap(ref => { usedCss.add(ref.file); return simpleRules(ref.file, ref.className) })
  const variablesOf = rules => Object.fromEntries(rules.flatMap(rule => rule.declarations.filter(item => item.property.startsWith('--')).map(item => [item.property, item.value])))
  const bodyRules = simpleRules('src/styles/global.css', 'body')
  const scaledRules = stylesheets.get(bases.module.file).filter(rule => rule.selector === ':where(.base) :global(.module-scaled-content)')
  const moduleVariables = { ...rootVariables, ...variablesOf(rulesOfRefs(refsOfBase('module'))), ...variablesOf(scaledRules), '--module-zoom': '1' }
  const profile = (refs, moduleContext = false) => {
    const rules = rulesOfRefs(refs)
    const variables = { ...(moduleContext ? moduleVariables : rootVariables), ...variablesOf(rules) }
    const properties = {}
    for (const rule of rules) for (const item of rule.declarations) if (measures.test(item.property)) properties[item.property] = { ...item, baseExpansion: expand(item.value, variables) }
    const inheritedTypography = Object.fromEntries(bodyRules.flatMap(rule => rule.declarations.filter(item => item.property.startsWith('font') || item.property === 'line-height').map(item => [item.property, { ...item, baseExpansion: expand(item.value, variables) }])))
    if (moduleContext) inheritedTypography['font-size'] = { value: 'var(--font-size-body)', baseExpansion: expand('var(--font-size-body)', variables), file: bases.module.file, line: scaledRules[0]?.line, note: 'Referencia de herencia del contenido escalado; zoom base 1.' }
    return { refs, properties, inheritedTypography }
  }
  const resolve = (file, specifier) => {
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null
    const target = specifier.startsWith('@/') ? `src/${specifier.slice(2)}` : relative(path.resolve(root, path.dirname(file), specifier))
    return [target, `${target}.tsx`, `${target}.ts`, `${target}/index.ts`, `${target}/index.tsx`].find(candidate => sources.has(candidate) || stylesheets.has(candidate)) ?? null
  }
  const imports = new Map(), definitions = new Map()
  for (const [file, source] of sources) {
    const bindings = new Map()
    for (const statement of source.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text, target = resolve(file, specifier), clause = statement.importClause
      if (clause?.name) bindings.set(clause.name.text, { target, specifier, imported: 'default' })
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const item of clause.namedBindings.elements) bindings.set(item.name.text, { target, specifier, imported: item.propertyName?.text ?? item.name.text })
    }
    imports.set(file, bindings)
    for (const statement of source.statements) if (ts.isFunctionDeclaration(statement) && statement.name) definitions.set(`${file}#${statement.name.text}`, statement)
  }
  const classRefs = (node, file) => {
    const refs = []
    const attribute = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText() === 'className')
    if (attribute?.initializer) walk(attribute.initializer, item => {
      if (ts.isPropertyAccessExpression(item) && ts.isIdentifier(item.expression)) {
        const binding = imports.get(file).get(item.expression.text)
        if (binding?.target?.endsWith('.css')) refs.push({ file: binding.target, className: item.name.text })
      }
      if (ts.isElementAccessExpression(item) && ts.isIdentifier(item.expression) && item.argumentExpression && ts.isStringLiteralLike(item.argumentExpression)) {
        const binding = imports.get(file).get(item.expression.text)
        if (binding?.target?.endsWith('.css')) refs.push({ file: binding.target, className: item.argumentExpression.text })
      }
    })
    return refs
  }
  const cssIn = file => [...imports.get(file).values()].map(item => item.target).filter(target => target?.endsWith('.css'))
  const attributeValue = (node, name) => {
    const attribute = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText() === name)
    if (!attribute) return undefined
    if (!attribute.initializer) return true
    const value = ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : attribute.initializer
    return value ? literal(value) : undefined
  }
  const defaults = name => {
    const node = definitions.get(`src/features/document/FileDialog.tsx#${name}`)
    return Object.fromEntries(node?.parameters.flatMap(parameter => ts.isObjectBindingPattern(parameter.name) ? parameter.name.elements.filter(item => item.initializer).map(item => [item.name.getText(), { value: literal(item.initializer), ...at(item) }]) : []) ?? [])
  }
  const dialogDefaults = defaults('FileDialogContent')
  const dialogMinimum = []
  walk(sources.get('src/features/document/FileDialog.tsx'), node => {
    if (ts.isPropertyAssignment(node) && ['minW', 'minH'].includes(node.name.getText())) dialogMinimum.push({ property: node.name.getText(), value: literal(node.initializer), ...at(node) })
  })
  const ownerOf = node => {
    for (let current = node.parent; current; current = current.parent) {
      if ((ts.isFunctionDeclaration(current) || ts.isClassDeclaration(current)) && current.name) return current.name.text
      if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name) && current.initializer && (ts.isArrowFunction(current.initializer) || ts.isFunctionExpression(current.initializer))) return current.name.text
    }
    return '(archivo)'
  }
  const openingOf = node => {
    node = unwrap(node)
    if (ts.isJsxElement(node)) return node.openingElement
    if (ts.isJsxSelfClosingElement(node)) return node
    if (ts.isJsxFragment(node)) for (const child of node.children) {
      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) return openingOf(child)
    }
    return null
  }
  const componentRoot = (file, name, visited = new Set()) => {
    const key = `${file}#${name}`, definition = definitions.get(key)
    if (!definition || visited.has(key)) return { refs: [], delegated: [], stylesheets: cssIn(file) }
    visited.add(key)
    const returned = definition.body?.statements.filter(ts.isReturnStatement).map(item => item.expression && openingOf(item.expression)).find(Boolean)
    const refs = returned ? classRefs(returned, file) : []
    const returnedName = returned?.tagName.getText()
    const binding = returnedName && (imports.get(file).get(returnedName) ?? (definitions.has(`${file}#${returnedName}`) ? { target: file, imported: returnedName } : null))
    if (binding?.target && sources.has(binding.target)) {
      const inherited = componentRoot(binding.target, binding.imported, visited)
      return { refs: [...inherited.refs, ...refs], delegated: [{ name: binding.imported, file: binding.target }, ...inherited.delegated], stylesheets: [...new Set([...cssIn(file), ...inherited.stylesheets])] }
    }
    return { refs, delegated: [], stylesheets: cssIn(file) }
  }
  const registrySource = sources.get('src/layout/moduleRegistry.ts')
  if (!registrySource) throw new Error('No se encuentra src/layout/moduleRegistry.ts')
  const constants = constantsOf(registrySource), registryNode = constants.get('MODULE_REGISTRY')
  if (!registryNode) throw new Error('No se encuentra MODULE_REGISTRY')
  const registry = literal(registryNode, constants)
  if (registry.expression) throw new Error('MODULE_REGISTRY no es un objeto literal')
  const modules = Object.entries(registry).map(([id, settings]) => {
    const name = id[0].toUpperCase() + id.slice(1) + 'Module'
    const definition = [...definitions.values()].find(item => item.name.text === name)
    const location = definition ? at(definition) : null
    const component = definition ? componentRoot(location.file, name) : { refs: [], delegated: [], stylesheets: [] }
    component.stylesheets.forEach(file => usedCss.add(file))
    return { id, name: settings.name, component: name, definition: location, registry: at(registryNode), settings, ...component, style: profile(component.refs, true), minimumNote: 'minimum es el suelo del registro, incluido colapsado; el mínimo expandido depende de constrainWindowContentSize y del contenido.' }
  })
  const surfaces = [], notices = []
  for (const [file, source] of sources) walk(source, node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(), binding = imports.get(file).get(tag), canonical = binding?.imported ?? tag
      const role = attributeValue(node, 'role')
      const base = canonical === 'FileDialogContent' ? 'fileDialog' : canonical === 'AlertDialogContent' ? 'alertDialog' : canonical === 'SheetContent' ? 'sheet' : null
      const semantic = ['alert', 'alertdialog', 'dialog'].includes(role)
      if (!base && !semantic) return
      let title = attributeValue(node, 'title') ?? attributeValue(node, 'aria-label')
      if (!title && ts.isJsxElement(node.parent)) walk(node.parent, child => {
        if (title || !ts.isJsxElement(child) || !/(?:Dialog|Sheet)Title$/.test(child.openingElement.tagName.getText())) return
        title = child.children.map(item => ts.isJsxText(item) ? item.text.trim() : ts.isJsxExpression(item) && item.expression ? formatValue(literal(item.expression)) : '').filter(Boolean).join(' ')
      })
      const refs = [...(base ? refsOfBase(base) : []), ...classRefs(node, file)]
      const props = Object.fromEntries(['width', 'height', 'fitToContent', 'side', 'style'].map(name => [name, attributeValue(node, name)]).filter(([, value]) => value !== undefined))
      const initial = base === 'fileDialog' ? Object.fromEntries(['width', 'height', 'fitToContent'].map(name => [name, { value: props[name] ?? dialogDefaults[name]?.value ?? null, source: props[name] === undefined ? dialogDefaults[name] : at(node) }])) : null
      cssIn(file).forEach(css => usedCss.add(css))
      surfaces.push({ kind: base === 'sheet' ? 'panel modal' : role === 'alert' ? 'alerta inline' : 'diálogo/modal', owner: ownerOf(node), title: title ?? canonical, tag, base, role: role ?? null, ...at(node), props, initial, minimumConstraints: base === 'fileDialog' ? dialogMinimum : [], style: profile(refs), localStylesheets: cssIn(file) })
    }
    if (ts.isCallExpression(node)) {
      const call = node.expression
      const name = ts.isIdentifier(call) ? call.text : ts.isPropertyAccessExpression(call) && ts.isIdentifier(call.expression) ? call.expression.text : null
      const binding = imports.get(file).get(name)
      const method = ts.isPropertyAccessExpression(call) ? call.name.text : 'message'
      if (binding?.imported === 'toast' && /(?:sonner|ui\/sonner)/.test(binding.specifier) && !['dismiss', 'getHistory', 'getToasts'].includes(method)) {
        notices.push({ kind: 'toast', method, owner: ownerOf(node), message: node.arguments[0] ? literal(node.arguments[0]) : null, base: 'toast', ...at(node) })
      }
      if ((name === 'window' && ['alert', 'confirm', 'prompt'].includes(method)) || (ts.isIdentifier(call) && ['alert', 'confirm', 'prompt'].includes(name) && !binding)) notices.push({ kind: 'nativo', method: ts.isIdentifier(call) ? name : method, owner: ownerOf(node), message: node.arguments[0] ? literal(node.arguments[0]) : null, base: null, ...at(node) })
    }
  })
  const sizingSources = ['src/layout/windowContentSize.ts', 'src/layout/ModuleFrame.tsx', 'src/layout/DashboardGrid.tsx', 'src/features/document/FileDialog.tsx', 'src/layout/WindowResize.tsx']
  const sizingEvidence = sizingSources.flatMap(file => read(file).split(/\r?\n/).flatMap((text, index) => /constrainWindowContentSize|minimum\[|minW:|minH:|Math\.(?:min|max)\(27|minimumHeight|headerWidth|content\.scrollWidth/.test(text) ? [{ file, line: index + 1, expression: text.trim() }] : []))
  const baseProfiles = Object.fromEntries(Object.keys(bases).map(name => [name, profile(refsOfBase(name), name === 'module')]))
  const css = [...usedCss].sort().map(file => ({ file, rules: stylesheets.get(file).map(rule => ({ ...rule, declarations: rule.declarations.map(item => ({ ...item, rootTokenExpansion: expand(item.value, rootVariables) })) })) }))
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), analysis: 'static', baseZoom: 1, moduleRegistry: at(registryNode), modules, surfaces, notices, dialogDefaults, dialogMinimum, baseProfiles, sizingEvidence, css }
}

function main() {
  const args = process.argv.slice(2)
  if (args.length) {
    if (args.length !== 1 || !['-h', '--help'].includes(args[0])) throw new Error('Argumentos no reconocidos. Usa --help.')
    console.log('Uso: node scripts/inspect-ui-styles.mjs\nGenera output/ui-styles/report.md y report.json. Lee código y CSS sin abrir el navegador.')
    return
  }
  const report = collectUiStyles()
  fs.mkdirSync(output, { recursive: true })
  const markdown = render(report)
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  fs.writeFileSync(path.join(output, 'report.md'), markdown)
  console.log(`Estilos: ${report.modules.length} módulos, ${report.surfaces.length} diálogos/paneles/alertas inline y ${report.notices.length} llamadas de aviso.\nInformes: ${relative(output)}/report.md y report.json`)
}

function formatValue(value) {
  return value === undefined || value === null ? 'sin declarar' : typeof value === 'object' ? value.expression ?? JSON.stringify(value) : String(value)
}

function render(report) {
  const ref = item => item ? `${item.file}:${item.line ?? 1}` : 'sin localizar'
  const escape = value => formatValue(value).replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', '')
  const table = (headers, rows) => [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${row.map(escape).join(' | ')} |`)].join('\n')
  const field = (style, property, inherited = false) => {
    const item = style.properties[property] ?? (inherited ? style.inheritedTypography[property] : undefined)
    return item ? `${item.baseExpansion}${style.properties[property] ? '' : ' (referencia heredada)'}` : 'sin declarar'
  }
  const paddings = style => Object.entries(style.properties).filter(([key]) => key.startsWith('padding')).map(([key, item]) => `${key}: ${item.baseExpansion}`).join('; ') || 'sin declarar en raíz'
  const dimensions = style => Object.entries(style.properties).filter(([key]) => /^(?:(?:min-|max-)?(?:width|height|inline-size|block-size))$/.test(key)).map(([key, item]) => `${key}: ${item.baseExpansion}`).join('; ') || 'sin declaración CSS en raíz'
  return [
    '# Tamaños, tipografía y padding de Angie',
    `Generado: ${report.generatedAt}. Análisis estático; zoom de referencia de módulos: 1.`,
    'Los valores iniciales, suelos del registro y mínimos CSS se muestran por separado. El mínimo expandido real requiere medir contenido, cabecera, controles, scrollbar y zoom en navegador. «Sin declarar» no significa 0; la tipografía puede heredarse. No se calcula la cascada CSS ni se ejecuta la app.',
    '## Módulos',
    table(['Módulo / componente', 'Inicial ancho × alto (px)', 'Suelo del registro (px)', 'Dimensiones CSS de raíz', 'Familia de referencia', 'Tamaño de letra de referencia', 'Padding de raíz', 'Fuente'], report.modules.map(item => [
      `${item.name} / ${item.component}`, item.settings.initial.join(' × '), item.settings.minimum.join(' × '), dimensions(item.style), field(item.style, 'font-family', true), field(item.style, 'font-size', true), paddings(item.style), ref(item.definition),
    ])),
    ...report.modules.filter(item => item.delegated.length).map(item => `${item.name} delega su raíz en ${item.delegated.map(part => `${part.name} (${part.file})`).join(' → ')}. Sus reglas y las del propietario aparecen en el detalle CSS.`),
    '## Diálogos, modales, paneles y alertas inline',
    'Una fila por aparición JSX; los títulos y props dinámicos se conservan como expresiones. FileDialogContent usa ancho/alto iniciales de sus props o defaults; su padding corresponde al cuerpo .body y su tipografía declarada a .surface. El contenido también recibe las reglas de ModuleFrame, incluidas las del contenido escalado. fitToContent, límites del viewport, zoom y ajustes del usuario pueden cambiar el tamaño mostrado. Una referencia heredada del body global no determina la herencia intermedia de alertas dentro de módulos o diálogos.',
    table(['Tipo / propietario', 'Título', 'Base', 'Inicial ancho × alto (px) / autoajuste', 'Suelo numérico en layout', 'Dimensiones CSS de raíz', 'Familia de referencia', 'Tamaño de letra de referencia', 'Padding', 'Ubicación'], report.surfaces.map(item => [
      `${item.kind} / ${item.owner}`, item.title, item.base ?? item.tag,
      item.initial ? `${formatValue(item.initial.width.value)} × ${formatValue(item.initial.height.value)}; fitToContent=${formatValue(item.initial.fitToContent.value)}` : 'según CSS/contenido',
      item.minimumConstraints.map(part => `${part.property}: ${formatValue(part.value)}px`).join('; ') || 'sin declarar',
      dimensions(item.style), field(item.style, 'font-family', true), field(item.style, 'font-size', true), paddings(item.style), ref(item),
    ])),
    '## Alertas y avisos toast',
    'Cada fila es una llamada en el código, no una instancia visible. Todos los toast usan la base compartida indicada más abajo. Las alertas inline están en la tabla anterior. Los avisos nativos, si existen, dependen del navegador.',
    table(['Tipo / método', 'Propietario', 'Mensaje o expresión', 'Base visual', 'Ubicación'], report.notices.map(item => [item.kind + '.' + item.method, item.owner, item.message, item.base ?? 'navegador', ref(item)])),
    '## Bases compartidas',
    'Las bases disponibles se incluyen aunque no tengan usos detectados. Se recogen declaraciones simples de las clases indicadas. Los selectores con estados, descendientes y condiciones permanecen en el detalle CSS; no se aplican como si fueran estilos de raíz.',
    table(['Base', 'Clases', 'Dimensiones declaradas', 'Familia de referencia', 'Tamaño de letra de referencia', 'Padding'], Object.entries(report.baseProfiles).map(([name, style]) => [name, style.refs.map(item => `${item.file} .${item.className}`).join('; '), dimensions(style), field(style, 'font-family', true), field(style, 'font-size', true), paddings(style)])),
    '## Código que condiciona los mínimos',
    table(['Ubicación', 'Expresión'], report.sizingEvidence.map(item => [ref(item), item.expression])),
    '## Reglas CSS, tokens y fuentes por propietario',
    'Se incluyen las hojas importadas por los módulos/superficies y las bases globales. Son declaraciones disponibles en esas hojas, incluidos descendientes y estados; no se afirma que todas coincidan con cada superficie. La expansión de esta sección usa solo tokens globales: las variables locales, herencia, zoom y condiciones deben contrastarse con su selector y contexto. calc(), clamp(), min(), porcentajes y unidades de viewport/contenedor se conservan sin convertirlos a píxeles.',
    ...report.css.map(sheet => `### ${sheet.file}\n\n${table(['Selector / contexto', 'Propiedad', 'Declarado', 'Expansión con tokens globales', 'Ubicación'], sheet.rules.flatMap(rule => rule.declarations.map(item => [[...rule.context, rule.selector].join(' → '), item.property, item.value, item.rootTokenExpansion, ref(item)])))}`),
    '',
  ].join('\n\n')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) {
    console.error(`Inventario de estilos no generado: ${error.message}`)
    process.exitCode = 1
  }
}
