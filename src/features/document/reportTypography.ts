import fontStyles from '@/styles/fonts.css?raw'

const FONT_FAMILY = 'Roboto Condensed'
const FONT_ERROR = 'No se pudo cargar Roboto Condensed para el informe.'
// The report uses normal variable faces for both regular and bold text.
const definitions = [...fontStyles.matchAll(/@font-face\s*\{[^}]*\}/g)]
  .map(match => match[0])
  .filter(rule => /font-family:\s*"Roboto Condensed"/.test(rule) && /font-style:\s*normal\s*;/.test(rule))
let preparation: Promise<string> | undefined

export async function waitForReportFonts(target: Document): Promise<void> {
  try {
    const faces = [...target.fonts].filter(face => face.family.replace(/["']/g, '').trim() === FONT_FAMILY && face.style === 'normal')
    if (!definitions.length || faces.length < definitions.length) throw new Error(FONT_ERROR)
    await Promise.all(faces.map(face => face.load()))
    await target.fonts.ready
  } catch (cause) { throw new Error(FONT_ERROR, { cause }) }
}

async function embedReportFonts(): Promise<string> {
  if (!definitions.length) throw new Error(FONT_ERROR)
  const embedded = await Promise.all(definitions.map(async rule => {
    const source = rule.match(/url\("([^")]+)"\)/)?.[1]
    if (!source?.startsWith('/assets/fonts/roboto-condensed/')) throw new Error(FONT_ERROR)
    const response = await fetch(source)
    if (!response.ok) throw new Error(FONT_ERROR)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes[0] !== 0x77 || bytes[1] !== 0x4f || bytes[2] !== 0x46 || bytes[3] !== 0x32) throw new Error(FONT_ERROR)
    const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
    return rule.replace(source, 'data:font/woff2;base64,' + encoded)
  }))
  return embedded.join('\n')
}

export function prepareReportTypography(): Promise<string> {
  preparation ??= Promise.all([embedReportFonts(), waitForReportFonts(document)])
    .then(([styles]) => styles)
    .catch(cause => { preparation = undefined; throw new Error(FONT_ERROR, { cause }) })
  return preparation
}
