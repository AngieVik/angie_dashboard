import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadBoardImage } from './imageLoader'

afterEach(() => vi.unstubAllGlobals())

function bitmap(width: number, height: number) {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap
}

describe('imagen local temporal', () => {
  it('rechaza más de 50 MiB antes de intentar decodificar', async () => {
    const decode = vi.fn(); vi.stubGlobal('createImageBitmap', decode)
    const file = new File([], 'grande.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 + 1 })
    const result = await loadBoardImage(file)
    expect(result).toEqual({ success: false, message: 'La imagen supera el límite de 50 MiB.' })
    expect(decode).not.toHaveBeenCalled()
  })

  it('acepta exactamente 50 MiB y no reduce una imagen de 4096 px', async () => {
    const source = bitmap(4096, 2048)
    const decode = vi.fn().mockResolvedValue(source); vi.stubGlobal('createImageBitmap', decode)
    const file = new File([], 'limite.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 })
    const result = await loadBoardImage(file)
    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.message)
    expect(result.image).toBe(source)
    expect(decode).toHaveBeenCalledTimes(1)
    result.dispose(); expect(source.close).toHaveBeenCalledOnce()
  })

  it.each([[8000, 4000, 4096, 2048], [3000, 6000, 2048, 4096]])('reduce %s × %s en memoria con proporción y alta calidad', async (width, height, targetWidth, targetHeight) => {
    const source = bitmap(width, height), reduced = bitmap(targetWidth, targetHeight)
    const decode = vi.fn().mockResolvedValueOnce(source).mockResolvedValueOnce(reduced)
    vi.stubGlobal('createImageBitmap', decode)
    const file = new File(['local'], 'mapa.png', { type: 'image/png' })
    const result = await loadBoardImage(file)
    expect(result.success).toBe(true)
    expect(decode).toHaveBeenLastCalledWith(source, { resizeWidth: targetWidth, resizeHeight: targetHeight, resizeQuality: 'high' })
    expect(source.close).toHaveBeenCalledOnce()
    if (!result.success) throw new Error(result.message)
    expect(result.width).toBe(targetWidth); expect(result.height).toBe(targetHeight)
    result.dispose(); expect(reduced.close).toHaveBeenCalledOnce()
  })

  it('un fallo de proceso devuelve un error y libera el bitmap intermedio', async () => {
    const source = bitmap(6000, 3000)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValueOnce(source).mockRejectedValueOnce(new Error('memoria')))
    expect(await loadBoardImage(new File(['local'], 'mapa.png', { type: 'image/png' }))).toEqual({
      success: false, message: 'No se pudo decodificar o procesar la imagen. Se conserva el fondo anterior.',
    })
    expect(source.close).toHaveBeenCalledOnce()
  })

  it('rechaza formatos distintos de JPG/PNG y comunica un archivo no decodificable', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('dañado')))
    expect((await loadBoardImage(new File(['local'], 'imagen.svg', { type: 'image/svg+xml' }))).success).toBe(false)
    expect((await loadBoardImage(new File(['dañado'], 'imagen.png', { type: 'image/png' }))).success).toBe(false)
  })
})
