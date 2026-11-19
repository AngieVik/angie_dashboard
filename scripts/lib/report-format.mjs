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

export function wrapReport(text, width = 110) {
  return String(text).split('\n').map(line => {
    if (line.startsWith('#') || !line.trim()) return line
    const prefix = line.match(/^\s*(?:- )?/)?.[0] ?? ''
    const continuation = prefix.includes('-') ? prefix.replace('- ', '  ') : prefix
    const words = line.slice(prefix.length).match(/\[[^\n]*?\]\([^\n]*?\)\S*|\S+/g) ?? []
    const lines = []
    let current = prefix
    let first = true
    for (const word of words) {
      if (!first && current.length + word.length + 1 > width) {
        lines.push(current)
        current = continuation
        first = true
      }
      current += (first ? '' : ' ') + word
      first = false
    }
    lines.push(current)
    return lines.join('\n')
  }).join('\n')
}

export function renderStageStatus(analyzer, status, detail = '') {
  return '# ' + analyzer + '\n\n**' + (status === 'failed' ? 'Error de ejecución' : 'No ejecutado')
    + '**\n\n' + wrapReport(detail) + '\n'
}

export function reportSection(title, rows) {
  const content = rows.filter(Boolean)
  return content.length ? `## ${title}\n\n${content.map(row => wrapReport(row)).join('\n')}` : ''
}
