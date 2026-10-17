import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../../domain/document/defaultDocument'
import type { AngieDocument } from '../../domain/document/types'
import { createWorkspaceFiles } from './workspaceFiles'
import type { WorkspaceDirectory, WorkspaceFile } from './workspaceFiles'

// Only the directory API is simulated; naming, lookup and JSON saving use real code.
class MemoryFile implements WorkspaceFile {
  readonly kind = 'file'
  private content = ''

  constructor(readonly name: string) {}

  async queryPermission() { return 'granted' as const }
  async getFile() {
    const snapshot = this.content
    return { text: async () => snapshot }
  }
  async createWritable() {
    let pending = ''
    return {
      write: async (text: string) => { pending = text },
      close: async () => { this.content = pending },
      abort: async () => {},
    }
  }
}

class MemoryDirectory implements WorkspaceDirectory {
  readonly kind = 'directory'
  private children = new Map<string, MemoryDirectory | MemoryFile>()

  constructor(readonly name: string) {}

  async queryPermission() { return 'granted' as const }
  async requestPermission() { return 'granted' as const }
  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MemoryDirectory> {
    const child = this.children.get(name)
    if (child instanceof MemoryDirectory) return child
    if (child) throw new DOMException('No es una carpeta', 'TypeMismatchError')
    if (!options?.create) throw new DOMException('Carpeta ausente', 'NotFoundError')
    const directory = new MemoryDirectory(name)
    this.children.set(name, directory)
    return directory
  }
  async getFileHandle(name: string, options?: { create?: boolean }): Promise<MemoryFile> {
    const child = this.children.get(name)
    if (child instanceof MemoryFile) return child
    if (child) throw new DOMException('No es un archivo', 'TypeMismatchError')
    if (!options?.create) throw new DOMException('Archivo ausente', 'NotFoundError')
    const file = new MemoryFile(name)
    this.children.set(name, file)
    return file
  }
  async *entries(): AsyncIterableIterator<[string, MemoryDirectory | MemoryFile]> {
    yield* this.children.entries()
  }
  async removeEntry(name: string) {
    if (!this.children.delete(name)) throw new DOMException('Entrada ausente', 'NotFoundError')
  }
}

const start = new Date(2026, 9, 17, 9, 30, 0)

function documentWithTitle(title: string) {
  const document = createEmptyDocument(title)
  document.document = { ...document.document, createdAt: start.toISOString(), updatedAt: start.toISOString() }
  return document
}

function workspace(handle: WorkspaceDirectory) {
  return createWorkspaceFiles(async () => ({ handle, accessId: 'test-directory' }), () => start)
}

async function entryNames(directory: WorkspaceDirectory) {
  const names: string[] = []
  for await (const [name] of directory.entries()) names.push(name)
  return names.sort()
}

async function dashboardText(root: WorkspaceDirectory, name: string) {
  const folder = await root.getDirectoryHandle(name)
  return (await (await folder.getFileHandle('dashboard.json')).getFile()).text()
}

describe('guardado por carpetas de dashboards', () => {
  it('crea la raíz angie_dashboard y la reutiliza si se selecciona directamente', async () => {
    for (const selectedName of ['Documentos', 'angie_dashboard']) {
      const selected = new MemoryDirectory(selectedName)
      const document = documentWithTitle('')

      expect(await workspace(selected).save(document)).toMatchObject({
        status: 'saved', path: 'angie_dashboard/autosave_2026-10-17_09-30-00/dashboard.json',
      })

      const root = selectedName === 'Documentos' ? await selected.getDirectoryHandle('angie_dashboard') : selected
      if (selectedName === 'Documentos') expect(await entryNames(selected)).toEqual(['angie_dashboard'])
      expect(await entryNames(root)).toEqual(['autosave_2026-10-17_09-30-00'])
      expect(JSON.parse(await dashboardText(root, 'autosave_2026-10-17_09-30-00'))).toEqual(document)
    }
  })

  it('separa los dashboards y actualizar uno conserva el contenido del otro', async () => {
    const root = new MemoryDirectory('angie_dashboard')
    const files = workspace(root)
    const first = documentWithTitle('Dashboard A')
    const second = documentWithTitle('Dashboard B')
    expect((await files.save(first)).status).toBe('saved')
    expect((await files.save(second)).status).toBe('saved')
    const secondText = await dashboardText(root, 'Dashboard B')

    first.board.backgroundColor = '#111111'
    first.document.updatedAt = new Date(start.getTime() + 1000).toISOString()
    expect((await files.save(first)).status).toBe('saved')

    expect(await entryNames(root)).toEqual(['Dashboard A', 'Dashboard B'])
    expect(JSON.parse(await dashboardText(root, 'Dashboard A'))).toEqual(first)
    expect(await dashboardText(root, 'Dashboard B')).toBe(secondText)
    expect(JSON.parse(secondText)).toEqual(second)
  })

  it('los nombres repetidos crean carpetas distintas sin sobrescribir el primer dashboard', async () => {
    const root = new MemoryDirectory('angie_dashboard')
    const files = workspace(root)
    const first = documentWithTitle('Operativo')
    const second = documentWithTitle('Operativo')
    second.document = { ...second.document, id: '12345678-1234-4123-8123-123456789abc' }
    expect((await files.save(first)).status).toBe('saved')
    const firstText = await dashboardText(root, 'Operativo')

    expect(await files.save(second)).toMatchObject({
      status: 'saved', path: 'angie_dashboard/Operativo_12345678/dashboard.json',
    })

    expect(await entryNames(root)).toEqual(['Operativo', 'Operativo_12345678'])
    expect(await dashboardText(root, 'Operativo')).toBe(firstText)
    expect(JSON.parse(firstText)).toEqual(first)
    expect(JSON.parse(await dashboardText(root, 'Operativo_12345678'))).toEqual(second)
  })

  it('reabrir por ID reutiliza la carpeta existente aunque cambie el título', async () => {
    const root = new MemoryDirectory('angie_dashboard')
    const original = documentWithTitle('Nombre inicial')
    expect((await workspace(root).save(original)).status).toBe('saved')
    const reopened = JSON.parse(await dashboardText(root, 'Nombre inicial')) as AngieDocument
    reopened.document.title = 'Nuevo nombre'
    reopened.document.updatedAt = new Date(start.getTime() + 1000).toISOString()

    // A fresh writer has no cached location, as after reopening the application.
    expect(await workspace(root).save(reopened)).toMatchObject({
      status: 'saved', path: 'angie_dashboard/Nombre inicial/dashboard.json',
    })

    expect(await entryNames(root)).toEqual(['Nombre inicial'])
    expect(JSON.parse(await dashboardText(root, 'Nombre inicial'))).toEqual(reopened)
  })
})
