import Dexie from 'dexie'
import type { Table } from 'dexie'
import { validateDocument } from '../domain/document/validateDocument'
import type { UIBoardData } from '../domain/document/types'
import type { SaveFileHandle } from '../platform/files/fileHandleTypes'

export interface RecoverySnapshot {
  data: UIBoardData
  savedAt: string
  fileHandle?: SaveFileHandle
  fileFingerprint: string | null
  fileName: string | null
  fileSavedAt: string | null
  fileDirty: boolean
}
interface RecoveryRecord extends RecoverySnapshot { key: 'active'; token: string }

export class RecoveryConflictError extends Error {
  constructor() { super('Otra pestaña ha actualizado la copia local. Guarda tus datos en un archivo antes de recargar.'); this.name = 'RecoveryConflictError' }
}

export interface UIBoardRecovery {
  load(): Promise<RecoverySnapshot | null>
  save(snapshot: RecoverySnapshot): Promise<void>
  clear(): Promise<void>
}

/** One slot, overwritten transactionally. Old test databases are never opened. */
export class UIBoardRecoveryRepository implements UIBoardRecovery {
  private readonly db: Dexie
  private readonly table: Table<RecoveryRecord, string>
  private expectedToken: string | null = null

  constructor(name = 'angie-uiboard') {
    this.db = new Dexie(name)
    this.db.version(1).stores({ recovery: 'key' })
    this.table = this.db.table<RecoveryRecord, string>('recovery')
  }

  async load(): Promise<RecoverySnapshot | null> {
    const record = await this.table.get('active')
    this.expectedToken = record?.token ?? null
    if (!record) return null
    const result = validateDocument(record.data)
    if (!result.success) throw new Error('La copia local no contiene datos válidos de UIBoard.')
    if (typeof record.token !== 'string' || typeof record.fileDirty !== 'boolean' || !Number.isFinite(Date.parse(record.savedAt))) {
      throw new Error('No se pudo comprobar la copia local.')
    }
    return { data: result.document, savedAt: record.savedAt, fileHandle: record.fileHandle,
      fileFingerprint: record.fileFingerprint, fileName: record.fileName, fileSavedAt: record.fileSavedAt, fileDirty: record.fileDirty }
  }

  async save(snapshot: RecoverySnapshot): Promise<void> {
    const token = crypto.randomUUID()
    await this.db.transaction('rw', this.table, async () => {
      const previous = await this.table.get('active')
      if ((previous?.token ?? null) !== this.expectedToken) throw new RecoveryConflictError()
      await this.table.put({ ...snapshot, key: 'active', token })
    })
    this.expectedToken = token
  }

  async clear(): Promise<void> {
    await this.db.transaction('rw', this.table, async () => {
      const previous = await this.table.get('active')
      // Closing this tab must leave another tab's recovery untouched.
      if ((previous?.token ?? null) !== this.expectedToken) return
      await this.table.delete('active')
    })
    this.expectedToken = null
  }
}
