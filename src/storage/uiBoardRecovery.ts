import Dexie from 'dexie'
import type { Table } from 'dexie'
import { validateDocument } from '../domain/document/validateDocument'
import type { UIBoardData } from '../domain/document/types'
import type { SaveFileHandle } from '../platform/files/fileHandleTypes'
import { INPUT_BUDGETS } from '../domain/input/inputBudgets'

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

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function isFileName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= INPUT_BUDGETS.textCharacters && value.trim().length > 0
}

function isFileHandle(value: unknown): value is SaveFileHandle {
  if (!value || typeof value !== 'object') return false
  const handle = value as Partial<SaveFileHandle>
  return (!('kind' in value) || value.kind === 'file')
    && (handle.name === undefined || isFileName(handle.name))
    && typeof handle.getFile === 'function' && typeof handle.createWritable === 'function' && typeof handle.queryPermission === 'function'
    && (handle.requestPermission === undefined || typeof handle.requestPermission === 'function')
    && (handle.isSameEntry === undefined || typeof handle.isSameEntry === 'function')
}

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
    if (record.key !== 'active' || typeof record.token !== 'string' || !record.token || typeof record.fileDirty !== 'boolean' || !isTimestamp(record.savedAt)) {
      throw new Error('No se pudo comprobar la copia local.')
    }
    const fileNameValid = record.fileName === null || isFileName(record.fileName)
    const fileSavedAtValid = record.fileSavedAt === null || isTimestamp(record.fileSavedAt)
    const fingerprintValid = record.fileFingerprint === null || typeof record.fileFingerprint === 'string' && /^[0-9a-f]{64}$/.test(record.fileFingerprint)
    const accessValid = fingerprintValid && (record.fileHandle === undefined || isFileHandle(record.fileHandle) && record.fileFingerprint !== null)
    // Losing the fingerprint must also detach the handle: otherwise the next
    // save could overwrite external changes without a comparison.
    return { data: result.document, savedAt: record.savedAt,
      fileHandle: accessValid ? record.fileHandle : undefined,
      fileFingerprint: accessValid ? record.fileFingerprint : null,
      fileName: fileNameValid ? record.fileName : null,
      fileSavedAt: fileSavedAtValid ? record.fileSavedAt : null,
      fileDirty: record.fileDirty || !fileNameValid || !fileSavedAtValid || !accessValid }
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
