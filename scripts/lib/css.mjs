import { isPaintProperty } from './css-paint.mjs'

export const measures = /^(?:(?:min-|max-)?(?:width|height|inline-size|block-size)|font(?:-.+)?|line-height|letter-spacing|padding(?:-.+)?|gap|row-gap|column-gap|box-sizing|flex-basis)$/

export function parseCssText(file, text, { allDeclarations = false } = {}) {
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
    const raw = clean.slice(start, end)
    const chunk = raw.trim(), colon = chunk.indexOf(':')
    if (!stack.length || colon < 1) return
    const property = chunk.slice(0, colon).trim(), value = chunk.slice(colon + 1).trim()
    const rule = stack.at(-1)
    if (allDeclarations || property.startsWith('--') || measures.test(property) || isPaintProperty(property) || (property === 'src' && rule.selector === '@font-face')) {
      const offset = start + raw.search(/\S/)
      rule.declarations.push({ property, value, file, line: line(offset), offset })
    }
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

