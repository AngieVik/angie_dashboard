import Dexie from 'dexie'
import type { DexieOptions } from 'dexie'
import { indexLegacyDocuments } from './documentCatalog'

export function createDatabase(name = 'angie-dashboard', options?: DexieOptions): Dexie {
  const db = new Dexie(name, options)
  db.version(1).stores({ documents: 'key' })
  db.version(2).stores({ documents: 'key', imageResources: 'id' })
  db.version(3).stores({ documents: 'key', imageResources: 'id', gpxResources: 'fingerprint' })
  db.version(4).stores({ documentCatalog: 'key,documentId,kind,titleKey,*resourceIds,[listed+savedAt+key],[documentId+kind],[documentId+savedAt+key]',
    workspaceCatalog: 'id,accessId,[accessId+savedAt+key]' }).upgrade(indexLegacyDocuments)
  return db
}
