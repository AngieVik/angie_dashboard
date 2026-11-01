import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import console from 'node:console'
import { fileURLToPath, URL } from 'node:url'
import { collectUiStyles } from './inspect-ui-styles.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'output/ui-consistency')
const compareProperties = ['font-family', 'font-size', 'font-weight', 'line-height', 'padding', 'padding-inline', 'padding-block', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'gap', 'row-gap', 'column-gap', ...['width', 'height', 'inline-size', 'block-size'].flatMap(axis => [axis, `min-${axis}`, `max-${axis}`])]
const relevant = /^(?:font-family|font-size|font-weight|line-height|padding(?:-.+)?|gap|row-gap|column-gap|(?:min-|max-)?(?:width|height|inline-size|block-size))$/
const textOf = value => value && typeof value === 'object' ? value.expression ?? JSON.stringify(value) : String(value)
const normalize = value => String(value).trim().replace(/\s*!important\s*$/, '').replace(/\s+/g, ' ')
const reference = item => `${item.file}:${item.line ?? 1}`

function groupBy(items, keyOf) {
  const groups = new Map()
  for (const item of items) {
    const key = keyOf(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return groups
}

function surfacesOf(inventory) {
  return [
    ...inventory.modules.map(module => ({
      label: module.name, group: `Módulos: modo ${module.settings.sizeMode}`, kind: 'module',
      file: module.definition?.file ?? module.registry.file, line: module.definition?.line ?? module.registry.line,
      style: module.style,
      numeric: { initialWidth: module.settings.initial[0], initialHeight: module.settings.initial[1], registryMinWidth: module.settings.minimum[0], registryMinHeight: module.settings.minimum[1] },
      numericSource: module.registry,
    })),
    ...inventory.surfaces.map(surface => ({
      label: `${surface.owner}: ${textOf(surface.title)}`,
      group: surface.base ? `Superficies: ${surface.base}` : `Superficies semánticas: ${surface.role}`,
      kind: surface.base ?? surface.role, file: surface.file, line: surface.line, style: surface.style,
      numeric: surface.initial ? Object.fromEntries(Object.entries(surface.initial).filter(([key]) => key !== 'fitToContent').map(([key, item]) => [`initial${key[0].toUpperCase()}${key.slice(1)}`, item.value])) : {},
      initialSources: surface.initial,
    })),
  ]
}

function differences(surfaces) {
  const result = []
  for (const [group, members] of groupBy(surfaces, item => item.group)) {
    if (members.length < 2) continue
    for (const property of [...compareProperties, 'initialWidth', 'initialHeight', 'registryMinWidth', 'registryMinHeight']) {
      const variants = new Map()
      let missing = 0
      for (const surface of members) {
        const declared = surface.style.properties[property]
        const inherited = surface.style.inheritedTypography[property]
        const definition = declared ?? inherited
        const isNumeric = Object.hasOwn(surface.numeric, property)
        if (!definition && !isNumeric) { missing++; continue }
        const value = isNumeric ? textOf(surface.numeric[property]) : definition.baseExpansion
        const numericSource = surface.initialSources?.[property === 'initialWidth' ? 'width' : 'height']?.source ?? surface.numericSource
        const entry = {
          label: surface.label, file: surface.file, line: surface.line,
          value, declared: isNumeric ? surface.numeric[property] : definition.value,
          inherited: !isNumeric && !declared,
          source: isNumeric ? numericSource : { file: definition.file, line: definition.line },
        }
        const key = normalize(value)
        if (!variants.has(key)) variants.set(key, { value: key, surfaces: [] })
        variants.get(key).surfaces.push(entry)
      }
      // Missing declarations are not treated as zero or as a different style.
      if (variants.size > 1) result.push({ group, property, variants: [...variants.values()], withoutDeclaration: missing })
    }
  }
  return result
}

function cssDeclarations(inventory) {
  const entries = inventory.css.flatMap(sheet => sheet.rules.flatMap(rule => {
    if (rule.selector.startsWith('@') || rule.context.some(context => /^@(?:-\w+-)?keyframes\b/.test(context))) return []
    return rule.declarations.filter(item => relevant.test(item.property)).map(item => ({ ...item, selector: rule.selector, context: rule.context }))
  }))
  return [...new Map(entries.map(item => [`${item.file}:${item.line}:${item.property}:${item.selector}:${item.context.join('/')}`, item])).values()]
}

function repeatedLiterals(declarations) {
  const literals = declarations.filter(item => {
    const value = normalize(item.value)
    if (/var\(/.test(value) || /^(?:0(?:px|rem|em)?|auto|none|normal|inherit|initial|unset|revert(?:-layer)?|100%)$/.test(value)) return false
    return item.property === 'font-family' || (['font-weight', 'line-height'].includes(item.property) && /^\d*\.?\d+$/.test(value)) || /-?\d*\.?\d+(?:px|rem|em)\b/.test(value)
  })
  return [...groupBy(literals, item => `${item.property}\0${normalize(item.value)}`).values()]
    .filter(items => items.length >= 3 && new Set(items.map(item => item.file)).size >= 2)
    .map(items => ({ property: items[0].property, value: normalize(items[0].value), files: new Set(items.map(item => item.file)).size, occurrences: items }))
    .sort((a, b) => b.occurrences.length - a.occurrences.length || a.property.localeCompare(b.property, 'en') || a.value.localeCompare(b.value, 'en'))
}

function tokenCandidates(inventory, declarations) {
  const tokenFile = inventory.css.find(sheet => sheet.file === 'src/styles/tokens.css')
  const tokens = tokenFile.rules.filter(rule => rule.selector === ':root').flatMap(rule => rule.declarations).filter(item => item.property.startsWith('--'))
  const familyOf = property => property === 'font-family' ? /^--font-(?:interface-default|clock)$/
    : property === 'font-size' ? /^--(?:font-size-.+-base|(?:control|field)-font-size-base)$/
      : /^(?:padding|gap|row-gap|column-gap)/.test(property) ? /^--space-\d+$/
        : /(?:width|height|inline-size|block-size)$/.test(property) ? /^--(?:control-height|icon-size|checkbox-size)-base$/ : null
  const candidates = []
  for (const declaration of declarations) {
    const family = familyOf(declaration.property)
    if (!family || /var\(/.test(declaration.value)) continue
    const value = normalize(declaration.value)
    // Only match a complete family or plain lengths in a spacing shorthand.
    // Do not rewrite numbers buried in calc(), min() or media conditions.
    const pieces = declaration.property === 'font-family' ? [value] : /^(?:padding|gap|row-gap|column-gap)/.test(declaration.property) ? value.split(/\s+/) : [value]
    const matches = [...new Set(pieces)].flatMap(piece => {
      if (declaration.property !== 'font-family' && !/^-?\d*\.?\d+(?:px|rem|em)$/.test(piece)) return []
      const matching = tokens.filter(token => family.test(token.property) && normalize(token.rootTokenExpansion) === piece)
      return matching.length ? [{ literal: piece, tokens: matching.map(token => ({ name: token.property, value: token.rootTokenExpansion, file: token.file, line: token.line })) }] : []
    })
    if (matches.length) candidates.push({ ...declaration, matches })
  }
  return candidates
}

function numericConstraints(inventory) {
  const checks = []
  for (const module of inventory.modules) for (const [index, axis] of ['ancho', 'alto'].entries()) {
    const initial = module.settings.initial[index], minimum = module.settings.minimum[index]
    if (typeof initial === 'number' && typeof minimum === 'number' && initial < minimum) checks.push({ label: module.name, axis, initial, minimum, ...module.registry, note: 'El tamaño inicial es inferior al suelo numérico del registro. No mide el mínimo expandido.' })
  }
  // Compare min/max only when both occur in the same rule and use the same unit.
  for (const sheet of inventory.css) for (const rule of sheet.rules) for (const axis of ['width', 'height', 'inline-size', 'block-size']) {
    const min = rule.declarations.findLast(item => item.property === `min-${axis}`)
    const max = rule.declarations.findLast(item => item.property === `max-${axis}`)
    if (!min || !max) continue
    const parse = item => normalize(item.value).match(/^(-?\d*\.?\d+)(px|rem|em)$/)
    const minimum = parse(min), maximum = parse(max)
    if (minimum && maximum && minimum[2] === maximum[2] && Number(minimum[1]) > Number(maximum[1])) checks.push({ label: rule.selector, axis, minimum: min.value, maximum: max.value, file: sheet.file, line: min.line, context: rule.context, note: 'El mínimo literal supera el máximo en la misma regla. CSS prioriza el mínimo; revisar intención.' })
  }
  return checks
}

function render(report) {
  const escape = value => textOf(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', '')
  const table = (headers, rows) => [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${row.map(escape).join(' | ')} |`)].join('\n')
  const location = item => `${reference(item)} [${[...item.context, item.selector].join(' → ')}]`
  return [
    '# Revisión de coherencia visual de Angie',
    `Generado: ${report.generatedAt}. Inventario leído del código: ${report.inventoryGeneratedAt}. Zoom de referencia: 1.`,
    'Este informe reúne puntos de revisión, no errores confirmados. Las diferencias pueden ser intencionadas. El análisis es estático: no calcula la cascada, no mide el navegador y no cambia estilos ni datos.',
    '## Resumen',
    table(['Superficies', 'Hojas CSS', 'Grupos con diferencias', 'Literales repetidos', 'Declaraciones candidatas a tokens', 'Relaciones numéricas para revisar'], [[report.coverage.surfaces, report.coverage.stylesheets, report.differences.length, report.repeatedLiterals.length, report.tokenCandidates.length, report.numericConstraints.length]]),
    '## Diferencias entre superficies del mismo grupo',
    'Los módulos se agrupan por su modo de tamaño y las demás superficies por base visual o rol. Compartir grupo no obliga a compartir diseño. Se comparan declaraciones de raíz y referencias heredadas, además de tamaños iniciales y suelos del registro; las declaraciones ausentes no se convierten en 0. La tabla no usa una mayoría como estándar ni equipara el suelo colapsado con el mínimo expandido.',
    ...(report.differences.length ? report.differences.map(item => `### ${item.group} / ${item.property}\n\n${table(['Valor de referencia', 'Superficie / aparición', 'Ubicación del componente', 'Fuente del valor', 'Procedencia'], item.variants.flatMap(variant => variant.surfaces.map(surface => [variant.value, surface.label, reference(surface), surface.source ? reference(surface.source) : 'sin localizar', surface.inherited ? 'referencia heredada; contrastar contexto' : 'declaración o configuración'])))}`) : ['No se detectaron diferencias comparables.']),
    '## Valores literales repetidos',
    'Misma propiedad y mismo valor literal en al menos tres declaraciones de dos hojas distintas. Se excluyen tokens ya utilizados, @font-face, animaciones y valores triviales como 0, auto o 100%. No implica que deban centralizarse: revisar si comparten responsabilidad y comportamiento de zoom.',
    ...(report.repeatedLiterals.length ? report.repeatedLiterals.map(item => `### ${item.property}: ${item.value}\n\n${table(['Ubicación / selector', 'Valor declarado'], item.occurrences.map(occurrence => [location(occurrence), occurrence.value]))}`) : ['No se detectaron grupos con ese umbral.']),
    '## Posibles usos de tokens existentes',
    'Coincidencias literales con tokens de la misma familia: tipografía, espacio o medidas de controles/iconos. Una coincidencia numérica no acredita equivalencia semántica ni de zoom; no se recomienda una sustitución automática. No se proponen nombres nuevos de tokens.',
    report.tokenCandidates.length ? table(['Ubicación / selector', 'Propiedad', 'Declarado', 'Coincidencias para revisar'], report.tokenCandidates.map(item => [location(item), item.property, item.value, item.matches.map(match => `${match.literal} → ${match.tokens.map(token => `${token.name} (${reference(token)})`).join(', ')}`).join('; ')])) : 'No se detectaron coincidencias con esas familias de tokens.',
    '## Relaciones numéricas',
    'Solo se compara inicial frente al suelo del registro, o min/max literales de la misma regla y unidad. No se resuelven calc(), porcentajes ni tamaños de contenido.',
    report.numericConstraints.length ? table(['Superficie / selector', 'Eje', 'Valores', 'Ubicación', 'Interpretación'], report.numericConstraints.map(item => [item.label, item.axis, JSON.stringify({ initial: item.initial, minimum: item.minimum, maximum: item.maximum }), reference(item), item.note])) : 'No se detectaron relaciones numéricas invertidas en los casos cubiertos. Esto no acredita ausencia de recortes ni coherencia visual completa.',
    '## Alcance y validación pendiente',
    'El colector compartido identifica módulos del registro, usos conocidos de diálogos/paneles y alertas semánticas. Los toast comparten la base Sonner; sus estilos entran en la revisión de declaraciones y tokens, sin repetir cada llamada como una superficie independiente. Las hojas incluyen reglas de descendientes y estados, que se mantienen con selector y contexto. No se revisa todo el CSS del repositorio ni todas las composiciones posibles de React.',
    'Las expansiones del resumen de módulos toman zoom 1 y variables conocidas; las coincidencias de tokens se basan en tokens globales. No se normalizan shorthands a longhands ni expresiones equivalentes (14px y calc(14px * 1), por ejemplo). Los pesos y tamaños de fuentes, paddings y mínimos efectivos deben contrastarse manualmente en navegador o dispositivo, incluidos zoom, colapsado y contenido largo.',
    '',
  ].join('\n\n')
}

function main() {
  const args = process.argv.slice(2)
  if (args.length) {
    if (args.length !== 1 || !['--help', '-h'].includes(args[0])) throw new Error('Argumentos no reconocidos. Usa --help.')
    console.log('Uso: node scripts/audit-ui-consistency.mjs\nLee código y CSS mediante el colector compartido. Genera output/ui-consistency/report.md y report.json. Los puntos de revisión no cambian el código de salida 0; los errores de ejecución devuelven 1.')
    return
  }
  // Collect fresh data in memory; do not rely on previously generated JSON.
  const inventory = collectUiStyles()
  const surfaces = surfacesOf(inventory)
  const declarations = cssDeclarations(inventory)
  const report = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), inventoryGeneratedAt: inventory.generatedAt,
    analysis: 'static', classification: 'review-points', collector: 'scripts/inspect-ui-styles.mjs#collectUiStyles',
    coverage: { surfaces: surfaces.length, modules: inventory.modules.length, stylesheets: inventory.css.length, cssDeclarations: declarations.length },
    rules: { minimumRepeatedDeclarations: 3, minimumRepeatedFiles: 2, baseZoom: 1, automaticallyChangesCode: false },
    differences: differences(surfaces), repeatedLiterals: repeatedLiterals(declarations),
    tokenCandidates: tokenCandidates(inventory, declarations), numericConstraints: numericConstraints(inventory),
  }
  const markdown = render(report)
  fs.mkdirSync(output, { recursive: true })
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  fs.writeFileSync(path.join(output, 'report.md'), markdown)
  console.log(`Coherencia visual: ${report.coverage.surfaces} superficies, ${report.differences.length} grupos con diferencias, ${report.repeatedLiterals.length} literales repetidos y ${report.tokenCandidates.length} declaraciones candidatas a tokens.\nInformes: output/ui-consistency/report.md y report.json`)
}

try { main() } catch (error) {
  console.error(`Auditoría visual no generada: ${error.message}`)
  process.exitCode = 1
}
