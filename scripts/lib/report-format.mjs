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

const maxLines = 250
const maxCharacters = 10_000
const minimumContinuationCases = 2

function pageText(doc, entries, navigation = '', first = true) {
  const parts = ['# ' + doc.title]
  if (navigation) parts.push(navigation)
  if (first) parts.push(...doc.intro)
  for (const section of doc.sections) {
    const content = entries.filter(entry => entry.section === section)
    if (content.length) parts.push('## ' + section.title + ' (' + (section.count ?? section.blocks.length) + ')', content.map(entry =>
      entry.continued ? 'Continuación de ' + entry.label + ':\n' + entry.text : entry.text).join('\n'))
    else if (first && !section.blocks.length) parts.push('## ' + section.title + ' (0)')
  }
  return parts.join('\n\n') + '\n'
}

const fits = (text, margin = 0) => text.length <= maxCharacters * (1 + margin) && text.trimEnd().split('\n').length <= maxLines * (1 + margin)
const smallOverrun = 0.02
export const partName = number => number === 1 ? 'report.md' : 'report-' + number + '.md'

function navigation(number, more) {
  const links = []
  if (number > 1) links.push('[Anterior](' + partName(number - 1) + ')')
  if (more) links.push('[Siguiente](' + partName(number + 1) + ')')
  return links.length ? 'Parte ' + number + ' · ' + links.join(' · ') : ''
}

// An individual case can itself exceed a page. Prefer a full evidence line;
// a long expression with no breaks is continued without discarding characters.
function fragmentEnd(text, available) {
  const prefix = text.slice(0, available)
  const line = prefix.lastIndexOf('\n')
  if (line >= available / 2) return line + 1
  const space = prefix.lastIndexOf(' ')
  if (space >= available / 2) return space + 1
  return /[\uD800-\uDBFF]$/.test(prefix) ? available - 1 : available
}

export function reportPages(doc) {
  if (!fits(pageText(doc, [], '', true)) && doc.intro.length) {
    doc = { ...doc, intro: [], sections: [{ title: 'Alcance', blocks: doc.intro }, ...doc.sections] }
  }
  const entries = doc.sections.flatMap(section => section.blocks.map((text, index) => ({
    section, text, label: text.match(/^- [^\n]*?(`[a-f0-9]{16}`)/)?.[1] ?? 'la entrada ' + (index + 1),
  })))
  const pages = []
  let cursor = 0
  do {
    const number = pages.length + 1
    const render = (items, more) => pageText(doc, items, navigation(number, more), number === 1)
    const current = []
    while (cursor < entries.length) {
      const entry = entries[cursor]
      const tail = entries.length - cursor
      if (fits(render([...current, entry], tail > 1))) {
        current.push(entry)
        cursor++
        continue
      }
      if (tail <= maxLines && fits(render([...current, ...entries.slice(cursor)], false), smallOverrun)) {
        current.push(...entries.slice(cursor))
        cursor = entries.length
        break
      }
      if (current.length) {
        // Give a substantial final case a companion when both fit on the next page.
        if (tail < minimumContinuationCases && current.length >= minimumContinuationCases && fits(pageText(doc, [current.at(-1), entry], navigation(number + 1, false), false))) {
          current.pop()
          cursor--
        }
        break
      }
      const baseline = render([{ ...entry, text: '' }], true)
      const availableLines = Math.max(1, maxLines - baseline.split('\n').length)
      const availableChars = Math.max(1, maxCharacters - baseline.length)
      const lineWindow = entry.text.split('\n', availableLines).join('\n')
      const cut = fragmentEnd(entry.text, Math.min(lineWindow.length || 1, availableChars))
      if (cut < 1) throw new Error('Cabecera demasiado extensa para continuar el informe.')
      current.push({ ...entry, text: entry.text.slice(0, cut) })
      if (cut >= entry.text.length) cursor++
      else entries[cursor] = { ...entry, text: entry.text.slice(cut), continued: true }
      break
    }
    pages.push(render(current, cursor < entries.length))
  } while (cursor < entries.length)
  return pages
}

export function failureDocument(area, error) {
  return { title: area, intro: [], sections: [{ title: 'Error de ejecución', blocks: [String(error)] }] }
}
export function initialGzipSize(chunks) {
  const bytes = chunks.reduce((sum, chunk) => sum + (chunk.initial ? chunk.gzipBytes : 0), 0)
  return (bytes / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kB gzip'
}
