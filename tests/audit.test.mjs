import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { inspectModuleConsumers } from '../scripts/lib/app-inventory.mjs'
import { parseCssText } from '../scripts/lib/css.mjs'
import { sheetsWithDashboardTokens } from '../scripts/lib/ui-styles.mjs'
import { renderUnusedCode } from '../scripts/lib/unused-code.mjs'
import { diagnosticReport } from '../scripts/lib/findings.mjs'
import { collectUiConsistency, renderUiConsistency } from '../scripts/lib/ui-consistency.mjs'

function visual(width, { line = 1, exceptions = [] } = {}) {
  const file = 'src/demo.tsx'
  const surfaces = [['Base', '460px'], ['Limpieza', width]].map(([owner, value]) => ({
    owner, title: owner, file, line, base: 'alertDialog',
    style: { properties: { width: { value, baseExpansion: value, file: 'dialog.css', line } }, inheritedTypography: {} },
  }))
  const css = [{ file: 'src/styles/tokens.css', rules: [] }]
  return collectUiConsistency({ surfaces, css, modules: [] }, {
    file: 'policy.json', groups: [{ id: 'alerts', target: 'alertDialog', name: 'Confirmaciones', properties: ['width'] }], exceptions,
  })
}

test('cada export conserva su decisión aunque cambien sus vecinos o su línea', () => {
  const file = 'src/components/ui/sheet/sheet.tsx'
  const symbol = name => ({ file, name, line: 1, declarationKind: 'FunctionDeclaration',
    localReferences: 0, disconnectedReferences: 0, reexports: ['index.ts#' + name] })
  const inspect = (unusedExports, accepted = []) => diagnosticReport('unused', {
    unusedExports, detachedFiles: [], localUnused: [], unusedClasses: [], uncertainties: [], graph: [],
    coverage: {}, generatedAt: '2026-11-21',
  }, accepted)
  const first = symbol('SheetFooter'), second = symbol('SheetTitle')
  const initial = inspect([first, second])
  assert.equal(renderUnusedCode(initial).sections[0].blocks.length, 1)
  const ref = initial.findings.find(item => item.facts.symbol === first.name).ref
  const decisions = [{ ref, reason: 'Reexportado por el índice' }]
  const partial = inspect([second, { ...first, line: 30 }, symbol('SheetClose')], decisions)
  assert.deepEqual(partial.exceptions.map(item => item.finding.ref), [ref])
  assert.deepEqual(partial.findings.map(item => item.facts.symbol).sort(), ['SheetClose', 'SheetTitle'])
  assert.equal(inspect([{ ...first, reexports: [] }], decisions).findings.length, 1)
  assert.equal(inspect([second], decisions).exceptions.length, 0)
})

