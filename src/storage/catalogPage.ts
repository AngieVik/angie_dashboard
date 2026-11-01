import Dexie from 'dexie'
import type { Table } from 'dexie'
import { recoveryDay } from './documentCatalog'
import type { CatalogEntry, RecoveryQuery, RecoveryPage } from './documentCatalog'

export async function catalogPage(table: Table<CatalogEntry, string>, query: RecoveryQuery = {}, accessId?: string): Promise<RecoveryPage> {
  const limit = Math.max(1, Math.min(100, Math.floor(query.limit ?? 10) || 10))
  const search = query.search?.trim().toLocaleLowerCase('es') ?? ''
  const forDocument = accessId === undefined && !!query.documentId
  const partition = forDocument ? query.documentId! : accessId ?? 1
  const upper = query.cursor ? [partition, ...query.cursor] : [partition, Dexie.maxKey, Dexie.maxKey]
  const entries = await table.where(forDocument ? '[documentId+savedAt+key]' : accessId === undefined ? '[listed+savedAt+key]' : '[accessId+savedAt+key]')
    .between([partition, Dexie.minKey, Dexie.minKey], upper, true, !query.cursor).reverse()
    .filter(entry => entry.listed === 1 && (!query.documentId || entry.documentId === query.documentId) && (!query.kind || entry.kind === query.kind) &&
      (!search || entry.titleKey.includes(search)) && (!query.fromDay || recoveryDay(entry.savedAt) >= query.fromDay) &&
      (!query.toDay || recoveryDay(entry.savedAt) <= query.toDay)).limit(limit + 1).toArray()
  const more = entries.length > limit
  if (more) entries.pop()
  const last = entries.at(-1)
  return { entries, ...(more && last ? { nextCursor: [last.savedAt, last.key] as [string, string] } : {}) }
}
