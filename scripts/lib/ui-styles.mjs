import { renderAnalysis, reportSection, sourceReference, entryReference, markdownText } from './findings.mjs'
import { reportCode } from './report-format.mjs'
import path from 'node:path'
import ts from 'typescript'
import { relative, createProjectContext } from './project.mjs'
import { measures } from './css.mjs'
import { isPaintProperty } from './css-paint.mjs'

const bases = {
  module: { file: 'src/layout/moduleFrame.module.css', classes: ['base', 'module-scaled-content'] },
  fileDialog: { file: 'src/features/document/fileDialog.module.css', classes: ['surface', 'body'] },
  alertDialog: { file: 'src/components/ui/alert-dialog/alert-dialog.module.css', classes: ['base'] },
  sheet: { file: 'src/components/ui/sheet/sheet.module.css', classes: ['content'] },
  toast: { file: 'src/components/ui/sonner/sonner.module.css', classes: ['toast'] },
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

function expand(value, variables, seen = new Set()) {
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (match, name, fallback) => {
    if (seen.has(name)) return match
    const next = variables[name] ?? fallback
    return next === undefined ? match : expand(next, variables, new Set([...seen, name]))
  })
}

export function collectUiStyles(project = createProjectContext()) {
  const files = project.src
  const sources = new Map(files.filter(file => /\.[cm]?[jt]sx?$/.test(file)).map(file => [file, project.source(file)]))
  for (const [file, source] of sources) if (source.parseDiagnostics.length) throw new Error(`${file}: ${ts.flattenDiagnosticMessageText(source.parseDiagnostics[0].messageText, ' ')}`)
  const stylesheets = new Map(files.filter(file => file.endsWith('.css')).map(file => [file, project.css(file)]))
  const rootRules = stylesheets.get('src/styles/tokens.css').filter(rule => rule.selector === ':root')
  const rootVariables = Object.fromEntries(rootRules.flatMap(rule => rule.declarations.filter(item => item.property.startsWith('--')).map(item => [item.property, item.value])))
  const simpleRules = (file, name) => (stylesheets.get(file) ?? []).filter(rule => rule.context.every(context => context.startsWith('@layer')) && rule.selector.split(',').some(selector => (name === 'body' ? ['body'] : [`.${name}`, `:where(.${name})`, `:global(.${name})`]).includes(selector.trim())))
  const refsOfBase = name => bases[name].classes.map(className => ({ file: bases[name].file, className }))
  const rulesOfRefs = refs => refs.flatMap(ref => simpleRules(ref.file, ref.className))
  const variablesOf = rules => Object.fromEntries(rules.flatMap(rule => rule.declarations.filter(item => item.property.startsWith('--')).map(item => [item.property, item.value])))
  const bodyRules = simpleRules('src/styles/global.css', 'body')
  const scaledRules = stylesheets.get(bases.module.file).filter(rule => rule.selector === ':where(.base) :global(.module-scaled-content)')
  const moduleVariables = { ...rootVariables, ...variablesOf(rulesOfRefs(refsOfBase('module'))), ...variablesOf(scaledRules), '--module-zoom': '1' }
  const profile = (refs, moduleContext = false) => {
    const rules = rulesOfRefs(refs)
    const variables = { ...(moduleContext ? moduleVariables : rootVariables), ...variablesOf(rules) }
    const properties = {}
    for (const rule of rules) for (const item of rule.declarations) if (measures.test(item.property) || isPaintProperty(item.property)) properties[item.property] = { ...item, baseExpansion: expand(item.value, variables) }
    const inheritedTypography = Object.fromEntries(bodyRules.flatMap(rule => rule.declarations.filter(item => item.property.startsWith('font') || item.property === 'line-height').map(item => [item.property, { ...item, baseExpansion: expand(item.value, variables) }])))
    if (moduleContext) inheritedTypography['font-size'] = { value: 'var(--font-size-body)', baseExpansion: expand('var(--font-size-body)', variables), file: bases.module.file, line: scaledRules[0]?.line, note: 'Referencia de herencia del contenido escalado; zoom base 1.' }
    return { refs, properties, inheritedTypography }
  }
  const resolve = (file, specifier) => project.resolveLocal(specifier, file)
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
  const sizingEvidence = sizingSources.flatMap(file => project.read(file).split(/\r?\n/).flatMap((text, index) => /constrainWindowContentSize|minimum\[|minW:|minH:|Math\.(?:min|max)\(27|minimumHeight|headerWidth|content\.scrollWidth/.test(text) ? [{ file, line: index + 1, expression: text.trim() }] : []))
  const baseProfiles = Object.fromEntries(Object.keys(bases).map(name => [name, profile(refsOfBase(name), name === 'module')]))
  const css = [...stylesheets.keys()].sort().map(file => ({ file, rules: stylesheets.get(file).map(rule => ({ ...rule, declarations: rule.declarations.map(item => ({ ...item, rootTokenExpansion: expand(item.value, rootVariables) })) })) }))
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), analysis: 'static', baseZoom: 1, moduleRegistry: at(registryNode), modules, surfaces, notices, dialogDefaults, dialogMinimum, baseProfiles, sizingEvidence, css }
}

function formatValue(value) {
  return value === undefined || value === null ? 'sin declarar' : typeof value === 'object' ? value.expression ?? JSON.stringify(value) : String(value)
}

