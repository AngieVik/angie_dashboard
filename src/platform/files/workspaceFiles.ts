import { migrateDocument } from '../../domain/document/migrateDocument'
import { serializeDocument } from '../../domain/document/serializeDocument'
import type { AngieDocument, MapGpxReference } from '../../domain/document/types'
import { readGpxAccess } from '../../storage/gpxAccessRepository'
import { readWorkDirectoryConfiguration, readWorkspaceBaseline, rememberWorkspaceBaseline } from '../../storage/workDirectoryAccessRepository'
import type { WorkDirectoryHandle } from '../../storage/workDirectoryAccessRepository'
import type { SaveFileHandle } from './fileAccess'
import { workspaceNameError } from './workspaceNames'
import type { LocalDocument, RecoverableDocument } from '../../storage/documentRepository'
import { directoryErrorMessage } from '../pwaPermissions'

export interface WorkspaceFile extends SaveFileHandle {
  readonly kind: 'file'
  readonly name: string
  getFile(): Promise<{ text(): Promise<string>; arrayBuffer?(): Promise<ArrayBuffer>; size?: number; lastModified?: number }>
  createWritable(): Promise<{
    write(data: string | ArrayBuffer): Promise<void>
    close(): Promise<void>
    abort(): Promise<void>
  }>
}
export interface WorkspaceDirectory extends WorkDirectoryHandle {
  readonly kind: 'directory'
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<WorkspaceDirectory>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<WorkspaceFile>
  entries(): AsyncIterableIterator<[string, WorkspaceDirectory | WorkspaceFile]>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
}
export interface WorkspaceRoot { handle: WorkspaceDirectory; accessId: string; isContainer?: boolean }
export type WorkspaceSaveResult =
  | { status: 'unconfigured' }
  | { status: 'saved'; path: string; savedAt: string; message?: string; resourcesPending?: boolean }
  | { status: 'error'; message: string; permissionRequired?: boolean; path?: string }
export interface WorkspaceFiles {
  save(document: AngieDocument): Promise<WorkspaceSaveResult>
  readGpx?(document: AngieDocument, reference: MapGpxReference): Promise<File | null>
  saveReport?(document: AngieDocument, report: { filename: string; html: string }): Promise<WorkspaceSaveResult>
  availableName?(name: string, id?: string): Promise<string>
  create?(document: AngieDocument, source?: AngieDocument, sourceFolder?: string, sourceAccessId?: string, sourceVersion?: string, localRecovery?: boolean): Promise<WorkspaceSaveResult>
  rename?(document: AngieDocument, title: string, updatedAt?: string): Promise<WorkspaceSaveResult>
  listRecoverable?(): Promise<RecoverableDocument[]>
  loadRecoverable?(key: string): Promise<LocalDocument | null>
}

const backupInterval = 5 * 60 * 1000
const backupPattern = /^dashboard_(\d{13})_[0-9a-f-]{36}\.json$/
const backupFolderPattern = /^dashboard_(\d{13})_[0-9a-f-]{36}$/
const versionManifestName = '.angie-version.json'

function gpxFilename(reference: MapGpxReference) {
  const stem = [...reference.name.replace(/\.gpx$/i, '')].filter(character => {
    const code = character.charCodeAt(0)
    return code > 31 && !(code >= 127 && code <= 159) && !'<>:"/\\|?*'.includes(character)
  }).join('').replace(/[ .]+$/, '').slice(0, 100) || 'recorrido'
  return `${stem}_${reference.fingerprint}.gpx`
}

async function gpxBytes(file: Awaited<ReturnType<WorkspaceFile['getFile']>>, reference: MapGpxReference) {
  if (!file.arrayBuffer || (file.size !== undefined && file.size > 10 * 1024 * 1024)) throw new Error('No se pudo leer el archivo GPX dentro del límite de 10 MB.')
  const bytes = await file.arrayBuffer()
  if (bytes.byteLength > 10 * 1024 * 1024 || bytes.byteLength !== reference.size) throw new Error('El tamaño no coincide con el GPX guardado.')
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const fingerprint = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('')
  if (fingerprint !== reference.fingerprint) throw new Error('El contenido no coincide con el GPX guardado. Se conserva sin sobrescribir.')
  return bytes
}

function isMissing(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'NotFoundError'
}

