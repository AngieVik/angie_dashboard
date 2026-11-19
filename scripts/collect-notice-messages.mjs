import ts from 'typescript'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

// Read diagnostics from their owning code; never ship source files to the browser.
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const output = join(root, 'src/features/notices/noticeMessages.ts')
const levels = ['message', 'success', 'info', 'warning', 'error', 'loading']

export function collectNoticeMessages(program) {
  const messages = new Map(), resolving = new Set()
  const checker = program.getTypeChecker()
  function add(text, level) {
    // Preserve the original text: it is also the key of a saved preference.
    if (!text.trim()) return
    if (!messages.has(text)) messages.set(text, new Set())
    messages.get(text).add(level)
  }
  function strings(node, level = 'error') {
    if (ts.isStringLiteralLike(node)) add(node.text, level)
    else if (ts.isConditionalExpression(node)) { strings(node.whenTrue, level); strings(node.whenFalse, level) }
    else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind)) { strings(node.left, level); strings(node.right, level) }
    else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) strings(node.expression, level)
    else if (ts.isArrayLiteralExpression(node)) node.elements.forEach(element => strings(element, level))
    else if (ts.isSpreadElement(node)) strings(node.expression, level)
    else if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node), declaration = symbol?.valueDeclaration
      // Parameters, imports and other bindings must not inherit a same-name variable.
      if (!symbol || resolving.has(symbol) || !declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer) return
      resolving.add(symbol)
      try { strings(declaration.initializer, level) }
      finally { resolving.delete(symbol) }
    }
  }
  function stringDictionary(node) {
    const declaration = node.parent, type = ts.isVariableDeclaration(declaration) ? declaration.type : undefined
    // Record keys such as error/message can label statuses rather than emit notices.
    return type && ts.isTypeReferenceNode(type) && type.typeName.getText() === 'Record'
      && type.typeArguments?.[1]?.kind === ts.SyntaxKind.StringKeyword
  }
  function visit(node, code) {
    if (ts.isNewExpression(node) && /Error$/.test(node.expression.getText(code)) && node.arguments?.[0]) strings(node.arguments[0])
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(code)
      if (/^toast(?:\.(?:error|success|info|warning|message|loading))?$/.test(expression)) {
        if (node.arguments[0]) strings(node.arguments[0], expression.split('.')[1] ?? 'message')
      } else if (/^(?:errors|warnings)\.push$/.test(expression)) {
        for (const argument of node.arguments) strings(argument, expression === 'warnings.push' ? 'warning' : 'error')
      } else if (/^set(?:[A-Z]\w*)?Error$/.test(expression) || /^(?:notice|fail|invalid|failure)$/.test(expression)) {
        if (node.arguments[0]) strings(node.arguments[0])
      }
      if (expression === 'noticeText' && node.arguments[2]) strings(node.arguments[2])
    }
    if (ts.isPropertyAssignment(node) && /^(?:error|message)$/.test(node.name.getText(code)) && !stringDictionary(node.parent)) strings(node.initializer)
    if (ts.isVariableDeclaration(node) && /ERROR|ErrorMessage/.test(node.name.getText(code)) && node.initializer) strings(node.initializer)
    if (ts.isReturnStatement(node) && node.expression) {
      let owner = node.parent
      while (owner && !ts.isFunctionLike(owner)) owner = owner.parent
      if (owner?.name && /error|message/i.test(owner.name.getText(code))) {
        const declared = ts.getJSDocTags(owner).find(tag => tag.tagName.text === 'notice-level')?.comment
        strings(node.expression, typeof declared === 'string' && levels.includes(declared) ? declared : 'error')
      }
    }
    ts.forEachChild(node, child => { visit(child, code) })
  }
  for (const file of program.getRootFileNames()) {
    const code = program.getSourceFile(file)
    if (!code) throw new Error(`No se pudo analizar ${file}`)
    if (code.parseDiagnostics.length) throw new Error(`${file}: ${ts.flattenDiagnosticMessageText(code.parseDiagnostics[0].messageText, ' ')}`)
    visit(code, code)
  }
  return [...messages].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([text, known]) => ({ text, levels: levels.filter(level => known.has(level)) }))
}
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : entry.isFile() && /\.tsx?$/.test(path) && path !== output ? [path] : []
  })
}
function generateCatalog() {
  // Binding symbols needs neither dependency resolution nor semantic diagnostics.
  const program = ts.createProgram(walk(join(root, 'src')), {
    noResolve: true, noLib: true, types: [], target: ts.ScriptTarget.Latest, jsx: ts.JsxEmit.Preserve,
  })
  const messages = collectNoticeMessages(program)
  const text = '// Generated by scripts/collect-notice-messages.mjs from concrete diagnostics in src.\n'
    + '// Variable diagnostics are added with their full original text when they occur.\n'
    + "import type { NoticeLevel } from './noticePreferences'\n"
    + 'export const NOTICE_MESSAGES: readonly { text: string; levels: readonly NoticeLevel[] }[] = '
    + JSON.stringify(messages, null, 2) + '\n'
  return { text, count: messages.length }
}

function readCatalog() {
  try { return readFileSync(output, 'utf8') }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

export function checkNoticeCatalog() {
  const { text, count } = generateCatalog()
  const previous = readCatalog()
  if (previous !== text) throw new Error(`${previous === null ? 'Falta el catálogo de avisos' : 'El catálogo de avisos está desactualizado'}. Ejecuta npm run notices:catalog antes de analizar el bundle.`)
  return count
}

function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write('Uso: npm run notices:catalog [-- --check]\nSin opciones: regenera el catálogo solo si cambia. --check: comprueba sin escribir; salida 0 si está actualizado, 1 si falta, está desactualizado o hay un error.\n')
    return
  }
  if (args.length && (args.length !== 1 || args[0] !== '--check')) throw new Error('Argumentos no reconocidos. Usa --help.')
  if (args[0] === '--check') {
    process.stdout.write(`Catálogo de avisos actualizado: ${checkNoticeCatalog()} textos.\n`)
    return
  }
  const { text, count } = generateCatalog()
  if (readCatalog() !== text) writeFileSync(output, text)
  process.stdout.write(`${count} textos de aviso en ${relative(root, output)}.\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() }
  catch (error) { process.stderr.write(`Catálogo de avisos: ${error.message}\n`); process.exitCode = 1 }
}