test('el inventario localiza una entrada sin consumidor de render aunque tenga carga e icono', () => {
  const file = path.resolve('audit-fixture.tsx')
  const source = ts.createSourceFile(file, `
    export const Panel = () => null
    const MODULE_REGISTRY = { board: {}, other: {} }
    const MODULE_ICONS = { board: Panel, other: Panel }
    const moduleFactories = {
      board: () => import('./audit-fixture').then(m => ({ default: m.Panel })),
      other: () => import('./audit-fixture').then(m => ({ default: m.Panel }))
    }
    const moduleViews = { board: Panel, other: Panel }
    const { board: Board } = moduleViews
    const grid = <DashboardGrid renderModule={id => id === 'board' ? <Board/> : null}/>
  `, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const options = { jsx: ts.JsxEmit.Preserve, types: [], skipLibCheck: true }
  const host = ts.createCompilerHost(options)
  const getSource = host.getSourceFile.bind(host), exists = host.fileExists.bind(host)
  host.getSourceFile = (name, ...args) => path.resolve(name) === file ? source : getSource(name, ...args)
  host.fileExists = name => path.resolve(name) === file || exists(name)
  const checker = ts.createProgram([file], options, host).getTypeChecker()
  const coverage = inspectModuleConsumers(source, source, checker)
  assert.equal(coverage.resolved, 1)
  assert.deepEqual(coverage.uncertainties, [])
  const result = diagnosticReport('inventory', { moduleCoverage: coverage }, [])
  assert.deepEqual(result.findings.map(item => item.title), ['Módulo sin resolver: other'])
  assert.match(result.findings[0].evidence[1].detail, /Falta la rama/)
})

test('una discrepancia real muestra los dos valores y sus ubicaciones', () => {
  const { findings } = diagnosticReport('consistency', visual('760px'), [])
  assert.deepEqual(findings.map(item => item.rule), ['style-difference'])
  assert.deepEqual(findings[0].facts.variants.map(item => item.value), ['460px', '760px'])
  assert.equal(findings[0].evidence.length, 2)
})

test('la excepción se aplica solo al valor aprobado', () => {
  const exceptions = [{ id: 'cleanup', group: 'alerts', property: 'width', expected: '760px',
    surface: { file: 'src/demo.tsx', label: 'Limpieza: Limpieza' }, reason: 'Vista previa', sources: ['policy.json'] }]
  const approved = diagnosticReport('consistency', visual('760px', { exceptions }), [])
  assert.equal(approved.findings.length, 0)
  assert.equal(approved.exceptions[0].title, 'cleanup')
  const changed = diagnosticReport('consistency', visual('700px', { exceptions }), [])
  assert.equal(changed.exceptions.length, 0)
  assert.ok(changed.findings.some(item => item.rule === 'exception-mismatch'))
})

test('al corregir el ancho desaparece el caso, incluso si antes se había aceptado', () => {
  const ref = diagnosticReport('consistency', visual('760px'), []).findings[0].ref
  const fixed = diagnosticReport('consistency', visual('460px'), [{ ref, reason: 'Ancho aprobado' }])
  assert.deepEqual([fixed.findings.length, fixed.exceptions.length], [0, 0])
})

test('desplazar la evidencia de línea conserva la decisión y actualiza su ubicación', () => {
  const ref = diagnosticReport('consistency', visual('760px'), []).findings[0].ref
  const moved = diagnosticReport('consistency', visual('760px', { line: 8 }), [{ ref, reason: 'Ancho aprobado' }])
  assert.equal(moved.findings.length, 0)
  assert.equal(moved.exceptions[0].finding.ref, ref)
  assert.equal(moved.exceptions[0].finding.evidence[0].line, 8)
})

test('una declaración numérica repetida y coincidente con un token se publica una sola vez', () => {
  const sheet = (file, text) => ({ file, hasDashboardTokens: true, rules: parseCssText(file, text, { allDeclarations: true }) })
  const tokens = sheet('src/styles/tokens.css', ':root { --space-2: 6px; }')
  tokens.rules[0].declarations[0].rootTokenExpansion = '6px'
  const css = [tokens, sheet('a.css', '.one { padding: 6px } .two { padding: 6px }'), sheet('b.css', '.three { padding: 6px }')]
  const raw = collectUiConsistency({ css, modules: [], surfaces: [] }, { groups: [], exceptions: [] })
  const report = diagnosticReport('consistency', raw, [])
  assert.equal(report.findings.length, 0)
  assert.equal(report.observations.length, 3)
  const rows = renderUiConsistency(report).sections.flatMap(section => section.blocks).join('\n').split('\n')
  assert.equal(rows.filter(row => row.includes('.one')).length, 1)
  assert.ok(rows.some(row => row.includes('.one') && row.includes('Repetido 3 veces en 2 hojas') && row.includes('--space-2')))
  css[2].hasDashboardTokens = false
  const isolated = collectUiConsistency({ css, modules: [], surfaces: [] }, { groups: [], exceptions: [] })
  const outside = isolated.cssCoincidences.find(entry => entry.file === 'b.css')
  assert.equal(outside.repeat.occurrences, 3)
  assert.deepEqual(outside.matches, [])
})

test('el HTML autónomo y las hojas compartidas como texto no heredan tokens del dashboard', () => {
  const sources = new Map()
  const source = (file, text) => sources.set(file, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true))
  const resolve = (file, specifier) => path.posix.join(path.posix.dirname(file), specifier.split('?')[0])
  source('src/main.tsx', "import './styles/tokens.css'; import './both.css'; import('./feature')")
  source('src/feature', "import './app.css'; import html from './print.css?raw'; import copy from './both.css?raw'")
  source('src/detached', "import './unknown.css'")
  assert.deepEqual([...sheetsWithDashboardTokens(sources, resolve)].sort(), ['src/app.css', 'src/styles/tokens.css'])
  source('src/main.tsx', "import palette from './styles/tokens.css?raw'; import './feature'")
  assert.equal(sheetsWithDashboardTokens(sources, resolve).size, 0)
})
