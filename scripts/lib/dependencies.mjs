import { renderAnalysis, markdownTable as table, sourceReference, entryReference, collectFindings } from './findings.mjs'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { builtinModules } from 'node:module'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { root, relative, isCode, createProjectContext } from './project.mjs'
import { collectUnusedCode, moduleDependencyType } from './unused-code.mjs'

const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
const builtins = new Set(builtinModules.flatMap(name => [name, `node:${name}`]))
const sorted = values => [...values].sort((a, b) => a.localeCompare(b, 'en'))

export function packageName(specifier) {
  if (!specifier || /^(?:\.|\/|@\/|#|[a-z][\w+.-]*:)/i.test(specifier) || builtins.has(specifier)) return null
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
}

// Resolve only inventoried package locations; never execute package entry points.
export function resolveRequirement(from, name, available) {
  for (let directory = from; ; directory = path.posix.dirname(directory)) {
    if (path.posix.basename(directory) !== 'node_modules') {
      const candidate = path.posix.join(directory === '.' ? '' : directory, 'node_modules', name)
      if (available.has(candidate)) return candidate
    }
    if (!directory || directory === '.') return null
  }
}

function npmCli() {
  const candidates = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')]
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    candidates.push(path.join(directory, 'node_modules/npm/bin/npm-cli.js'))
    const executable = path.join(directory, 'npm')
    try { candidates.push(fs.realpathSync(executable)) } catch { /* Not every PATH entry contains npm. */ }
  }
  return candidates.find(file => file?.replaceAll('\\', '/').endsWith('/npm-cli.js') && fs.existsSync(file))
}

export function summarizeNpmTree(tree) {
  const packages = new Map(), problems = new Set()
  const visit = (node, name) => {
    for (const problem of node.problems ?? []) problems.add(problem.replaceAll(root, '').replaceAll('\\', '/'))
    if (node.path && name) {
      const file = relative(node.path)
      if (!packages.has(file)) packages.set(file, { name: node.name ?? name, version: node.version ?? null, path: file, extraneous: Boolean(node.extraneous) })
    }
    for (const [childName, child] of Object.entries(node.dependencies ?? {})) visit(child, childName)
  }
  visit(tree)
  return { packages: [...packages.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')), problems: sorted(problems) }
}

function inspectInstalled(uncertainties) {
  const cli = npmCli()
  if (!cli) {
    uncertainties.push({ file: 'node_modules', kind: 'npm CLI no localizado', expression: 'No se comprobó el árbol instalado ni la compatibilidad semver/peer.' })
    return { available: false, version: null, packages: [], problems: [] }
  }
  // full establishes NODE_ENV=production for Vite. Inspect the complete local
  // installation regardless of npm's environment-dependent omit defaults.
  const args = ['ls', '--all', '--long', '--json', '--include=dev', '--include=optional', '--include=peer', '--global=false', '--package-lock-only=false', '--offline', '--ignore-scripts', '--no-audit', '--no-fund']
  let output, exitCode = 0
  try { output = execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }) }
  catch (error) {
    output = error.stdout?.toString()
    exitCode = error.status
  }
  let tree
  try { tree = JSON.parse(output) } catch { /* Report the missing check rather than claiming compatibility. */ }
  if (!tree || (exitCode !== 0 && tree.error?.code !== 'ELSPROBLEMS')) {
    uncertainties.push({ file: 'node_modules', kind: 'validación npm incompleta', expression: `npm ls no terminó con un resultado utilizable (salida ${exitCode ?? 'interrumpida'}).` })
    return { available: false, version: null, packages: [], problems: [] }
  }
  const manifest = JSON.parse(fs.readFileSync(path.resolve(cli, '../../package.json'), 'utf8'))
  return { available: true, version: manifest.version, exitCode, command: `npm ${args.join(' ')}`, ...summarizeNpmTree(tree) }
}

export function collectDependencies(project = createProjectContext(), unused = collectUnusedCode(project)) {
  const manifest = project.readJson('package.json'), lock = project.readJson('package-lock.json')
  if (![2, 3].includes(lock.lockfileVersion) || !lock.packages?.['']) throw new Error('Se requiere package-lock con tabla packages (versión 2 o 3).')
  const uncertainties = [], uses = [], issues = []
  const detached = new Set(unused.detachedFiles.map(item => item.file))
  const add = (specifier, file, line, kind) => {
    const name = packageName(specifier)
    if (name) uses.push({ name, specifier, file, line, kind, scope: file.startsWith('src/') ? detached.has(file) ? 'desconectado' : 'app' : 'herramientas' })
  }
  for (const file of project.inputs.filter(isCode)) {
    const source = project.source(file)
    const visit = node => {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        add(node.moduleSpecifier.text, file, line, source.isDeclarationFile || moduleDependencyType(node)==='type' ? 'import/reexport de tipos' : 'import/reexport')
      }
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) add(node.argument.literal.text, file, line, 'import de tipos')
      if (ts.isCallExpression(node)) {
        const callable = node.expression.getText(source)
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword || ['require', 'require.resolve', 'import.meta.resolve'].includes(callable)) {
          const argument = node.arguments[0]
          if (argument && ts.isStringLiteralLike(argument)) add(argument.text, file, line, callable)
          else uncertainties.push({ file, line, kind: 'carga de módulo no literal', expression: node.getText(source) })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    for (const reference of source.typeReferenceDirectives) add(reference.fileName.includes('/') ? reference.fileName : `@types/${reference.fileName}`, file, source.getLineAndCharacterOfPosition(reference.pos).line + 1, 'referencia de tipos')
  }
  for (const file of project.src.filter(file => file.endsWith('.css'))) {
    const text = project.read(file).replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '))
    for (const match of text.matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g)) {
      if (!project.resolveLocal(`./${match[1]}`, file)) add(match[1], file, text.slice(0, match.index).split('\n').length, 'import CSS')
    }
  }
  const program = project.getProgram(), options = program.getCompilerOptions()
  for (const type of options.types ?? []) add(type.includes('/') ? type : `@types/${type}`, 'tsconfig.json', 1, 'compilerOptions.types')
  if ([ts.JsxEmit.ReactJSX, ts.JsxEmit.ReactJSXDev].includes(options.jsx)) add(`${options.jsxImportSource ?? 'react'}/jsx-runtime`, 'tsconfig.json', 1, 'runtime JSX automático')
  // Type declarations loaded by the actual compiler are consumers even without a source import.
  const compilerTypes = new Set(program.getSourceFiles().flatMap(source => {
    const match = relative(source.fileName).match(/^node_modules\/(@types\/[^/]+)\//)
    return match ? [match[1]] : []
  }))
  for (const name of sorted(compilerTypes)) add(name, 'tsconfig.json', 1, 'declaraciones cargadas por TypeScript')

  const npm = inspectInstalled(uncertainties)
  const installed = new Map()
  for (const item of npm.packages) {
    if (!item.path.startsWith('node_modules/') || item.path.includes('../')) {
      uncertainties.push({ file: 'node_modules', kind: 'paquete fuera del árbol local', expression: item.name }); continue
    }
    const file = `${item.path}/package.json`
    try {
      const installedManifest = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
      installed.set(item.path, { ...item, version: installedManifest.version, manifest: installedManifest })
    }
    catch { uncertainties.push({ file, kind: 'manifiesto instalado no legible', expression: item.name }) }
  }
  const declaredNames = new Set(sections.flatMap(section => Object.keys(manifest[section] ?? {})))
  for (const [location, entry] of Object.entries(lock.packages)) if (entry.link) uncertainties.push({ file: 'package-lock.json', kind: 'enlace de paquete no recorrido', expression: location })
  for (const section of sections) for (const [name, range] of Object.entries(manifest[section] ?? {})) {
    if (/^(?:npm:|file:|link:|workspace:|git|https?:)/.test(range)) uncertainties.push({ file: 'package.json', kind: 'protocolo de dependencia no ordinario', expression: `${name}: ${range}` })
  }
  for (const name of declaredNames) {
    const entry = installed.get(`node_modules/${name}`)?.manifest
    const bin = typeof entry?.bin === 'string' ? { [name.split('/').at(-1)]: entry.bin } : entry?.bin ?? {}
    for (const [script, command] of Object.entries(manifest.scripts ?? {})) {
      const commands = command.split(/&&|\|\||[;|]/).map(part => part.trim().split(/\s+/)[0])
      for (const executable of Object.keys(bin)) if (commands.includes(executable)) add(name, 'package.json', 1, `CLI ${executable} en scripts.${script}`)
    }
  }
  const requirements = []
  const lockPaths = new Set(Object.keys(lock.packages)), installedPaths = new Set(installed.keys())
  for (const [from, locked] of Object.entries(lock.packages)) {
    if (!from) continue
    const actual = installed.get(from)
    const owner = actual?.manifest ?? locked
    for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, range] of Object.entries(owner[section] ?? {})) {
        if (section === 'dependencies' && owner.optionalDependencies?.[name]) continue
        const optional = section === 'optionalDependencies' || (section === 'peerDependencies' && Boolean(owner.peerDependenciesMeta?.[name]?.optional))
        const target = resolveRequirement(from, name, actual ? installedPaths : lockPaths)
        requirements.push({ from, name, range, kind: section, optional, source: actual ? 'instalado' : 'solo lock', target, version: target ? (actual ? installed.get(target)?.version : lock.packages[target]?.version) ?? null : null })
      }
    }
  }
  // Extraneous packages have no lock node; npm already reports them as problems.
  for (const [location, actual] of installed) {
    const locked = lock.packages[location]
    if (locked && locked.version !== actual.version) issues.push({ name: actual.name, rule: 'installed-lock-version', file: `${location}/package.json`, detail: `Instalada ${actual.version}; lock ${locked.version}.` })
    if (!locked && !actual.extraneous) issues.push({ name: actual.name, rule: 'installed-without-lock-node', file: `${location}/package.json`, detail: `Instalada ${actual.version}; ubicación ausente de la tabla packages del lock.` })
  }
  const direct = sorted(declaredNames).map(name => {
    const declarations = sections.filter(section => Object.hasOwn(manifest[section] ?? {}, name)).map(section => ({ section, range: manifest[section][name] }))
    for (const section of sections) {
      if (manifest[section]?.[name] !== lock.packages[''][section]?.[name]) issues.push({ name, section, rule: 'manifest-lock-declaration', file: 'package-lock.json', detail: `${section}: package.json=${manifest[section]?.[name] ?? 'ausente'}; raíz lock=${lock.packages[''][section]?.[name] ?? 'ausente'}.` })
    }
    const ownUses = uses.filter(use => use.name === name)
    const consumers = requirements.filter(requirement => requirement.name === name && requirement.source === 'instalado')
    const activeUses = ownUses.filter(use => use.scope !== 'desconectado')
    const status = activeUses.length ? 'con consumidores reconocidos' : ownUses.length ? 'solo referencias desconectadas' : consumers.length ? 'solo requisitos de paquetes' : 'sin consumidor reconocido'
    return { name, declarations, lockedVersion: lock.packages[`node_modules/${name}`]?.version ?? null, installedVersion: installed.get(`node_modules/${name}`)?.version ?? null, status, uses: ownUses, requiredBy: consumers }
  })
  for (const section of sections) for (const name of Object.keys(lock.packages[''][section] ?? {})) {
    if (!Object.hasOwn(manifest[section] ?? {}, name) && !declaredNames.has(name)) issues.push({ name, section, rule: 'lock-only-declaration', file: 'package-lock.json', detail: `${section}: declarado solo en la raíz del lock.` })
  }
  // Types reached through other packages' declarations are not direct project imports.
  const undeclaredUses = sorted(new Set(uses.filter(use => use.kind !== 'declaraciones cargadas por TypeScript').map(use => use.name).filter(name => !declaredNames.has(name)))).map(name => ({
    name, uses: uses.filter(use => use.name === name), installedVersion: installed.get(`node_modules/${name}`)?.version ?? null,
    requiredBy: requirements.filter(requirement => requirement.name === name && requirement.source === 'instalado'),
  }))
  const byName = new Map()
  for (const item of installed.values()) {
    if (!byName.has(item.name)) byName.set(item.name, [])
    byName.get(item.name).push({ path: item.path, version: item.version })
  }
  const multipleVersions = [...byName].filter(([, items]) => new Set(items.map(item => item.version)).size > 1).map(([name, locations]) => ({ name, locations })).sort((a, b) => a.name.localeCompare(b.name, 'en'))
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), analysis: 'static-dependency-candidates',
    coverage: { direct: direct.length, lockedLocations: lockPaths.size - 1, installedLocations: installed.size, references: uses.length, requirements: requirements.length },
    npm: { available: npm.available, version: npm.version, exitCode: npm.exitCode, command: npm.command, problems: npm.problems },
    direct, undeclaredUses, requirements, issues, multipleVersions,
    reviewCandidates: direct.filter(item => item.status !== 'con consumidores reconocidos'),
    installed: [...installed.values()].map(({ manifest: ignored, ...item }) => { void ignored; return item }),
    uncertainties,
  }
}

