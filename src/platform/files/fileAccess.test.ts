import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import { loadVisibleDocument, saveVisibleDocument, suggestFilename } from './fileAccess'
import type { FileAccessContext, SaveFileHandle } from './fileAccess'

const now = new Date(2026, 8, 30, 8, 4, 5)
const fallback = 'drp_2026-09-30_08-04-05.json'

describe('nombre propuesto, separado del título', () => {
  it.each([
    ['Servicio áé ñ_1 - norte', 'Servicio áé ñ_1 - norte.json'],
    ['a<>:"/\\|?*\u0000\u001f\u007fb . ', 'ab.json'],
    ['servicio.JSON', 'servicio.json'], ['nombre .json', 'nombre.json'],
    ['', fallback], ['... ', fallback], ['.json', fallback],
    ...['CON', 'prn', 'AUX', 'nul', 'COM1', 'COM9', 'LPT1', 'lpt9'].flatMap(name =>
      [[name, fallback], [`${name}.JSON`, fallback]]),
    ['COM10', 'COM10.json'], ['LPT0', 'LPT0.json'],
  ])('%j → %s', (title, expected) => {
    expect(suggestFilename(title, now)).toBe(expected)
  })
})

function setup() {
  let fileContent = 'archivo anterior'
  const write = vi.fn(async (text: string) => { pending = text })
  let pending = ''
  const close = vi.fn(async () => { fileContent = pending })
  const handle: SaveFileHandle = {
    queryPermission: vi.fn(async () => 'granted' as const),
    createWritable: vi.fn(async () => ({ write, close, abort: vi.fn(async () => {}) })),
  }
  const pickSave = vi.fn(async () => handle)
  const download = vi.fn<(text: string, filename: string) => void>()
  const context: FileAccessContext = { platform: { pickSave, download }, now: () => now }
  return { context, handle, pickSave, download, write, close, content: () => fileContent }
}

describe('guardado visible', () => {
  it('valida, guarda con selector y reutiliza el handle solo con el mismo título y permiso', async () => {
    const test = setup()
    const document = createEmptyDocument('Operación<> Á.JSON')
    const original = structuredClone(document)
    expect((await saveVisibleDocument(document, test.context)).status).toBe('saved')
    expect(test.pickSave).toHaveBeenCalledWith('Operación Á.json')
    expect(JSON.parse(test.content())).toEqual(original)
    expect(test.content()).toContain('\n  "format"')
    expect(test.content()).toMatch(/\n$/)
    expect(document).toEqual(original)
    await saveVisibleDocument(document, test.context)
    expect(test.pickSave).toHaveBeenCalledTimes(1)
    document.document.title = 'Otro título'
    await saveVisibleDocument(document, test.context)
    expect(test.pickSave).toHaveBeenCalledTimes(2)
    expect(test.pickSave).toHaveBeenLastCalledWith('Otro título.json')
  })

  it('descarga si no hay selector', async () => {
    const test = setup()
    test.context.platform.pickSave = undefined
    const document = createEmptyDocument('Local')
    expect((await saveVisibleDocument(document, test.context)).status).toBe('downloaded')
    expect(test.download).toHaveBeenCalledWith(expect.any(String), 'Local.json')
    expect(JSON.parse(test.download.mock.calls[0]![0])).toEqual(document)
  })

  it('cancelar no escribe, descarga ni modifica el documento o el vínculo anterior', async () => {
    const test = setup()
    const document = createEmptyDocument('Anterior')
    await saveVisibleDocument(document, test.context)
    const oldLink = test.context.link
    const oldContent = test.content()
    document.document.title = 'Nuevo nombre'
    const snapshot = structuredClone(document)
    test.pickSave.mockRejectedValueOnce(new DOMException('Cancelado', 'AbortError'))
    expect((await saveVisibleDocument(document, test.context)).status).toBe('cancelled')
    expect(test.content()).toBe(oldContent)
    expect(test.context.link).toBe(oldLink)
    expect(test.download).not.toHaveBeenCalled()
    expect(document).toEqual(snapshot)
  })

  it.each(['NotAllowedError', 'SecurityError', 'UnknownError'])('ofrece descarga al fallar el selector: %s', async name => {
    const test = setup()
    test.pickSave.mockRejectedValueOnce(new DOMException('Error', name))
    const document = createEmptyDocument('Trabajo')
    const result = await saveVisibleDocument(document, test.context)
    expect(result.status).toBe('fallback')
    expect(test.content()).toBe('archivo anterior')
    expect(test.download).not.toHaveBeenCalled()
    if (result.status === 'fallback') await result.download()
    expect(JSON.parse(test.download.mock.calls[0]![0])).toEqual(document)
  })

  it('permiso perdido en un vínculo ofrece descarga sin escribir en ese archivo', async () => {
    const test = setup()
    const document = createEmptyDocument('Trabajo')
    await saveVisibleDocument(document, test.context)
    test.write.mockClear()
    vi.mocked(test.handle.queryPermission).mockResolvedValueOnce('denied')
    expect((await saveVisibleDocument(document, test.context)).status).toBe('fallback')
    expect(test.write).not.toHaveBeenCalled()
    expect(test.pickSave).toHaveBeenCalledTimes(1)
  })

  it('un error de escritura aborta sin confirmar el archivo anterior', async () => {
    const test = setup()
    test.write.mockRejectedValueOnce(new Error('disco lleno'))
    const result = await saveVisibleDocument(createEmptyDocument(), test.context)
    expect(result.status).toBe('fallback')
    expect(test.content()).toBe('archivo anterior')
    expect(test.close).not.toHaveBeenCalled()
    const stream = await vi.mocked(test.handle.createWritable).mock.results[0]!.value
    expect(stream.abort).toHaveBeenCalled()
    expect(test.context.link).toBeUndefined()
  })

  it('no abre selector ni descarga un documento inválido', async () => {
    const test = setup()
    const document = createEmptyDocument('Trabajo')
    Object.assign(document, { timers: [] })
    expect((await saveVisibleDocument(document, test.context)).status).toBe('error')
    expect(test.pickSave).not.toHaveBeenCalled()
    expect(test.download).not.toHaveBeenCalled()
    expect(test.content()).toBe('archivo anterior')
  })
})

describe('carga validada', () => {
  it('carga una copia del contrato completo sin escribir el archivo', async () => {
    const document = createEmptyDocument('Importado')
    const result = await loadVisibleDocument({ text: async () => JSON.stringify(document) })
    expect(result.status).toBe('loaded')
    if (result.status === 'loaded') expect(result.document).toEqual(document)
  })

  it.each(['{', '{"format":"otro"}', '{"format":"angie-dashboard","formatVersion":2}',
    '{"format":"angie-dashboard","formatVersion":0}'])('rechaza %s sin documento sustituto', async text => {
    const result = await loadVisibleDocument({ text: async () => text })
    expect(result.status).toBe('error')
    expect(result).not.toHaveProperty('document')
    if (result.status === 'error') expect(result.message).not.toBe('')
  })

  it('muestra rutas para un documento incoherente y conserva el archivo original', async () => {
    const document = createEmptyDocument()
    document.board.backgroundColor = 'rojo'
    const text = JSON.stringify(document)
    const result = await loadVisibleDocument({ text: async () => text })
    if (result.status === 'error') expect(result.message).toContain('board.backgroundColor')
    else throw new Error('Debía rechazar el documento')
    expect(JSON.stringify(document)).toBe(text)
  })
})