export function renderUiStyles(report, options = {}) {
  const { sourceRoot } = options
  const ref = item => entryReference(item, sourceRoot, `${path.posix.basename(item.file)}:${item.line ?? 1}`)
  const expanded = (value, expansion) => reportCode(value) + (expansion != null && expansion !== value ? ' → ' + reportCode(expansion) : '')
  const profiles = profile => ({ ...profile?.inheritedTypography, ...profile?.properties })
  const styleRows = (style, base) => {
    const shared = profiles(base)
    return Object.entries(profiles(style)).flatMap(([name, item]) => {
      const origin = shared[name]
      const inherited = !Object.hasOwn(style.properties, name)
      const sameOrigin = origin && origin.file === item.file && origin.line === item.line
      if (sameOrigin && origin.value === item.value && origin.baseExpansion === item.baseExpansion
          && inherited === !Object.hasOwn(base.properties, name)) return []
      return [`  - ${name}: ${expanded(item.value, item.baseExpansion)} · ${ref(item)}${inherited ? ' · herencia de referencia' : ''}`]
    })
  }
  const referenceSheets = new Set([
    'src/styles/tokens.css', 'src/styles/global.css', 'src/styles/fonts.css',
    ...Object.values(report.baseProfiles).flatMap(item => item.refs.map(ref => ref.file)),
    ...report.modules.flatMap(item => [...item.stylesheets, ...item.style.refs.map(ref => ref.file)]),
    ...report.surfaces.flatMap(item => [...item.localStylesheets, ...item.style.refs.map(ref => ref.file)]),
  ])
  const sheets = report.css.filter(sheet => referenceSheets.has(sheet.file))
  return renderAnalysis('styles', report, [
    reportSection('Cobertura', [
      `${report.modules.length} módulos · ${report.surfaces.length} superficies · ${report.notices.length} llamadas de aviso`,
      `${sheets.length} hojas de estilos vinculadas a estas superficies, de ${report.css.length} leídas. Registro en ${ref(report.moduleRegistry)}.`,
      'La flecha indica expansión de variables a zoom de referencia. Los resultados describen el código y conservan las expresiones de layout.',
    ]),
    reportSection('Bases compartidas', [
      ...Object.entries(report.baseProfiles).map(([name, style]) => [
        `- **${name}** · ${style.refs.map(item => sourceReference(item.file, 1, sourceRoot, item.className)).join(', ')}`,
        ...styleRows(style),
      ].join('\n')),
      '- Apertura por defecto de FileDialog',
      ...Object.entries(report.dialogDefaults).map(([property, item]) => `  - ${property}: ${reportCode(formatValue(item.value))} · ${ref(item)}`),
      '- Restricciones de FileDialog',
      ...report.dialogMinimum.map(item => `  - ${item.property}: ${reportCode(formatValue(item.value))} · ${ref(item)}`),
    ]),
    reportSection('Módulos', [
      `${report.modules[0]?.minimumNote ?? ''} Cada módulo usa la base module y muestra sus especializaciones.`,
      ...report.modules.map(item => [
        `- **${markdownText(item.name)}** · ${item.settings.initial.join(' × ')} px de apertura · mínimo ${item.settings.minimum.join(' × ')} px`,
        `  - ${entryReference(item.definition ?? item.registry, sourceRoot, item.component)}`,
        item.delegated.length ? '  - Raíz delegada: ' + item.delegated.map(part => sourceReference(part.file, 1, sourceRoot, part.name)).join(' → ') : '',
        ...styleRows(item.style, report.baseProfiles.module),
      ].filter(Boolean).join('\n')),
    ]),
    reportSection('Superficies', report.surfaces.map(item => [
      `- **${markdownText(formatValue(item.title))}** · ${entryReference(item, sourceRoot, item.owner)} · ${item.kind} · base ${item.base ?? item.tag}`,
      ...(item.initial ? Object.entries(item.initial).filter(([key, part]) => {
        const shared = report.dialogDefaults[key]
        return !shared || part.source?.file !== shared.file || part.source?.line !== shared.line
      }).map(([key, part]) => `  - ${key}: ${reportCode(formatValue(part.value))}${part.source ? ` · ${ref(part.source)}` : ''}`)
        : ['  - Apertura según CSS y contenido.']),
      ...styleRows(item.style, report.baseProfiles[item.base]),
    ].join('\n'))),
    reportSection('Llamadas de aviso', report.notices.map(item =>
      `- ${entryReference(item, sourceRoot, item.owner)} · ${item.kind}.${item.method} · ${reportCode(formatValue(item.message))} (${item.base ?? 'navegador'})`)),
    reportSection('Mínimos dinámicos', report.sizingEvidence.map(item => `- ${ref(item)} · ${reportCode(item.expression)}`)),
    reportSection('Declaraciones CSS por hoja', [
      'Se muestran los selectores y sus condiciones. Las expansiones de esta sección usan las variables globales.',
      ...sheets.flatMap(sheet => [
        `\n### ${sourceReference(sheet.file, 1, sourceRoot, sheet.file.replace(/^src\//, ''))}\n`,
        ...sheet.rules.filter(rule => rule.declarations.length).map(rule => [
          '- ' + [...rule.context, rule.selector].map(reportCode).join(' → '),
          ...rule.declarations.map(item => `  - L${item.line} · ${item.property}: ${expanded(item.value, item.rootTokenExpansion)}`),
        ].join('\n')),
      ]),
    ]),
  ], options)
}
