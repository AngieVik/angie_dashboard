import { renderAnalysis, markdownTable as table, markdownText, sourceReference, entryReference } from './findings.mjs'
import ts from 'typescript'
import { relative, createProjectContext } from './project.mjs'
import { measures } from './css.mjs'

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
  const sizingEvidence = sizingSources.flatMap(file => project.read(file).split(/\r?\n/).flatMap((text, index) => /constrainWindowContentSize|minimum\[|minW:|minH:|Math\.(?:min|max)\(27|minimumHeight|headerWidth|content\.scrollWidth/.test(text) ? [{ file, line: index + 1, expression: text.trim() }] : []))
  const baseProfiles = Object.fromEntries(Object.keys(bases).map(name => [name, profile(refsOfBase(name), name === 'module')]))
  const css = [...usedCss].sort().map(file => ({ file, rules: stylesheets.get(file).map(rule => ({ ...rule, declarations: rule.declarations.map(item => ({ ...item, rootTokenExpansion: expand(item.value, rootVariables) })) })) }))
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), analysis: 'static', baseZoom: 1, moduleRegistry: at(registryNode), modules, surfaces, notices, dialogDefaults, dialogMinimum, baseProfiles, sizingEvidence, css }
}

function formatValue(value) {
  return value === undefined || value === null ? 'sin declarar' : typeof value === 'object' ? value.expression ?? JSON.stringify(value) : String(value)
}

export function renderUiStyles(report, options = {}) {
  const { sourceRoot } = options
  const styleRows = style => Object.entries({...style.inheritedTypography,...style.properties}).map(([name,item])=>[
    name,item.value,item.baseExpansion,style.properties[name]?'Declaración de raíz':'Referencia heredada; contexto completo no calculado',entryReference(item,sourceRoot),
  ])
  const styleTable = style => table(['Propiedad','Declarado','Expansión a zoom de referencia','Procedencia','Fuente'],styleRows(style))
  return renderAnalysis('styles',report,[
    '## Datos de referencia · módulos',
    ...report.modules.map(item=>[
      `### Módulo: ${markdownText(item.name)} · ${item.component}`,
      table(['Configuración','Valor','Fuente'],[
        ['Tamaño inicial',`${item.settings.initial.join(' × ')} px`,entryReference(item.registry,sourceRoot)],
        ['Mínimo numérico del registro',`${item.settings.minimum.join(' × ')} px`,entryReference(item.registry,sourceRoot)],
        ['Componente propietario',item.component,entryReference(item.definition??item.registry,sourceRoot)],
      ]),
      item.delegated.length?`Raíz delegada: ${item.delegated.map(part=>`${part.name} (${sourceReference(part.file,1,sourceRoot)})`).join(' → ')}.`:'',
      styleTable(item.style),item.minimumNote,
    ].filter(Boolean).join('\n\n')),
    '## Datos de referencia · diálogos, paneles y alertas',
    ...report.surfaces.map(item=>[
      `### ${markdownText(item.owner)}: ${markdownText(formatValue(item.title))}`,
      `${item.kind}; base ${item.base??item.tag}; ${entryReference(item,sourceRoot)}.`,
      item.initial?table(['Configuración inicial','Valor declarado o expresión','Fuente'],Object.entries(item.initial).map(([name,part])=>[name,formatValue(part.value),part.source?entryReference(part.source,sourceRoot):'Sin fuente localizada'])):'Tamaño inicial dependiente de CSS y contenido.',
      table(['Restricción numérica de layout','Valor o expresión','Fuente'],item.minimumConstraints.map(part=>[part.property,formatValue(part.value),entryReference(part,sourceRoot)])),
      styleTable(item.style),
    ].join('\n\n')),
    '## Datos de referencia · llamadas de aviso',
    table(['Tipo / método','Propietario','Mensaje o expresión','Base','Ubicación'],report.notices.map(item=>[`${item.kind}.${item.method}`,item.owner,formatValue(item.message),item.base??'Navegador',entryReference(item,sourceRoot)])),
    'Las llamadas se cuentan en el código; no son avisos observados durante una sesión.',
    '## Datos de referencia · bases compartidas',
    ...Object.entries(report.baseProfiles).map(([name,style])=>`### Base: ${name}\n\n${styleTable(style)}`),
    '## Datos de referencia · código que condiciona mínimos',
    table(['Ubicación','Expresión'],report.sizingEvidence.map(item=>[entryReference(item,sourceRoot),item.expression])),
    '## Datos de referencia · declaraciones CSS por hoja',
    'Se mantienen selectores, condiciones y valores originales. Los tokens de esta sección se expanden solo con variables globales; no es una cascada calculada ni una medida final. calc(), clamp(), porcentajes, unidades relativas y expresiones de props conservan su condición de expresiones.',
    ...report.css.map(sheet=>`### ${sheet.file}\n\n${table(['Selector / contexto','Propiedad','Declarado','Expansión de tokens globales','Fuente'],sheet.rules.flatMap(rule=>rule.declarations.map(item=>[[...rule.context,rule.selector].join(' → '),item.property,item.value,item.rootTokenExpansion,entryReference(item,sourceRoot)])))}`),
    '«Sin declarar» no significa cero. Las comparaciones entre superficies y restricciones numéricas se diagnostican en consistency; los usos de clases se diagnostican en unused.',
  ],options)
}