export function renderDependencies(report, options = {}) {
  const { sourceRoot } = options
  const findings = report.findings ?? collectFindings({ dependencies:report })
  const reportedPackages = new Set(findings.filter(item=>item.element.kind==='Paquete').map(item=>item.element.name))
  return renderAnalysis('dependencies',{...report,findings},[
    '## Datos de referencia · comprobación de npm',
    report.npm.available ? `npm ${report.npm.version}; código de salida ${report.npm.exitCode}. Comando: ${report.npm.command}.` : 'El árbol instalado no pudo comprobarse con npm; la limitación consta en los hallazgos.',
    '## Datos de referencia · dependencias directas',
    table(['Paquete','Declaración','Lock / instalado','Situación','Usos reconocidos por clase'],report.direct.map(item=>[item.name,item.declarations.map(entry=>`${entry.section}: ${entry.range}`).join('; '),`${item.lockedVersion??'sin dato'} / ${item.installedVersion??'sin dato'}`,item.status,[...new Set(item.uses.map(use=>`${use.kind} (${use.scope})`))].join('; ')||'Ninguno reconocido'])),
    'Los usos separan importaciones de JavaScript, CSS, tipos y herramientas según lo reconocido en el código. Un import CSS no acredita que se utilice el componente JavaScript del paquete. Los requisitos peer/transitivos se conservan como relaciones propias.',
    '## Datos de referencia · consumidores de paquetes sin hallazgo propio',
    table(['Paquete','Ubicación','Uso / requisito'],report.direct.filter(item=>!reportedPackages.has(item.name)).flatMap(item=>[
      ...item.uses.map(use=>[item.name,entryReference(use,sourceRoot),`${use.kind}: ${use.specifier}; ${use.scope}`]),
      ...item.requiredBy.map(entry=>[item.name,sourceReference(`${entry.from}/package.json`,1,sourceRoot),`${entry.kind} ${entry.range}; opcional ${entry.optional}; resolución ${entry.target??'sin resolver'} (${entry.version??'sin versión'})`]),
    ])),
    'Los paquetes con hallazgo propio reúnen sus consumidores en la ficha correspondiente. Las versiones instaladas son datos de instalación; las versiones y bytes emitidos pertenecen al análisis bundle.',
  ],options)
}
