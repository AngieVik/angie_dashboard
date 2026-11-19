export const paintProperties = [
  'color', 'background', 'background-color', 'background-image',
  'border', 'border-color',
  ...['top', 'right', 'bottom', 'left', 'block', 'inline', 'block-start', 'block-end', 'inline-start', 'inline-end'].flatMap(side => [`border-${side}`, `border-${side}-color`]),
  'outline', 'outline-color', 'text-decoration', 'text-decoration-color', 'caret-color', 'accent-color',
  'fill', 'stroke', 'box-shadow', 'text-shadow', 'filter', 'backdrop-filter',
]
const properties = new Set(paintProperties)
export const isPaintProperty = property => properties.has(property)

const namedColors = { black: '#000', white: '#fff', red: '#f00', green: '#008000', blue: '#00f',
  yellow: '#ff0', gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000',
  purple: '#800080', fuchsia: '#f0f', lime: '#0f0', olive: '#808000', navy: '#000080',
  teal: '#008080', aqua: '#0ff', transparent: '#0000' }

function colorKey(value) {
  value = value.toLowerCase()
  if (Object.hasOwn(namedColors, value)) value = namedColors[value]
  let channels
  if (/^#[\da-f]{3,4}$/.test(value)) value = '#' + [...value.slice(1)].map(character => character + character).join('')
  if (/^#[\da-f]{6}(?:[\da-f]{2})?$/.test(value)) {
    channels = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16))
    channels.push(value.length === 9 ? parseInt(value.slice(7), 16) / 255 : 1)
  } else {
    const rgb = value.match(/^rgba?\(([^()]*)\)$/)
    if (!rgb) return null
    const parts = rgb[1].trim().split(/\s*[,/]\s*|\s+/)
    if (parts.length < 3 || parts.length > 4 || parts.some(part => !/^(?:\d*\.\d+|\d+\.?\d*)%?$/.test(part))) return null
    channels = parts.map((part, index) => part.endsWith('%') ? parseFloat(part) * (index === 3 ? 1 / 100 : 255 / 100) : Number(part))
    if (channels.length === 3) channels.push(1)
    if (channels.some((channel, index) => channel < 0 || channel > (index === 3 ? 1 : 255))) return null
  }
  return `rgba(${channels.map(channel => Number(channel.toFixed(6))).join(',')})`
}

function functionEnd(text, start) {
  let depth = 1, quote = ''
  for (let index = start; index < text.length; index++) {
    const character = text[index]
    if (character === '\\') { index++; continue }
    if (quote) { if (character === quote) quote = ''; continue }
    if (character === '"' || character === "'") quote = character
    else if (character === '(') depth++
    else if (character === ')' && --depth === 0) return index + 1
  }
  return text.length
}

export function paintColors(value) {
  const matches = [], tokens = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:var|url)\s*\(|#[\da-f]+\b|\brgba?\([^()]*\)|\b[a-z][\w-]*\b/gi
  for (let match; (match = tokens.exec(value));) {
    // A fallback belongs to its var(); hashes in URLs and quoted content are not colors.
    if (/^(?:var|url)\s*\(/i.test(match[0])) { tokens.lastIndex = functionEnd(value, tokens.lastIndex); continue }
    const key = colorKey(match[0])
    if (key) matches.push({ literal: match[0], key, index: match.index })
  }
  return matches
}

export function normalizePaint(value) {
  let normalized = '', start = 0
  for (const color of paintColors(value)) {
    normalized += value.slice(start, color.index) + color.key
    start = color.index + color.literal.length
  }
  // Preserve case in opaque parts, notably case-sensitive custom property names.
  return (normalized + value.slice(start)).trim().replace(/\s*!important\s*$/i, '')
    .replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
}
