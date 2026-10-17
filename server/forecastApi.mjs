import catalogue from '../src/features/forecast/municipalities.json' with { type: 'json' }

const AEMET = 'https://www.aemet.es'
const municipalities = new Map(catalogue.municipalities.map(item => [item.slug, item.name]))
const fields = ['estado_cielo', 'temp', 'sen_termica', 'prob_prec', 'humedad_rel', 'dir_viento', 'avisos']
const cache = new Map()
const pending = new Map()
const warningCache = new Map()
const warningPending = new Map()
const cacheLifetime = 5 * 60_000
const staleLifetime = 30 * 60_000
const entities = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", deg: '°', copy: '©',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü' }

function decode(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, entity) => {
    if (!entity.startsWith('#')) return entities[entity] ?? original
    const code = entity[1]?.toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : original
  })
}

function text(html) {
  return decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/\b([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
    .map(match => [match[1].toLowerCase(), decode(match[2] ?? match[3] ?? '')]))
}

function officialUrl(value, imagesOnly = false) {
  if (!value) return null
  try {
    const url = new URL(value, AEMET)
    if (url.origin !== AEMET || url.username || url.password || (imagesOnly && !url.pathname.startsWith('/imagenes/'))) return null
    return url.href
  } catch { return null }
}

function span(value) {
  if (value === undefined) return 1
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1 || number > 24) throw new Error('AEMET ha cambiado la estructura de la tabla.')
  return number
}

function cells(row) {
  return [...row.matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map(match => {
    const attrs = attributes(match[2]), body = match[3]
    const titles = [...new Set([...body.matchAll(/<[^>]+>/g)].flatMap(tag => {
      const title = attributes(tag[0]).title
      return title ? [title] : []
    }))]
    const images = [...body.matchAll(/<img\b([^>]*)>/gi)].flatMap(image => {
      const imageAttrs = attributes(image[1]), src = officialUrl(imageAttrs.src ?? '', true)
      return src ? [{ src, alt: imageAttrs.alt ?? imageAttrs.title ?? '', title: imageAttrs.title ?? imageAttrs.alt ?? '' }] : []
    })
    const warnings = [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].flatMap(link => {
      const linkAttrs = attributes(link[1]), href = officialUrl(linkAttrs.href ?? '')
      const level = link[2].match(/ico_fondo_redondeado_aviso_nivel_([1-4])/)
      const warningTitle = [...link[2].matchAll(/<[^>]+>/g)].map(tag => attributes(tag[0]).title).find(Boolean)
      if (!level || !href) return []
      const phenomenon = link[2].match(/aviso_fenomeno_([A-Z]{2})\b/)?.[1] ?? null
      return [{ level: Number(level[1]), text: linkAttrs['aria-label'] ?? linkAttrs.title ?? warningTitle ?? '', title: warningTitle ?? linkAttrs.title ?? '', href, phenomenon }]
    })
    return { text: text(body), title: attrs.title ?? '', colSpan: span(attrs.colspan), rowSpan: span(attrs.rowspan), titles, images, warnings, missing: false }
  })
}

function rows(section) {
  return [...section.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)]
    .map(match => ({ className: attributes(match[1]).class ?? '', cells: cells(match[2]) }))
}

function extract(html, slug, response) {
  // Parse only the known widget table. Never forward provider markup or scripts.
  const table = html.match(/<table\b[^>]*\bid=["']table_widget["'][^>]*>([\s\S]*?)<\/table>/i)?.[1]
  const head = table?.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1]
  const body = table?.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1]
  if (!head || !body) throw new Error('AEMET no ha entregado la tabla de pronóstico esperada.')
  const headers = rows(head)
  const days = headers.find(row => row.cells[0]?.text === 'Fecha')?.cells.slice(1)
  const periods = headers.at(-1)?.cells
  if (!days?.length || !periods?.length || days.length > 4 || periods.length > 12 || days.reduce((sum, day) => sum + day.colSpan, 0) !== periods.length) {
    throw new Error('AEMET ha cambiado los periodos de la tabla.')
  }
  const sourceRows = rows(body)
  const dataRows = fields.map(id => {
    const row = sourceRows.find(item => item.className.split(/\s+/).includes(id))
    if (!row || row.cells.length < 2) throw new Error('Falta un campo de la tabla oficial de AEMET.')
    const [label, ...values] = row.cells
    const count = values.reduce((sum, cell) => sum + cell.colSpan, 0)
    if (count > periods.length || (id !== 'avisos' && count !== periods.length)) throw new Error('Los periodos de AEMET no coinciden con sus valores.')
    // The widget only publishes warnings for some days. Missing days are unknown.
    if (count < periods.length) values.push({ text: '', title: 'Este producto no publica avisos para este periodo.', colSpan: periods.length - count, rowSpan: 1, titles: [], images: [], warnings: [], missing: true })
    return { id, label: label.text, title: label.title, cells: values }
  })
  const modified = response.headers.get('last-modified'), timestamp = modified ? Date.parse(modified) : Number.NaN
  return { municipality: municipalities.get(slug), sourceUrl: AEMET + '/es/eltiempo/prediccion/municipios/' + slug,
    attribution: '© AEMET', resourceUpdatedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
    retrievedAt: new Date().toISOString(), periodsTimeZone: 'UTC', days, periods, rows: dataRows, stale: false }
}

