import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorizeWorkDirectory, chooseWorkDirectory, readPersistentStorage, readWorkDirectory, requestPersistentStorage } from './pwaPermissions'
import { readWorkDirectoryAccess, rememberWorkDirectoryAccess } from '../storage/workDirectoryAccessRepository'
import type { WorkDirectoryHandle } from '../storage/workDirectoryAccessRepository'

vi.mock('../storage/workDirectoryAccessRepository', () => ({
  readWorkDirectoryAccess: vi.fn(), rememberWorkDirectoryAccess: vi.fn(),
}))

function directory(permission: PermissionState = 'granted'): WorkDirectoryHandle {
  return {
    name: 'angie_dashboard',
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => 'granted' as const),
  }
}

function support(pick = vi.fn(async () => directory())) {
  vi.stubGlobal('showDirectoryPicker', pick)
  return pick
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetAllMocks() })

describe('permisos PWA', () => {
  it('consulta y solicita almacenamiento sin afirmar una concesión rechazada', async () => {
    const persist = vi.fn(async () => false)
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist } })
    expect((await readPersistentStorage()).status).toBe('pending')
    expect((await requestPersistentStorage()).status).toBe('pending')
    expect(persist).toHaveBeenCalledOnce()
    persist.mockResolvedValueOnce(true)
    expect((await requestPersistentStorage()).status).toBe('granted')
  })

  it('señala navegadores sin soporte sin solicitar permisos ni leer carpetas', async () => {
    vi.stubGlobal('showDirectoryPicker', undefined)
    vi.stubGlobal('navigator', { storage: undefined })
    expect((await readPersistentStorage()).status).toBe('unavailable')
    expect((await requestPersistentStorage()).status).toBe('unavailable')
    expect((await readWorkDirectory()).status).toBe('unavailable')
    expect(readWorkDirectoryAccess).not.toHaveBeenCalled()
  })

  it('recupera la carpeta guardada sin pedir permiso al abrir el panel', async () => {
    support()
    const handle = directory('prompt')
    vi.mocked(readWorkDirectoryAccess).mockResolvedValueOnce(handle)
    const current = await readWorkDirectory()
    expect(current).toMatchObject({ handle, status: 'pending' })
    expect(handle.requestPermission).not.toHaveBeenCalled()
    expect(await authorizeWorkDirectory(current)).toMatchObject({ handle, status: 'granted' })
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
    expect(rememberWorkDirectoryAccess).toHaveBeenCalledWith(handle)
  })

  it('solicita el selector desde la acción y recuerda la carpeta autorizada', async () => {
    const handle = directory()
    const pick = support(vi.fn(async () => handle))
    const operation = chooseWorkDirectory({ handle: null, status: 'pending' })
    expect(pick).toHaveBeenCalledWith(expect.objectContaining({ mode: 'readwrite' }))
    expect(await operation).toMatchObject({ handle, status: 'granted' })
    expect(rememberWorkDirectoryAccess).toHaveBeenCalledWith(handle)
  })

  it('cancelar o denegar la selección conserva la carpeta anterior', async () => {
    const previous = { handle: directory(), status: 'granted' as const }
    const pick = support(vi.fn().mockRejectedValueOnce(new DOMException('Cancelado', 'AbortError')))
    expect(await chooseWorkDirectory(previous)).toEqual(previous)
    pick.mockResolvedValueOnce(directory('denied'))
    expect(await chooseWorkDirectory(previous)).toMatchObject(previous)
    expect(rememberWorkDirectoryAccess).not.toHaveBeenCalled()
  })

  it('muestra la denegación al renovar sin borrar la carpeta recordada', async () => {
    const handle = directory('prompt')
    vi.mocked(handle.requestPermission).mockResolvedValueOnce('denied')
    expect(await authorizeWorkDirectory({ handle, status: 'pending' })).toMatchObject({ handle, status: 'denied' })
    expect(rememberWorkDirectoryAccess).not.toHaveBeenCalled()
  })

  it('distingue autorización temporal de un fallo al recordar la carpeta', async () => {
    const handle = directory()
    support(vi.fn(async () => handle))
    vi.mocked(rememberWorkDirectoryAccess).mockRejectedValueOnce(new Error('DB'))
    expect(await chooseWorkDirectory({ handle: null, status: 'pending' })).toMatchObject({
      handle, status: 'granted', message: expect.stringContaining('No se pudo recordar'),
    })
  })
})
