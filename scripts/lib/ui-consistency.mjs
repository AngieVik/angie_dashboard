import { renderAnalysis, reportSection, sourceReference, entryReference } from './findings.mjs'
import { collectUiStyles } from './ui-styles.mjs'
import { loadUiPolicy } from './ui-policy.mjs'
import { isPaintProperty, normalizePaint, paintColors } from './css-paint.mjs'

const relevant = /^(?:font-family|font-size|font-weight|line-height|padding(?:-.+)?|gap|row-gap|column-gap|(?:min-|max-)?(?:width|height|inline-size|block-size))$/
const textOf = value => value && typeof value === 'object' ? value.expression ?? JSON.stringify(value) : String(value)
const normalize = value => String(value).trim().replace(/\s*!important\s*$/, '').replace(/\s+/g, ' ')
const normalizedProperty = (property, value) => isPaintProperty(property) ? normalizePaint(value) : normalize(value)

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
      label: module.name, moduleId: module.id, kind: 'module',
      file: module.definition?.file ?? module.registry.file, line: module.definition?.line ?? module.registry.line,
      style: module.style,
      numeric: { initialWidth: module.settings.initial[0], initialHeight: module.settings.initial[1], registryMinWidth: module.settings.minimum[0], registryMinHeight: module.settings.minimum[1] },
      numericSource: module.registry,
    })),
    ...inventory.surfaces.map(surface => ({
      label: `${surface.owner}: ${textOf(surface.title)}`,
      kind: surface.base ?? surface.role, file: surface.file, line: surface.line, style: surface.style,
      numeric: surface.initial ? Object.fromEntries(Object.entries(surface.initial).filter(([key]) => key !== 'fitToContent').map(([key, item]) => [`initial${key[0].toUpperCase()}${key.slice(1)}`, item.value])) : {},
      initialSources: surface.initial,
    })),
  ]
}

function differences(surfaces, policy) {
  const result = [], comparisonGroups = [], appliedExceptions = [], exceptionViolations = [], uncertainties = []
  const selected = new Set(), seenExceptions = new Set()
  const warn = (kind, expression) => uncertainties.push({ file: policy.file, line: 1, kind, expression })
  for (const group of policy.groups) {
    const members = surfaces.filter(surface => group.target === 'modules' ? surface.kind === 'module' && (!group.members || group.members.includes(surface.moduleId)) : surface.kind === group.target)
    members.forEach(surface => selected.add(surface))
    const absent = (group.members ?? []).filter(id => !members.some(surface => surface.moduleId === id))
    if (absent.length) warn('miembros de grupo visual no encontrados', `${group.id}: ${absent.join(', ')}`)
    comparisonGroups.push({ ...group, members: members.map(surface => ({ label: surface.label, file: surface.file, line: surface.line, moduleId: surface.moduleId })), configuredMembers: group.members ?? null })
    for (const property of group.properties) {
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
        const exception = policy.exceptions.find(item => item.group === group.id && item.moduleId === surface.moduleId && item.property === property)
        if (exception) {
          seenExceptions.add(exception.id)
          const detail = { ...exception, groupName: group.name, label: surface.label, actual: value, file: surface.file, line: surface.line, source: entry.source }
          if (normalizedProperty(property, value) === normalizedProperty(property, exception.expected)) { appliedExceptions.push(detail); continue }
          exceptionViolations.push(detail)
        }
        const key = normalizedProperty(property, value)
        if (!variants.has(key)) variants.set(key, { value: key, surfaces: [] })
        variants.get(key).surfaces.push(entry)
      }
      // Missing declarations are not treated as zero or as a different style.
      if (variants.size > 1) result.push({ group: group.name, groupId: group.id, property, variants: [...variants.values()], withoutDeclaration: missing })
    }
  }
  for (const exception of policy.exceptions) if (!seenExceptions.has(exception.id)) warn('excepción visual sin valor verificable', `${exception.id}: revisar selección de módulo y declaración de ${exception.property}`)
  return { differences: result, comparisonGroups, appliedExceptions, exceptionViolations, uncertainties,
    ungroupedSurfaces: surfaces.filter(surface => !selected.has(surface)).map(surface => ({ label: surface.label, kind: surface.kind, file: surface.file, line: surface.line })),
  }
}

