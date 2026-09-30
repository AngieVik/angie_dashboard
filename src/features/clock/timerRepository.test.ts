import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTimerDatabase, TimerRepository } from './timerRepository'
import { createTimer, startTimer, calculateTimerValue } from './timerEngine'
import { DocumentRepository } from '../../storage/documentRepository'
import { createDatabase } from '../../storage/db'
import { createEmptyDocument } from '../../domain/document/defaultDocument'

const databases: ReturnType<typeof createTimerDatabase>[] = []
afterEach(() => { databases.splice(0).forEach(db => db.close()) })
function setup(indexedDB = new IDBFactory()) {
  const db = createTimerDatabase('test-timers', { indexedDB, IDBKeyRange }); databases.push(db)
  return { db, indexedDB, repository: new TimerRepository(db) }
}
describe('recuperación interna independiente', () => {
  it('reabre notas/estados/marcas de tiempo; cierre elimina solo el temporizador elegido', async () => {
    const { repository, db, indexedDB } = setup()
    const a = { ...startTimer(createTimer('tminus', 10), 1000), note: 'Radio' }, b = createTimer('tzero')
    await repository.saveTimers([a, b]); db.close()
    const reopened = setup(indexedDB)
    const recovered = await reopened.repository.loadTimers()
    expect(recovered).toEqual([a, b])
    expect(calculateTimerValue(recovered[0]!, 20_000)).toMatchObject({ status: 'completed', alertActive: true })
    await reopened.repository.saveTimers([b])
    expect(await reopened.repository.loadTimers()).toEqual([b])
  })
  it('el repositorio del documento no modifica la base de temporizadores', async () => {
    const { repository, indexedDB } = setup()
    const timers = [startTimer(createTimer('advisory', 20), 1000)]
    await repository.saveTimers(timers)
    const docDb = createDatabase('test-documents', { indexedDB, IDBKeyRange }); databases.push(docDb)
    const documents = new DocumentRepository(docDb)
    await documents.saveActive(createEmptyDocument()); await documents.clearActive()
    expect(await repository.loadTimers()).toEqual(timers)
  })
  it('rechaza un registro dañado conservando el original', async () => {
    const { repository, db } = setup()
    await db.table('timers').put({ key: 'active', timers: [{ kind: 'otro' }] })
    await expect(repository.loadTimers()).rejects.toThrow()
    expect((await db.table('timers').get('active')).timers).toEqual([{ kind: 'otro' }])
  })
  it.each(['get', 'put'] as const)('propaga fallo de %s sin borrar la base y permite reintento', async method => {
    const { repository, db, indexedDB } = setup(), timers = [createTimer('tzero')]
    await repository.saveTimers(timers)
    const remove = vi.spyOn(indexedDB, 'deleteDatabase')
    vi.spyOn(db.table('timers'), method).mockRejectedValueOnce(new Error('fallo'))
    if (method === 'get') await expect(repository.loadTimers()).rejects.toThrow('fallo')
    else await expect(repository.saveTimers([])).rejects.toThrow('fallo')
    expect(await repository.loadTimers()).toEqual(timers); expect(remove).not.toHaveBeenCalled()
  })
})
