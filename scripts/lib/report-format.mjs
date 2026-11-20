const scopes = {
  inventory: 'Fuentes, componentes y registros declarados.',
  styles: 'Geometría y estilos declarados; no calcula la cascada del navegador.',
  consistency: 'Grupos comparables y candidatos a tokens; las coincidencias requieren revisión semántica.',
  unused: 'Usos estáticos reconocidos; un candidato sin uso no autoriza borrarlo.',
  architecture: 'Imports locales de src; distingue valores, tipos y cargas diferidas.',
  dependencies: 'Manifiesto, lock, instalación y consumidores locales; no consulta vulnerabilidades.',
  assets: 'Recursos públicos y referencias declaradas; no comprueba cargas de red.',
  bundle: 'Build temporal, bytes emitidos y precaché; la atribución por fuente es aproximada.',
}

export const reportScope = analyzer => scopes[analyzer] ?? 'Estado de la ejecución.'
export function reportDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value ?? '')
    : new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function reportCode(value) {
  const text = String(value) || "''"
  let length = 1
  for (const [run] of text.matchAll(/`+/g)) length = Math.max(length, run.length + 1)
  const delimiter = '`'.repeat(length)
  const padding = /^[` ]|[` ]$/.test(text) && /\S/.test(text) ? ' ' : ''
  return delimiter + padding + text + padding + delimiter
}

function wrapProse(lines, width) {
  // Mask only whitespace inside inline markup, keeping its positions in the original text.
  const markup = /(?<![`\\])(`+)(?!`)(?:(?!\r?\n[ \t]*\r?\n)[\s\S])*?(?<!`)\1(?!`)|\[[^\r\n]*?\]\([^\r\n]*?\)/g
  const masked = lines.join('\n').replace(markup, span => span.replace(/[^\S\r\n]/g, '\0')).split('\n')
  return lines.map((line, index) => {
    if (line.length <= width || /^(?:[ \t]*#| {4}|\t)/.test(line)) return line
    const prefix = line.slice(0, masked[index].match(/^[ \t]*(?:- )?/)[0].length)
    const continuation = prefix.replace('- ', '  ')
    const rows = []
    let current = prefix, end = prefix.length, hasText = false
    for (const match of masked[index].slice(prefix.length).matchAll(/\S+/g)) {
      const start = prefix.length + match.index
      const gap = line.slice(end, start)
      end = start + match[0].length
      const word = line.slice(start, end)
      if (hasText && current.length + gap.length + word.length > width) {
        rows.push(current)
        current = continuation + word
      } else current += gap + word
      hasText = true
    }
    rows.push(current + line.slice(end))
    return rows.join('\n')
  })
}

export function wrapReport(text, width = 110) {
  const output = [], prose = []
  let fence
  for (const line of String(text).split('\n')) {
    const marker = line.match(/^[ \t]*(`{3,}|~{3,})([^\n]*)$/)
    if (fence) {
      output.push(line)
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined
    } else if (marker && (marker[1][0] === '~' || !marker[2].includes('`'))) {
      output.push(...wrapProse(prose, width), line)
      prose.length = 0
      fence = marker[1]
    } else prose.push(line)
  }
  return output.concat(wrapProse(prose, width)).join('\n')
}

export function renderStageFailure(analyzer, detail = '') {
  return '# ' + analyzer + '\n\n**Error de ejecución**\n\n' + wrapReport(detail) + '\n'
}

export function reportSection(title, rows) {
  const content = rows.filter(Boolean)
  return content.length ? `## ${title}\n\n${wrapReport(content.join('\n'))}` : ''
}