function cssDeclarations(inventory) {
  const entries = inventory.css.flatMap(sheet => sheet.rules.flatMap(rule => {
    if (rule.selector.startsWith('@') || rule.context.some(context => /^@(?:-\w+-)?keyframes\b/.test(context))) return []
    return rule.declarations.filter(item => relevant.test(item.property) || isPaintProperty(item.property)).map(item => ({ ...item, selector: rule.selector, context: rule.context }))
  }))
  return [...new Map(entries.map(item => [`${item.file}:${item.line}:${item.property}:${item.selector}:${item.context.join('/')}`, item])).values()]
}

function repeatedLiterals(declarations) {
  const literals = declarations.filter(item => {
    const value = normalize(item.value)
    if (/\b(?:var|url)\s*\(/i.test(value) || /^(?:0(?:px|rem|em)?|auto|none|normal|inherit|initial|unset|revert(?:-layer)?|transparent|currentcolor|100%)$/i.test(value)) return false
    if (isPaintProperty(item.property)) return paintColors(value).length > 0
    return item.property === 'font-family' || (['font-weight', 'line-height'].includes(item.property) && /^\d*\.?\d+$/.test(value)) || /-?\d*\.?\d+(?:px|rem|em)\b/.test(value)
  })
  return [...groupBy(literals, item => `${item.property}\0${normalizedProperty(item.property, item.value)}`).values()]
    .filter(items => items.length >= 3 && new Set(items.map(item => item.file)).size >= 2)
    .map(items => ({ property: items[0].property, value: normalize(items[0].value), files: new Set(items.map(item => item.file)).size, occurrences: items }))
    .sort((a, b) => b.occurrences.length - a.occurrences.length || a.property.localeCompare(b.property, 'en') || a.value.localeCompare(b.value, 'en'))
}

function tokenCandidates(inventory, declarations) {
  const tokenFile = inventory.css.find(sheet => sheet.file === 'src/styles/tokens.css')
  const tokens = tokenFile.rules.filter(rule => rule.selector === ':root' && rule.context.every(context => context.startsWith('@layer'))).flatMap(rule => rule.declarations).filter(item => item.property.startsWith('--'))
  const familyOf = property => property === 'font-family' ? /^--font-(?:interface-default|clock)$/
    : property === 'font-size' ? /^--(?:font-size-.+-base|(?:control|field)-font-size-base)$/
      : /^(?:padding|gap|row-gap|column-gap)/.test(property) ? /^--space-\d+$/
        : /(?:width|height|inline-size|block-size)$/.test(property) ? /^--(?:control-height|icon-size|checkbox-size)-base$/ : null
  const candidates = []
  for (const declaration of declarations) {
    if (isPaintProperty(declaration.property)) {
      const matches = new Map()
      const match = (literal, key, family) => {
        const matching = tokens.filter(token => family.test(token.property) && normalizePaint(token.rootTokenExpansion) === key)
        if (!matching.length) return
        const known = matches.get(literal) ?? { literal, tokens: [] }
        for (const token of matching) if (!known.tokens.some(item => item.name === token.property)) known.tokens.push({ name: token.property, value: token.rootTokenExpansion, file: token.file, line: token.line })
        matches.set(literal, known)
      }
      for (const color of paintColors(declaration.value)) match(color.literal, color.key, /^--(?:color-|palette-)/)
      // Whole shadows/gradients can reuse a semantic token; never treat lengths
      // inside them as spacing, or resolve a local var()/URL as a literal.
      const family = /^(?:background|background-color|background-image)$/.test(declaration.property) ? /^--surface-/
        : /^(?:box-shadow|text-shadow)$/.test(declaration.property) ? /^--shadow-/
          : /^(?:filter|backdrop-filter)$/.test(declaration.property) ? /^--filter-/ : null
      if (family && !/\b(?:var|url)\s*\(/i.test(declaration.value) && !/^(?:none|inherit|initial|unset|revert(?:-layer)?)$/i.test(normalize(declaration.value))) match(declaration.value, normalizePaint(declaration.value), family)
      if (matches.size) candidates.push({ ...declaration, matches: [...matches.values()] })
      continue
    }
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

function paintExceptions(declarations, policy) {
  const excluded = new Set(), appliedPaintExceptions = [], uncertainties = []
  for (const exception of policy.paintExceptions ?? []) {
    const matches = declarations.filter(item => isPaintProperty(item.property) && item.file === exception.file
      && (!exception.selectors || exception.selectors.includes(item.selector))
      && (!exception.properties || exception.properties.includes(item.property)))
    if (!matches.length) uncertainties.push({ file: policy.file, line: 1, kind: 'excepción gráfica sin declaraciones verificables', expression: exception.id })
    else {
      matches.forEach(item => excluded.add(item))
      appliedPaintExceptions.push({ ...exception, declarations: matches })
    }
  }
  return { declarations: declarations.filter(item => !excluded.has(item)), appliedPaintExceptions, uncertainties, excluded: excluded.size }
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

export function renderUiConsistency(report, options = {}) {
  const { sourceRoot } = options
  return renderAnalysis('consistency', report, [
    reportSection('Cobertura', [
      `${report.coverage.surfaces} superficies · ${report.coverage.stylesheets} hojas · ${report.coverage.cssDeclarations} declaraciones`,
      `${new Set(report.differences.map(item => item.groupId ?? item.group)).size} grupos con diferencias · ${report.differences.length} diferencias por propiedad · ${report.ungroupedSurfaces.length} superficies sin grupo`,
      `Color y sombra: ${report.coverage.paintDeclarations} declaraciones · ${report.coverage.excludedPaintDeclarations} bajo excepción.`,
      `Política en ${sourceReference(report.policy.file, 1, sourceRoot, 'ui-consistency.json')}. Una declaración ausente queda sin valor comparable.`,
    ]),
    reportSection('Grupos comparables', report.comparisonGroups.map(item => [
      `- **${item.name}** · ${item.members.map(member => member.label).join(', ') || 'sin miembros detectados'}`,
      `  - ${item.properties.join(', ')}. ${item.reason}`,
    ].join('\n'))),
    reportSection('Excepciones aplicadas', [
      ...report.appliedExceptions.map(item => [
        `- ${entryReference(item.source ?? item, sourceRoot, item.label)} · \`${item.property}: ${item.actual}\`. ${item.reason}`,
        `  - Fuentes: ${item.sources.join(', ')}`,
      ].join('\n')),
      ...(report.appliedPaintExceptions ?? []).map(item => [
        `- ${sourceReference(item.file, 1, sourceRoot, item.file)} · ${item.reason}`,
        ...item.declarations.map(entry => `  - L${entry.line} · ${entry.selector} · \`${entry.property}: ${entry.value}\``),
      ].join('\n')),
    ]),
    reportSection('Sin grupo comparable', report.ungroupedSurfaces.map(item => `- ${entryReference(item, sourceRoot, item.label)} · ${item.kind}`)),
  ], options)
}

export function collectUiConsistency(inventory = collectUiStyles(), policy = loadUiPolicy()) {
  const surfaces = surfacesOf(inventory)
  const declarations = cssDeclarations(inventory)
  const comparisons = differences(surfaces, policy)
  const paint = paintExceptions(declarations, policy)
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), inventoryGeneratedAt: inventory.generatedAt,
    analysis: 'static', classification: 'review-points', collector: 'scripts/lib/ui-styles.mjs#collectUiStyles',
    coverage: { surfaces: surfaces.length, modules: inventory.modules.length, stylesheets: inventory.css.length, cssDeclarations: declarations.length,
      paintDeclarations: declarations.filter(item => isPaintProperty(item.property)).length, excludedPaintDeclarations: paint.excluded },
    rules: { minimumRepeatedDeclarations: 3, minimumRepeatedFiles: 2, baseZoom: 1, automaticallyChangesCode: false },
    policy, ...comparisons, uncertainties: [...comparisons.uncertainties, ...paint.uncertainties], appliedPaintExceptions: paint.appliedPaintExceptions,
    repeatedLiterals: repeatedLiterals(paint.declarations),
    tokenCandidates: tokenCandidates(inventory, paint.declarations), numericConstraints: numericConstraints(inventory),
  }
}