async function download(slug) {
  const url = AEMET + '/es/eltiempo/prediccion/municipios/mostrarwidget/' + slug + '?w=g4p111111111ohmffffffx303438t555b60r1s6n2'
  const { body, response } = await downloadResource(url)
  return extract(body, slug, response)
}

async function downloadResource(url, timeout = 12_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), redirect: 'error', headers: { Accept: 'text/html, application/json' } })
  if (!response.ok) throw new Error('AEMET no está disponible en este momento.')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('AEMET ha entregado una respuesta vacía.')
  const chunks = []; let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 1_000_000) throw new Error('La respuesta de AEMET supera el tamaño previsto.')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  const charset = response.headers.get('content-type')?.match(/charset=([^; ]+)/i)?.[1] ?? 'utf-8'
  return { body: new TextDecoder(charset).decode(Buffer.concat(chunks)), response }
}

async function downloadWarningDetails(slug, day, expectedDay) {
  // Only follow a zone/day link supplied by this municipality's official widget.
  const data = await forecast(slug)
  const warning = data.rows.find(row => row.id === 'avisos')?.cells.flatMap(cell => cell.warnings)
    .find(item => new URL(item.href).searchParams.get('w') === day)
  if (!warning) throw new Error('El aviso ha cambiado. Actualiza el pronóstico.')
  const source = new URL(warning.href), zone = source.searchParams.get('l')
  if (source.pathname !== '/es/eltiempo/prediccion/avisos' || !/^\d{6}$/.test(zone ?? '')) throw new Error('Zona de avisos no disponible.')
  const page = await downloadResource(source.href, 6_000)
  const tags = [...page.body.matchAll(/<(?:input|div)\b([^>]*)>/gi)].map(match => attributes(match[1]))
  const date = tags.find(tag => tag.id === 'fecha-seleccionada-origen')?.value
  const dayCode = tags.find(tag => tag.id === 'dia-seleccionado-origen')?.value
  const region = tags.find(tag => tag.id === 'selector-ambito')?.['data-ambito']
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(date ?? '') || !/^D\+[012]$/.test(dayCode ?? '') || !['PB', 'CAN', 'CEU', 'MEL'].includes(region)) {
    throw new Error('AEMET ha cambiado la selección del detalle de avisos.')
  }
  if (Number(date.slice(8, 10)) !== expectedDay) throw new Error('El día del aviso ha cambiado. Actualiza el pronóstico.')
  const literals = JSON.parse(page.body.match(/\bvar\s+literalesJS\s*=\s*(\{[\s\S]*?\})\s*;/)?.[1] ?? 'null')
  if (!literals || typeof literals !== 'object') throw new Error('Faltan las etiquetas oficiales de los avisos.')
  const result = await downloadResource(AEMET + '/es/api-eltiempo/resumen-lista-avisos/' + region + '/' + date + '/' + dayCode + '/' + zone, 6_000)
  const payload = JSON.parse(result.body)
  if (!Array.isArray(payload.orden_avisos) || payload.orden_avisos.length > 200) throw new Error('AEMET no ha entregado el detalle esperado.')
  const literal = key => typeof literals[key] === 'string' ? text(literals[key]) : ''
  if (!literal(zone) || !literal(zone.slice(0, 4))) throw new Error('AEMET no ha entregado el nombre de la zona del aviso.')
  const levels = { 1: 'avisos.rojo.desc', 2: 'avisos.naranja.desc', 3: 'avisos.amarillo.desc' }
  const isTimestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
  const items = payload.orden_avisos.map(entry => {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !entry[1]) throw new Error('Formato de aviso no reconocido.')
    const [id, item] = entry, match = id.match(/.+\-.+\-\d{2}(.+)\-.+\-(\d+)\D*/)
    const phenomenon = match?.[1]?.slice(0, 2), itemZone = match?.[2], level = Number(item.Nivel)
    if (itemZone !== zone || !phenomenon || ![1, 2, 3].includes(level) || !literal('avisos.boletin.' + phenomenon) || !isTimestamp(item.Onset) || !isTimestamp(item.Expire)) {
      throw new Error('El detalle no coincide con la zona o el fenómeno del aviso.')
    }
    const value = key => typeof item[key] === 'string' ? text(item[key]) : ''
    return { id, phenomenon, phenomenonName: literal('avisos.boletin.' + phenomenon), level, levelName: literal(levels[level]),
      value: value('Valor'), probability: value('Prb'), onset: item.Onset, expires: item.Expire, comment: value('Descrption'),
      certainty: value('Certainty'), certaintyName: literal('avisos.boletin.' + value('Certainty') + 's') || value('Certainty') }
  })
  const modified = Date.parse(result.response.headers.get('last-modified') ?? '')
  return { sourceUrl: source.href, date: date.slice(0, 10), zone: literal(zone), province: literal(zone.slice(0, 4)), items,
    retrievedAt: new Date().toISOString(), resourceUpdatedAt: Number.isFinite(modified) ? new Date(modified).toISOString() : null, stale: false }
}

