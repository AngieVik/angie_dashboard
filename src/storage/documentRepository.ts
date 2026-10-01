import type Dexie from 'dexie'
import { migrateDocument } from '../domain/document/migrateDocument'
import { serializeDocument } from '../domain/document/serializeDocument'
import type { AngieDocument } from '../domain/document/types'
import { createDatabase } from './db'

export interface ActiveDocumentRepository {
  loadActive(): Promise<AngieDocument | null>
  saveActive(document: AngieDocument): Promise<void>
  clearActive(): Promise<void>
}

export class DocumentRepository implements ActiveDocumentRepository {
  constructor(private readonly db: Dexie = createDatabase()) {}

  private async open() {
    if (!this.db.isOpen()) await this.db.open()
  }

  async loadActive(): Promise<AngieDocument | null> {
    await this.open()
    const record = await this.db.table<{ key: string; document: unknown }, string>('documents').get('active')
    if (!record) return null
    const result = migrateDocument(record.document)
    if (!result.success) throw new Error(result.errors.map(error => error.message).join('\n'))
    return result.document
  }

  async saveActive(document: AngieDocument): Promise<void> {
    // Validate and detach before any asynchronous browser operation.
    const copy: AngieDocument = JSON.parse(serializeDocument(document))
    await this.open()
    await this.db.table('documents').put({ key: 'active', document: copy })
  }

  async clearActive(): Promise<void> {
    await this.open()
    await this.db.table('documents').delete('active')
  }
}