export function workspaceFolderName(document: AngieDocument): string {
  let name = [...document.document.title.trim()].filter(character => {
    const code = character.charCodeAt(0)
    return code > 31 && !(code >= 127 && code <= 159) && !'<>:"/\\|?*'.includes(character)
  }).join('').replace(/[ .]+$/, '').slice(0, 100).replace(/[ .]+$/, '')
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) name = ''
  if (name) return name
  const date = new Date(document.document.createdAt)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `autosave_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

async function readDashboard(folder: WorkspaceDirectory): Promise<{ text: string; document: AngieDocument } | null> {
  let text: string
  try { text = await (await (await folder.getFileHandle('dashboard.json')).getFile()).text() }
  catch (error) { if (isMissing(error)) return null; throw error }
  try {
    const result = migrateDocument(JSON.parse(text))
    return result.success ? { text, document: result.document } : null
  } catch { return null }
}

async function writeText(folder: WorkspaceDirectory, name: string, text: string) {
  const file = await folder.getFileHandle(name, { create: true })
  const stream = await file.createWritable()
  try { await stream.write(text); await stream.close() }
  catch (error) { try { await stream.abort() } catch { /* Keep the original error. */ } throw error }
}

export function createWorkspaceFiles(
  getRoot: () => Promise<WorkspaceRoot | null>,
  now: () => Date = () => new Date(),
): WorkspaceFiles {
  const locations = new Map<string, WorkspaceDirectory>()
  const expectedContents = new Map<string, string>()
  const created = new Set<string>()
  const verifiedGpx = new Map<string, { size: number; lastModified: number }>()
  const createdGpx = new Set<string>()
  let writing: Promise<void> = Promise.resolve()

  async function rootDirectory() {
    const selected = await getRoot()
    if (!selected) return null
    if (await selected.handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      throw new DOMException('Autoriza el acceso desde Archivo → Carpeta de trabajo.', 'NotAllowedError')
    }
    const root = !selected.isContainer && selected.handle.name.toLowerCase() === 'angie_dashboard'
      ? selected.handle : await selected.handle.getDirectoryHandle('angie_dashboard', { create: true })
    return { ...selected, root }
  }

  async function transferState(folder: WorkspaceDirectory): Promise<{ source: string; id: string; ready: boolean } | null> {
    try {
      const value: unknown = JSON.parse(await (await (await folder.getFileHandle('.angie-transfer.json')).getFile()).text())
      if (value && typeof value === 'object' && 'source' in value && typeof value.source === 'string' &&
        'id' in value && typeof value.id === 'string' && 'ready' in value && typeof value.ready === 'boolean') return { source: value.source, id: value.id, ready: value.ready }
    } catch { /* Ordinary folders have no transfer journal. */ }
    return null
  }

  async function locate(root: WorkspaceDirectory, document: AngieDocument, accessId: string, create = true) {
    const key = accessId + ':' + document.document.id
    const cached = locations.get(key)
    if (cached) {
      try {
        // Resolve against the configured root; a remembered handle may have been deleted or moved.
        const folder = await root.getDirectoryHandle(cached.name)
        locations.set(key, folder)
        const saved = await readDashboard(folder)
        if (saved?.document.document.id === document.document.id) return folder
        if (!saved) {
          try {
            const text = await (await (await folder.getFileHandle('dashboard.json')).getFile()).text()
            if (created.has(key) && text === '') return folder
            throw new Error('El dashboard de destino no es válido. Se conserva sin sobrescribir.')
          } catch (error) {
            if (!isMissing(error)) throw error
            return folder
          }
        }
        throw new Error('La carpeta de destino pertenece a otro dashboard. Se conserva sin sobrescribir.')
      } catch (error) { if (!isMissing(error)) throw error; locations.delete(key) }
    }
    const names = new Set<string>()
    let found: WorkspaceDirectory | undefined
    for await (const [name, entry] of root.entries()) {
      names.add(name.toLowerCase())
      if (entry.kind !== 'directory') continue
      const transfer = await transferState(entry)
      if (transfer && !transfer.ready) continue
      const saved = await readDashboard(entry)
      if (saved?.document.document.id !== document.document.id) continue
      if (found) {
        const previousTransfer = await transferState(found)
        if (transfer?.id === document.document.id && transfer.source === found.name) { found = entry; continue }
        if (previousTransfer?.id === document.document.id && previousTransfer.source === entry.name) continue
        throw new Error('Hay varias carpetas con el mismo identificador. Abre la versión que deseas recuperar en rama.')
      }
      found = entry
    }
    if (!found) {
      if (!create) return null
      const base = workspaceFolderName(document)
      const name = base
      if (names.has(name.toLowerCase())) throw new Error('Ya existe una carpeta con ese nombre. Utiliza Guardar como con otro nombre.')
      found = await root.getDirectoryHandle(name, { create: true })
      // Never claim a folder containing an unrelated file, including a damaged JSON.
      if (!(await found.entries().next()).done) throw new Error('La carpeta de destino ya contiene archivos. Vuelve a guardar para elegir un destino libre.')
      created.add(key)
    }
    locations.set(key, found)
    return found
  }

  async function availableName(requested: string, id?: string) {
    if (!requested.trim()) requested = ''
    const error = workspaceNameError(requested)
    if (error) throw new Error(error)
    const selected = await rootDirectory()
    const names = new Set<string>()
    if (selected) for await (const [name, entry] of selected.root.entries()) {
      if (entry.kind === 'directory' && id && ((await readDashboard(entry))?.document.document.id === id || (await transferState(entry))?.id === id)) continue
      names.add(name.toLowerCase())
    }
    if (requested) {
      if (names.has(requested.toLowerCase())) throw new Error('Ya existe una carpeta con ese nombre. Elige otro.')
      return requested
    }
    let number = 1
    while (names.has(`uiboard_noname${number}`)) number++
    return `UIBoard_noname${number}`
  }

  async function fileBytes(file: WorkspaceFile) {
    const snapshot = await file.getFile()
    return snapshot.arrayBuffer ? snapshot.arrayBuffer() : new TextEncoder().encode(await snapshot.text()).buffer as ArrayBuffer
  }
  async function digest(bytes: ArrayBuffer) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
  }
  async function directoryManifest(folder: WorkspaceDirectory, prefix = ''): Promise<string[]> {
    const result: string[] = []
    for await (const [name, entry] of folder.entries()) {
      if (!prefix && name === '.angie-transfer.json') continue
      const path = prefix + name
      if (entry.kind === 'directory') { result.push(path + '/'); result.push(...await directoryManifest(entry, path + '/')) }
      else result.push(path + ':' + await digest(await fileBytes(entry)))
    }
    return result.sort()
  }
  async function readVersion(folder: WorkspaceDirectory, verifyResources = false) {
    const saved = await readDashboard(folder)
    if (!saved) return null
    const manifest: unknown = JSON.parse(await (await (await folder.getFileHandle(versionManifestName)).getFile()).text())
    if (!manifest || typeof manifest !== 'object' || !('documentId' in manifest) || manifest.documentId !== saved.document.document.id ||
      !('ready' in manifest) || manifest.ready !== true || !('files' in manifest) || !Array.isArray(manifest.files) ||
      !manifest.files.every(file => typeof file === 'string')) throw new Error('La copia de seguridad está incompleta.')
    if (verifyResources) {
      const files = (await directoryManifest(folder)).filter(path => !path.startsWith(versionManifestName + ':'))
      if (JSON.stringify(files) !== JSON.stringify(manifest.files)) throw new Error('Los archivos de la copia de seguridad cambiaron o están incompletos.')
    }
    return saved
  }
  async function copyDirectory(source: WorkspaceDirectory, target: WorkspaceDirectory, projectOnly = false, rootLevel = true) {
    for await (const [name, entry] of source.entries()) {
      if ((rootLevel && name === '.angie-transfer.json') || (projectOnly && (name === 'dashboard.json' || name === 'copias' || name === versionManifestName))) continue
      if (entry.kind === 'directory') await copyDirectory(entry, await target.getDirectoryHandle(name, { create: true }), false, false)
      else {
        const bytes = await fileBytes(entry)
        const destination = await target.getFileHandle(name, { create: true })
        const stream = await destination.createWritable()
        try { await stream.write(bytes); await stream.close() }
        catch (error) { try { await stream.abort() } catch { /* Preserve the failure. */ } throw error }
        if (await digest(bytes) !== await digest(await fileBytes(destination))) throw new Error('No se pudo verificar la copia de ' + name + '. Se conserva el original.')
      }
    }
  }

  async function removeVerifiedSource(folder: WorkspaceDirectory, expected: Map<string, string>, id: string, prefix = '') {
    const entries: [string, WorkspaceDirectory | WorkspaceFile][] = []
    for await (const entry of folder.entries()) entries.push(entry)
    for (const [name, entry] of entries) {
      if (!prefix && name === '.angie-transfer.json') {
        if ((await transferState(folder))?.id !== id) throw new Error('La carpeta original contiene un archivo de control distinto.')
        await folder.removeEntry(name)
      } else if (entry.kind === 'directory') {
        if (!expected.has(prefix + name + '/')) throw new Error('La carpeta original contiene una subcarpeta nueva. Se conserva sin retirar.')
        await removeVerifiedSource(entry, expected, id, prefix + name + '/')
        await folder.removeEntry(name)
      } else {
        if (expected.get(prefix + name) !== await digest(await fileBytes(entry))) throw new Error('La carpeta original cambió. Se conserva su contenido pendiente.')
        await folder.removeEntry(name)
      }
    }
  }

  async function create(document: AngieDocument, source?: AngieDocument, sourceFolder?: string, sourceAccessId?: string, sourceVersion?: string, localRecovery = false): Promise<WorkspaceSaveResult> {
    const selected = await rootDirectory()
    if (!selected) return { status: 'unconfigured' }
    if (sourceAccessId && sourceAccessId !== selected.accessId) throw new Error('La carpeta de trabajo cambió. Vuelve a seleccionar la recuperación en la ubicación correspondiente.')
    await availableName(document.document.title)
    let previous: WorkspaceDirectory | null = null
    if (source) {
      if (sourceFolder && sourceFolder !== '.' && sourceFolder !== '..' && !/[\\/]/.test(sourceFolder)) previous = await selected.root.getDirectoryHandle(sourceFolder)
      else {
        try { previous = await locate(selected.root, source, selected.accessId, false) }
        catch (error) { if (!localRecovery) throw error }
      }
      if (previous && sourceVersion) {
        if (!backupFolderPattern.test(sourceVersion)) throw new Error('La versión de recursos no es válida.')
        previous = await (await previous.getDirectoryHandle('copias')).getDirectoryHandle(sourceVersion)
        const saved = await readVersion(previous, true)
        if (!saved || serializeDocument(saved.document) !== serializeDocument(source)) throw new Error('La copia seleccionada cambió. Vuelve a seleccionar su versión.')
      }
    }
    const folder = await selected.root.getDirectoryHandle(document.document.title, { create: true })
    if (!(await folder.entries().next()).done) throw new Error('La carpeta ya contiene archivos. Elige otro nombre.')
    if (previous) await copyDirectory(previous, folder, true)
    locations.set(selected.accessId + ':' + document.document.id, folder)
    created.add(selected.accessId + ':' + document.document.id)
    const result = await save(document)
    if (result.status === 'error' && !source) {
      const key = selected.accessId + ':' + document.document.id
      locations.delete(key); created.delete(key); expectedContents.delete(key)
      try {
        // Only remove this failed creation's unchanged JSON and empty generated directories.
        const entries: [string, WorkspaceDirectory | WorkspaceFile][] = []
        for await (const entry of folder.entries()) entries.push(entry)
        for (const [name, entry] of entries) {
          if (entry.kind === 'directory') {
            if (!['gpx', 'recursos', 'informes', 'copias'].includes(name) || !(await entry.entries().next()).done) throw new Error('Contenido ajeno a la creación.')
          } else {
            if (name !== 'dashboard.json') throw new Error('Archivo ajeno a la creación.')
            const contents = await (await entry.getFile()).text()
            if (contents !== '' && contents !== serializeDocument(document)) throw new Error('El archivo cambió.')
          }
        }
        for (const [name, entry] of entries) {
          if (entry.kind === 'file') {
            const contents = await (await entry.getFile()).text()
            if (contents !== '' && contents !== serializeDocument(document)) throw new Error('El archivo cambió.')
          }
          await folder.removeEntry(name)
        }
        await selected.root.removeEntry(folder.name)
      } catch { return { ...result, message: result.message + ' La carpeta incompleta se conserva; elige otro nombre.' } }
    }
    return result
  }

  async function rename(document: AngieDocument, title: string, keepTitle = false, updatedAt = document.document.updatedAt): Promise<WorkspaceSaveResult> {
    const selected = await rootDirectory()
    if (!selected) return { status: 'unconfigured' }
    const source = await locate(selected.root, document, selected.accessId, false)
    if (!source) {
      const candidate = structuredClone(document)
      candidate.document.title = title
      candidate.document.updatedAt = updatedAt
      return create(candidate, document)
    }
    await availableName(title, document.document.id)
    const key = selected.accessId + ':' + document.document.id
    const candidate = structuredClone(document)
    candidate.document.title = keepTitle ? document.document.title : title
    candidate.document.updatedAt = keepTitle ? document.document.updatedAt : updatedAt
    if (source.name === title) return save(candidate)
    if (source.name.toLowerCase() === title.toLowerCase()) {
      // A case-insensitive filesystem needs a distinct intermediate directory.
      const staged = await rename(document, 'UIBoard_renombrando_' + crypto.randomUUID(), true)
      if (staged.status !== 'saved') return staged
      let failure: Extract<WorkspaceSaveResult, { status: 'error' }>
      try {
        const result = await rename(document, title, false, updatedAt)
        if (result.status === 'saved') return result
        failure = result.status === 'error' ? result : { status: 'error', message: 'No se pudo completar el cambio de nombre.' }
      } catch (error) { failure = { status: 'error', message: directoryErrorMessage(error) } }
      try {
        const restored = await rename(document, source.name, true)
        if (restored.status === 'saved') {
          try {
            const interrupted = await selected.root.getDirectoryHandle(title)
            const transfer = await transferState(interrupted)
            if (transfer && !transfer.ready && transfer.id === document.document.id) {
              await writeText(interrupted, '.angie-transfer.json', JSON.stringify({ ...transfer, source: source.name }))
            }
          } catch { /* The original is restored even if the interrupted copy cannot be updated. */ }
          return { ...failure, path: restored.path }
        }
      }
      catch { /* Retain the verified staging copy if the original location cannot be restored. */ }
      return { ...failure, path: staged.path, message: 'El trabajo se conserva en una ubicación temporal. ' + failure.message }
    }
    if ((await readDashboard(source))?.text !== serializeDocument(document)) throw new Error('La carpeta contiene cambios distintos. Se conserva sin sobrescribir; recupera su versión en rama.')
    const target = await selected.root.getDirectoryHandle(title, { create: true })
    if (!(await target.entries().next()).done) {
      const interrupted = await transferState(target)
      if (!interrupted || interrupted.ready || interrupted.id !== document.document.id || interrupted.source !== source.name) throw new Error('La carpeta de destino ya contiene archivos. Elige otro nombre.')
    }
    const journal = { source: source.name, id: document.document.id, ready: false }
    await writeText(target, '.angie-transfer.json', JSON.stringify(journal))
    const manifest = JSON.stringify(await directoryManifest(source))
    await copyDirectory(source, target)
    if (manifest !== JSON.stringify(await directoryManifest(source)) || manifest !== JSON.stringify(await directoryManifest(target))) {
      throw new Error('Los archivos cambiaron durante el renombrado. Se conserva la carpeta original; elige otro nombre para reintentar.')
    }
    await writeText(target, 'dashboard.json', serializeDocument(candidate))
    if ((await readDashboard(target))?.text !== serializeDocument(candidate)) throw new Error('No se pudo verificar el cambio de nombre. Se conserva el original.')
    await writeText(target, '.angie-transfer.json', JSON.stringify({ ...journal, ready: true }))
    locations.set(key, target)
    expectedContents.set(key, serializeDocument(candidate))
    let message: string | undefined
    try {
      if (manifest !== JSON.stringify(await directoryManifest(source))) throw new Error('La carpeta original cambió.')
      const expected = new Map((JSON.parse(manifest) as string[]).map(path => {
        if (path.endsWith('/')) return [path, ''] as const
        const separator = path.lastIndexOf(':')
        return [path.slice(0, separator), path.slice(separator + 1)] as const
      }))
      await removeVerifiedSource(source, expected, document.document.id)
      await selected.root.removeEntry(source.name)
      await target.removeEntry('.angie-transfer.json')
    } catch { message = 'Nombre actualizado. La carpeta anterior se conserva porque no se pudo completar su retirada.' }
    return { status: 'saved', path: `angie_dashboard/${title}/dashboard.json`, savedAt: now().toISOString(), message }
  }

  async function listRecoverable(): Promise<RecoverableDocument[]> {
    await writing
    const selected = await rootDirectory()
    if (!selected) return []
    const result: RecoverableDocument[] = []
    for await (const [name, entry] of selected.root.entries()) {
      if (entry.kind !== 'directory') continue
      const transfer = await transferState(entry)
      if (transfer && !transfer.ready) continue
      const current = await readDashboard(entry)
      if (current) result.push({ key: `workspace:${encodeURIComponent(name)}:dashboard.json`, title: current.document.document.title,
        documentId: current.document.document.id, savedAt: current.document.document.updatedAt, source: 'folder' })
      try {
        const copies = await entry.getDirectoryHandle('copias')
        for await (const [filename, file] of copies.entries()) {
          if (file.kind === 'file' ? !backupPattern.test(filename) : !backupFolderPattern.test(filename)) continue
          try {
            const saved = file.kind === 'directory' ? await readVersion(file) : null
            const parsed = file.kind === 'file' ? migrateDocument(JSON.parse(await (await file.getFile()).text())) : null
            const document = saved?.document ?? (parsed?.success ? parsed.document : null)
            if (document && (!current || document.document.id === current.document.document.id)) result.push({
              key: `workspace:${encodeURIComponent(name)}:${encodeURIComponent(filename)}`, title: document.document.title,
              documentId: document.document.id, savedAt: document.document.updatedAt, source: 'folder',
            })
          } catch { /* Keep unreadable copies and continue listing the valid ones. */ }
        }
      } catch (error) { if (!isMissing(error)) throw error }
    }
    return result.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  }
  async function loadRecoverable(key: string): Promise<LocalDocument | null> {
    await writing
    const parts = key.split(':')
    if (parts.length !== 3 || parts[0] !== 'workspace') return null
    const name = decodeURIComponent(parts[1]!), filename = decodeURIComponent(parts[2]!)
    if (!name || /[\\/]/.test(name) || name === '.' || name === '..' || (filename !== 'dashboard.json' && !backupPattern.test(filename) && !backupFolderPattern.test(filename))) return null
    const selected = await rootDirectory()
    if (!selected) return null
    const folder = await selected.root.getDirectoryHandle(name)
    const version = backupFolderPattern.test(filename)
    const container = filename === 'dashboard.json' ? folder : version
      ? await (await folder.getDirectoryHandle('copias')).getDirectoryHandle(filename) : await folder.getDirectoryHandle('copias')
    const saved = version ? await readVersion(container, true) : null
    const result = version ? null : migrateDocument(JSON.parse(await (await (await container.getFileHandle(filename)).getFile()).text()))
    const document = saved?.document ?? (result?.success ? result.document : null)
    return document ? { document, session: { openModules: [] }, savedAt: document.document.updatedAt, resourceFolder: name,
      resourceAccessId: selected.accessId, resourceVersion: version ? filename : undefined } : null
  }

  async function saveGpx(folder: WorkspaceDirectory, document: AngieDocument, accessId: string) {
    const directory = await folder.getDirectoryHandle('gpx', { create: true })
    const errors: string[] = []
    for (const reference of document.map?.gpx ?? []) {
      const name = gpxFilename(reference), key = `${accessId}:${document.document.id}:${name}`
      try {
        let existing: Awaited<ReturnType<WorkspaceFile['getFile']>> | null = null
        try { existing = await (await directory.getFileHandle(name)).getFile() }
        catch (error) { if (!isMissing(error)) throw error }
        if (existing && !(createdGpx.has(key) && existing.size === 0)) {
          const verified = verifiedGpx.get(key)
          if (verified && verified.size === existing.size && verified.lastModified === existing.lastModified) continue
          await gpxBytes(existing, reference)
        } else {
          const source = await readGpxAccess(reference.fingerprint)
          if (!source) throw new Error('Selecciona el GPX original para copiarlo a la carpeta.')
          const bytes = await gpxBytes(source, reference)
          const destination = await directory.getFileHandle(name, { create: true })
          createdGpx.add(key)
          const stream = await destination.createWritable()
          try { await stream.write(bytes); await stream.close() }
          catch (error) { try { await stream.abort() } catch { /* Keep the original error. */ } throw error }
          existing = await (await directory.getFileHandle(name)).getFile()
          await gpxBytes(existing, reference)
        }
        createdGpx.delete(key)
        if (existing.size !== undefined && existing.lastModified !== undefined) verifiedGpx.set(key, { size: existing.size, lastModified: existing.lastModified })
      } catch (error) { errors.push(`${reference.name}: ${error instanceof Error ? error.message : 'No se pudo guardar el GPX.'}`) }
    }
    return errors
  }

  async function readGpx(document: AngieDocument, reference: MapGpxReference): Promise<File | null> {
    try {
      await writing
      const selected = await getRoot()
      if (!selected) return null
      const root = !selected.isContainer && selected.handle.name.toLowerCase() === 'angie_dashboard' ? selected.handle : await selected.handle.getDirectoryHandle('angie_dashboard')
      const folder = await locate(root, document, selected.accessId, false)
      if (!folder) return null
      const directory = await folder.getDirectoryHandle('gpx')
      const file = await (await directory.getFileHandle(gpxFilename(reference))).getFile()
      const bytes = await gpxBytes(file, reference)
      return new File([bytes], reference.name, { type: 'application/gpx+xml', lastModified: reference.lastModified })
    } catch { return null }
  }

  async function backup(folder: WorkspaceDirectory, previous: { text: string; document: AngieDocument }, timestamp: number) {
    const copies = await folder.getDirectoryHandle('copias', { create: true })
    const owned: { name: string; time: number; directory: boolean }[] = []
    for await (const [name, entry] of copies.entries()) {
      const match = (entry.kind === 'file' ? backupPattern : backupFolderPattern).exec(name)
      if (!match) continue
      try {
        const saved = entry.kind === 'directory' ? await readVersion(entry) : null
        const result = entry.kind === 'file' ? migrateDocument(JSON.parse(await (await entry.getFile()).text())) : null
        const document = saved?.document ?? (result?.success ? result.document : null)
        if (document?.document.id === previous.document.document.id) owned.push({ name, time: Number(match[1]), directory: entry.kind === 'directory' })
      } catch { /* Unrecognized copies belong to the user and are never pruned. */ }
    }
    owned.sort((a, b) => b.time - a.time)
    if (owned.length && timestamp - owned[0]!.time < backupInterval) return
    const name = `dashboard_${String(timestamp).padStart(13, '0')}_${crypto.randomUUID()}`
    const version = await copies.getDirectoryHandle(name, { create: true })
    if (!(await version.entries().next()).done) throw new Error('La carpeta de copia ya contiene archivos.')
    try {
      await writeText(version, versionManifestName, JSON.stringify({ documentId: previous.document.document.id, ready: false }))
      await copyDirectory(folder, version, true)
      for (const reference of previous.document.map?.gpx ?? []) {
        try { await gpxBytes(await (await (await version.getDirectoryHandle('gpx')).getFileHandle(gpxFilename(reference))).getFile(), reference) }
        catch { throw new Error('No se pudo proteger el GPX de la versión anterior: ' + reference.name) }
      }
      if ((await readDashboard(folder))?.text !== previous.text) throw new Error('El documento cambió fuera de Angie durante la copia de seguridad.')
      await writeText(version, 'dashboard.json', previous.text)
      const files = (await directoryManifest(version)).filter(path => !path.startsWith(versionManifestName + ':'))
      await writeText(version, versionManifestName, JSON.stringify({ documentId: previous.document.document.id, ready: true, files }))
      if (!await readVersion(version, true)) throw new Error('No se pudo verificar la copia de seguridad.')
    } catch (error) {
      try {
        const current = await copies.getDirectoryHandle(name)
        const manifest: unknown = JSON.parse(await (await (await current.getFileHandle(versionManifestName)).getFile()).text())
        if (await current.isSameEntry?.(version) && manifest && typeof manifest === 'object' &&
          'documentId' in manifest && manifest.documentId === previous.document.document.id && 'ready' in manifest && manifest.ready === false) {
          await copies.removeEntry(name, { recursive: true })
        }
      } catch { /* Keep an incomplete copy if cleanup is unavailable. */ }
      throw error
    }
    owned.unshift({ name, time: timestamp, directory: true })
    // Delete only this dashboard's recognized recovery copies, after a new one exists.
    for (const old of owned.slice(5)) {
      if (old.directory) {
        try {
          const folder = await copies.getDirectoryHandle(old.name)
          if (!await readVersion(folder, true) || !await (await copies.getDirectoryHandle(old.name)).isSameEntry?.(folder)) continue
        }
        catch { continue }
      }
      await copies.removeEntry(old.name, old.directory ? { recursive: true } : undefined)
    }
  }

  async function save(document: AngieDocument): Promise<WorkspaceSaveResult> {
    try {
      const text = serializeDocument(document)
      const selected = await getRoot()
      if (!selected) return { status: 'unconfigured' }
      if (await selected.handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
        return { status: 'error', permissionRequired: true, message: 'Autoriza el acceso desde Archivo → Carpeta de trabajo.' }
      }
      const root = !selected.isContainer && selected.handle.name.toLowerCase() === 'angie_dashboard' ? selected.handle : await selected.handle.getDirectoryHandle('angie_dashboard', { create: true })
      const folder = await locate(root, document, selected.accessId)
      if (!folder) throw new Error('No se pudo localizar la carpeta del dashboard.')
      const key = selected.accessId + ':' + document.document.id
      const previous = await readDashboard(folder)
      // An existing invalid or foreign JSON must never be silently replaced.
      if (!previous) {
        try {
          const existing = await (await (await folder.getFileHandle('dashboard.json')).getFile()).text()
          if (!created.has(key) || existing !== '') throw new Error('El dashboard.json de destino no es válido. Se conserva sin sobrescribir.')
        }
        catch (error) { if (!isMissing(error)) throw error }
      } else if (previous.document.document.id !== document.document.id) {
        throw new Error('La carpeta pertenece a otro dashboard. Se conserva sin sobrescribir.')
      }
      const timestamp = now()
      if (previous && previous.text !== text) {
        const diskTime = Date.parse(previous.document.document.updatedAt), editTime = Date.parse(document.document.updatedAt)
        const sameData = serializeDocument(previous.document) === text
        const baseline = expectedContents.has(key) ? null : await readWorkspaceBaseline(selected.accessId, document.document.id).catch(() => null)
        const externalChange = expectedContents.has(key) ? expectedContents.get(key) !== previous.text
          : !baseline || baseline !== await digest(new TextEncoder().encode(previous.text).buffer as ArrayBuffer)
        if (!sameData && (externalChange || diskTime > editTime || (diskTime === editTime && expectedContents.get(key) !== previous.text))) {
          throw new Error('La carpeta contiene una revisión distinta o más reciente. Abre su dashboard.json o guarda una copia con Guardar como.')
        }
        await backup(folder, previous, timestamp.getTime())
      }
      await folder.getDirectoryHandle('recursos', { create: true })
      await folder.getDirectoryHandle('informes', { create: true })
      await folder.getDirectoryHandle('copias', { create: true })
      if (!previous || previous.text !== text) await writeText(folder, 'dashboard.json', text)
      expectedContents.set(key, text)
      await rememberWorkspaceBaseline(selected.handle, selected.accessId, document.document.id,
        await digest(new TextEncoder().encode(text).buffer as ArrayBuffer)).catch(() => {})
      const gpxErrors = await saveGpx(folder, document, selected.accessId)
      if (gpxErrors.length) return { status: 'saved', resourcesPending: true, path: `angie_dashboard/${folder.name}/dashboard.json`, savedAt: timestamp.toISOString(), message: 'Documento guardado; hay GPX pendientes en la carpeta. ' + gpxErrors.join(' ') }
      return { status: 'saved', path: `angie_dashboard/${folder.name}/dashboard.json`, savedAt: timestamp.toISOString() }
    } catch (error) {
      return { status: 'error', message: directoryErrorMessage(error), permissionRequired: error instanceof DOMException && error.name === 'NotAllowedError' }
    }
  }

  async function saveReport(document: AngieDocument, report: { filename: string; html: string }): Promise<WorkspaceSaveResult> {
    try {
      if (!/^informe_[0-9TZ-]+_[0-9a-f-]{36}\.html$/.test(report.filename)) throw new Error('Nombre de informe no válido.')
      const selected = await rootDirectory()
      if (!selected) return { status: 'unconfigured' }
      const folder = await locate(selected.root, document, selected.accessId)
      if (!folder) throw new Error('No se pudo localizar la carpeta del dashboard.')
      if (!await readDashboard(folder)) {
        const saved = await save(document)
        if (!await readDashboard(folder)) return saved.status === 'error' ? saved : { status: 'error', message: 'No se pudo preparar la carpeta del informe.' }
      }
      const reports = await folder.getDirectoryHandle('informes', { create: true })
      try { await reports.getFileHandle(report.filename); throw new Error('Ya existe un informe con ese nombre. Se conserva sin sobrescribir.') }
      catch (error) { if (!isMissing(error)) throw error }
      await writeText(reports, report.filename, report.html)
      return { status: 'saved', path: `angie_dashboard/${folder.name}/informes/${report.filename}`, savedAt: now().toISOString() }
    } catch (error) { return { status: 'error', message: directoryErrorMessage(error), permissionRequired: error instanceof DOMException && error.name === 'NotAllowedError' } }
  }

  // One lock across tabs prevents interleaved reads, backups and writes.
  function withWrite(action: () => Promise<WorkspaceSaveResult>) {
    const result = writing.then(async () => {
      if (!navigator.locks?.request) return action()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      try {
        return await navigator.locks.request('angie-dashboard-workspace-write', { signal: controller.signal }, () => {
          clearTimeout(timeout)
          return action()
        })
      } catch (error) {
        if (controller.signal.aborted) throw new Error('Otra ventana está utilizando la carpeta. Cierra esa ventana o termina su operación y pulsa Reintentar.')
        throw error
      } finally { clearTimeout(timeout) }
    })
    writing = result.then(() => {}, () => {})
    return result.catch((error): WorkspaceSaveResult => ({ status: 'error', message: directoryErrorMessage(error), permissionRequired: error instanceof DOMException && error.name === 'NotAllowedError' }))
  }
  return { readGpx, availableName, listRecoverable, loadRecoverable,
    create: (document, source, sourceFolder, sourceAccessId, sourceVersion, localRecovery) => { const copy = structuredClone(document); return withWrite(() => create(copy, source ? structuredClone(source) : undefined, sourceFolder, sourceAccessId, sourceVersion, localRecovery)) },
    rename: (document, title, updatedAt) => { const copy = structuredClone(document); return withWrite(() => rename(copy, title, false, updatedAt)) },
    save: document => { const copy = structuredClone(document); return withWrite(() => save(copy)) },
    saveReport: (document, report) => { const copy = structuredClone(document); return withWrite(() => saveReport(copy, report)) },
  }
}

export function createBrowserWorkspaceFiles(): WorkspaceFiles {
  return createWorkspaceFiles(async () => {
    const selected = await readWorkDirectoryConfiguration()
    if (!selected) return null
    const handle = selected.handle as WorkspaceDirectory
    if (typeof handle.getDirectoryHandle !== 'function' || typeof handle.entries !== 'function') {
      throw new Error('Este navegador no permite guardar en carpetas. Puedes usar Guardar como o Descargar JSON.')
    }
    return { accessId: selected.accessId, handle, isContainer: selected.isContainer }
  })
}