async function warningDetails(slug, day, expectedDay) {
  const key = slug + ':' + day + ':' + expectedDay, saved = warningCache.get(key)
  const age = saved ? Date.now() - saved.time : Number.POSITIVE_INFINITY
  if (age < cacheLifetime) return saved.data
  if (warningPending.has(key)) return warningPending.get(key)
  if (warningPending.size >= 2) throw new Error('El detalle de avisos está ocupado. Vuelve a intentarlo en unos segundos.')
  const request = downloadWarningDetails(slug, day, expectedDay).then(data => {
    warningCache.delete(key); warningCache.set(key, { data, time: Date.now() })
    if (warningCache.size > 64) warningCache.delete(warningCache.keys().next().value)
    return data
  }).catch(error => {
    // A changed day must never reuse an earlier warning as if it were current.
    if (saved && age < staleLifetime && !error.message.includes('Actualiza el pronóstico')) return { ...saved.data, stale: true }
    throw error
  }).finally(() => warningPending.delete(key))
  warningPending.set(key, request)
  return request
}

async function forecast(slug) {
  const saved = cache.get(slug), age = saved ? Date.now() - saved.time : Number.POSITIVE_INFINITY
  if (age < cacheLifetime) return saved.data
  if (pending.has(slug)) return pending.get(slug)
  if (pending.size >= 2) throw new Error('El servicio de pronóstico está ocupado. Vuelve a intentarlo en unos segundos.')
  const request = download(slug).then(data => {
    cache.delete(slug); cache.set(slug, { data, time: Date.now() })
    if (cache.size > 64) cache.delete(cache.keys().next().value)
    return data
  }).catch(error => {
    if (saved && age < staleLifetime) return { ...saved.data, stale: true }
    throw error
  }).finally(() => pending.delete(slug))
  pending.set(slug, request)
  return request
}

export function isForecastRequest(url) {
  return url.split('?')[0] === '/api/forecast' || url.startsWith('/api/forecast/')
}

export async function handleForecastRequest(request, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  const reply = (status, data) => { if (!response.destroyed && !response.writableEnded) { response.statusCode = status; response.end(JSON.stringify(data)) } }
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); reply(405, { error: 'Método no permitido.' }); return }
  let route
  try { route = new URL(request.url ?? '/', 'http://localhost') }
  catch { reply(400, { error: 'Consulta de pronóstico no válida.' }); return }
  const match = route.pathname.match(/^\/api\/forecast\/([a-z0-9-]+-id\d{5})(?:\/warnings\/(hoy|mna|pmna))?$/)
  const slug = match?.[1], day = match?.[2], expectedDay = Number(route.searchParams.get('day'))
  if (!slug || !municipalities.has(slug)) { reply(400, { error: 'Elige un municipio del catálogo de AEMET.' }); return }
  if (day && (!Number.isInteger(expectedDay) || expectedDay < 1 || expectedDay > 31)) { reply(400, { error: 'Falta el día del aviso seleccionado.' }); return }
  try { reply(200, day ? await warningDetails(slug, day, expectedDay) : await forecast(slug)) }
  catch (error) { reply(502, { error: error instanceof Error && !['AbortError', 'TimeoutError', 'TypeError', 'SyntaxError'].includes(error.name) ? error.message : 'No se pudieron obtener los datos de AEMET.' }) }
}
