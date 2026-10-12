import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { createDatabase } from './db'
import { DocumentRepository } from './documentRepository'
import { createEmptyDocument } from '../domain/document/defaultDocument'
const databases: ReturnType<typeof createDatabase>[] = []
afterEach(() => { for (const db of databases.splice(0)) db.close() })
function setup(factory = new IDBFactory()) {
  const db = createDatabase('recovery', { indexedDB: factory, IDBKeyRange })
  databases.push(db)
  return { db, factory, repository: new DocumentRepository(db) }
}
describe('recuperación local protegida', () => {
  it('recupera los módulos abiertos junto al documento sin exportarlos al JSON', async () => {
    const { repository, factory } = setup()
    await repository.loadActive()
    await repository.saveActive(createEmptyDocument('Servicio'), { openModules: ['board', 'information'] })
    const reopened = setup(factory).repository
    const document = await reopened.loadActive()
    expect(document?.document.title).toBe('Servicio')
    expect(await reopened.loadActiveSession()).toEqual({ openModules: ['board', 'information'] })
    expect(document).not.toHaveProperty('openModules')
  })
  it('conserva cinco documentos desplazados y puede recuperar uno con su sesión', async () => {
    const { repository } = setup()
    await repository.loadActive()
    await repository.saveActive(createEmptyDocument('Documento 0'), { openModules: ['board'] })
    for (let i = 1; i <= 7; i++) await repository.replaceActive(createEmptyDocument('Documento ' + i), { openModules: ['notebook'] })
    const archives = await repository.listRecoverable()
    expect(archives.filter(item => item.key.startsWith('archive:')).map(item => item.title)).toEqual(['Documento 6', 'Documento 5', 'Documento 4', 'Documento 3', 'Documento 2'])
    const recovered = await repository.loadRecoverable(archives.find(item => item.title === 'Documento 4')!.key)
    expect(recovered?.document.document.title).toBe('Documento 4')
    expect(recovered?.session.openModules).toEqual(['notebook'])
  })
  it('recupera la copia anterior válida y conserva el registro dañado', async () => {
    const { repository, db, factory } = setup()
    await repository.loadActive()
    await repository.saveActive(createEmptyDocument('Anterior'), { openModules: ['timeline'] })
    await repository.saveActive(createEmptyDocument('Actual'), { openModules: ['board'] })
    const current = await db.table('documents').get('active')
    await db.table('documents').put({ ...current, document: { format: 'roto' } })
    const reopened = setup(factory).repository
    expect((await reopened.loadActive())?.document.title).toBe('Anterior')
    expect(await reopened.loadActiveSession()).toEqual({ openModules: ['timeline'] })
    expect(reopened.recoverySource).toBe('previous')
    expect((await db.table('documents').get('active')).document).toEqual({ format: 'roto' })
  })
  it('rechaza la escritura de otra pestaña sin sobrescribir el documento más reciente', async () => {
    const { repository, factory } = setup()
    await repository.loadActive()
    await repository.saveActive(createEmptyDocument('Inicial'))
    const second = setup(factory).repository
    await second.loadActive()
    await repository.saveActive(createEmptyDocument('Primera pestaña'))
    await expect(second.saveActive(createEmptyDocument('Pestaña atrasada'))).rejects.toThrow('otra pestaña')
    expect((await setup(factory).repository.loadActive())?.document.title).toBe('Primera pestaña')
  })
  it('aborta la sustitución si falla la copia de seguridad y mantiene el activo', async () => {
    const { repository, db } = setup()
    await repository.loadActive()
    await repository.saveActive(createEmptyDocument('Conservar'))
    db.table('documents').hook('creating', (_key, value) => { if (value.key.startsWith('archive:')) throw new Error('cuota') })
    await expect(repository.replaceActive(createEmptyDocument('Nuevo'))).rejects.toThrow('cuota')
    expect((await repository.loadActive())?.document.title).toBe('Conservar')
  })
})
