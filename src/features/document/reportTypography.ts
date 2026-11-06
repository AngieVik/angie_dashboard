import fontStyles from '@/styles/fonts.css?raw'

const FONT_FAMILY = 'Roboto Condensed'
const FONT_ERROR = 'No se pudo cargar Roboto Condensed para el informe.'
const FONT_TIMEOUT_MS = 5000
const FALLBACK_STYLES = ':root{--report-font-family:sans-serif}'
// The report uses normal variable faces for both regular and bold text.
const definitions = [...fontStyles.matchAll(/@font-face\s*\{[^}]*\}/g)]
  .map(match => match[0])
  .filter(rule => /font-family:\s*"Roboto Condensed"/.test(rule) && /font-style:\s*normal\s*;/.test(rule))
let preparation: Promise<string> | undefined

async function withFontDeadline<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(FONT_ERROR)), FONT_TIMEOUT_MS)
  })
  try { return await Promise.race([Promise.resolve().then(() => run(controller.signal)), deadline]) }
  finally {
    clearTimeout(timer)
    // Fetch/body reads are abortable. Native font loading is not; its late
    // completion has no callbacks that change the chosen report typography.
    controller.abort()
  }
}

async function loadReportFonts(target: Document, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  const faces = [...target.fonts].filter(face => face.family.replace(/["']/g, '').trim() === FONT_FAMILY && face.style === 'normal')
  if (!definitions.length || faces.length < definitions.length) throw new Error(FONT_ERROR)
  await Promise.all(faces.map(face => face.load()))
  signal.throwIfAborted()
  await target.fonts.ready
  signal.throwIfAborted()
}

export async function waitForReportFonts(target: Document): Promise<void> {
  // Pagination serializes this choice. Preview/export keep the same fallback
  // even if a previously pending Roboto face finishes loading afterwards.
  if (target !== document && target.documentElement.style.getPropertyValue('--report-font-family').trim() === 'sans-serif') return
  try { await withFontDeadline(signal => loadReportFonts(target, signal)) }
  catch {
    if (target !== document) target.documentElement.style.setProperty('--report-font-family', 'sans-serif')
  }
}

async function embedReportFonts(signal: AbortSignal): Promise<string> {
  if (!definitions.length) throw new Error(FONT_ERROR)
  const embedded = await Promise.all(definitions.map(async rule => {
    const source = rule.match(/url\("([^")]+)"\)/)?.[1]
    if (!source?.startsWith('/assets/fonts/roboto-condensed/')) throw new Error(FONT_ERROR)
    signal.throwIfAborted()
    const response = await fetch(source, { signal })
    if (!response.ok) throw new Error(FONT_ERROR)
    const bytes = new Uint8Array(await response.arrayBuffer())
    signal.throwIfAborted()
    if (bytes[0] !== 0x77 || bytes[1] !== 0x4f || bytes[2] !== 0x46 || bytes[3] !== 0x32) throw new Error(FONT_ERROR)
    const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
    return rule.replace(source, 'data:font/woff2;base64,' + encoded)
  }))
  return embedded.join('\n')
}

export function prepareReportTypography(): Promise<string> {
  if (preparation) return preparation
  const current = withFontDeadline(async signal => {
    const [styles] = await Promise.all([embedReportFonts(signal), loadReportFonts(document, signal)])
    return styles
  })
    .catch(() => {
      if (preparation === current) preparation = undefined
      return FALLBACK_STYLES
    })
  preparation = current
  return current
}
