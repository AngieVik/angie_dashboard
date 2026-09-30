import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../domain/document/defaultDocument'
import complete from '../domain/document/fixtures/complete.json'
import { validateDocument } from '../domain/document/validateDocument'
import { createDatabase } from './db'
import { DocumentRepository } from './documentRepository'

const databases: ReturnType<typeof createDatabase>[] = []
afterEach(() => { for (const db of databases.splice(0)) db.close() })
function setup(indexedDB = new IDBFactory()) {
  const db = createDatabase('test-document', { indexedDB, IDBKeyRange })
  databases.push(db)
  return { db, repository: new DocumentRepository(db), indexedDB }
}

describe('repositorio del documento activo', () => {
  it('guarda todo el contrato, recupera al reabrir y conserva un único documento activo', async () => {
    const { db, repository, indexedDB } = setup()
    expect(await repository.loadActive()).toBeNull()
    const validated = validateDocument(complete)
    if (!validated.success) throw new Error('Fixture inválido')
    await repository.saveActive(validated.document)
    db.close()
    const reopened = setup(indexedDB)
    expect(await reopened.repository.loadActive()).toEqual(complete)
    const next = createEmptyDocument('Nuevo')
    await reopened.repository.saveActive(next)
    expect(await reopened.repository.loadActive()).toEqual(next)
    expect(await reopened.db.table('documents').count()).toBe(1)
    await reopened.repository.clearActive()
    expect(await reopened.repository.loadActive()).toBeNull()
  })

  it('rechaza datos inválidos sin sustituir el autoguardado anterior', async () => {
    const { repository } = setup()
    const old = createEmptyDocument('Conservado')
    await repository.saveActive(old)
    const invalid = createEmptyDocument()
    Object.assign(invalid, { backgroundImage: 'ruta' })
    await expect(repository.saveActive(invalid)).rejects.toThrow('backgroundImage')
    expect(await repository.loadActive()).toEqual(old)
  })

  it('valida los datos recuperados sin borrar ni corregir un registro dañado', async () => {
    const { repository, db } = setup()
    await db.table('documents').put({ key: 'active', document: { format: 'otro' } })
    await expect(repository.loadActive()).rejects.toThrow('format')
    expect(await db.table('documents').get('active')).toEqual({ key: 'active', document: { format: 'otro' } })
  })

  it('un fallo de apertura se propaga y permite reintentar sin borrar la base', async () => {
    const indexedDB = new IDBFactory()
    const open = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => { throw new DOMException('bloqueado', 'SecurityError') })
    const remove = vi.spyOn(indexedDB, 'deleteDatabase')
    const { repository } = setup(indexedDB)
    await expect(repository.loadActive()).rejects.toThrow()
    expect(remove).not.toHaveBeenCalled()
    expect(await repository.loadActive()).toBeNull()
    expect(open).toHaveBeenCalledTimes(2)
  })

  it.each(['get', 'put'] as const)('propaga un fallo de %s sin borrar ni recrear la base', async method => {
    const { repository, db, indexedDB } = setup()
    const document = createEmptyDocument('Conservado')
    await repository.saveActive(document)
    const remove = vi.spyOn(indexedDB, 'deleteDatabase')
    vi.spyOn(db.table('documents'), method).mockRejectedValueOnce(new Error('fallo simulado'))
    if (method === 'get') await expect(repository.loadActive()).rejects.toThrow('fallo simulado')
    else await expect(repository.saveActive(createEmptyDocument())).rejects.toThrow('fallo simulado')
    expect(await repository.loadActive()).toEqual(document)
    expect(remove).not.toHaveBeenCalled()
  })
})
