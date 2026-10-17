import { migrateDocument } from '../../domain/document/migrateDocument'
import { serializeDocument } from '../../domain/document/serializeDocument'
import type { AngieDocument, MapGpxReference } from '../../domain/document/types'
import { readGpxAccess } from '../../storage/gpxAccessRepository'
import { readWorkDirectoryConfiguration } from '../../storage/workDirectoryAccessRepository'
import type { WorkDirectoryHandle } from '../../storage/workDirectoryAccessRepository'
import type { SaveFileHandle } from './fileAccess'

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
  removeEntry(name: string): Promise<void>
}
export interface WorkspaceRoot { handle: WorkspaceDirectory; accessId: string }
export type WorkspaceSaveResult =
  | { status: 'unconfigured' }
  | { status: 'saved'; path: string; savedAt: string }
  | { status: 'error'; message: string }
export interface WorkspaceFiles {
  save(document: AngieDocument): Promise<WorkspaceSaveResult>
  readGpx?(document: AngieDocument, reference: MapGpxReference): Promise<File | null>
  saveReport?(document: AngieDocument, report: { filename: string; html: string }): Promise<WorkspaceSaveResult>
}

const backupInterval = 5 * 60 * 1000
const backupPattern = /^dashboard_(\d{13})_[0-9a-f-]{36}\.json$/

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

  async function locate(root: WorkspaceDirectory, document: AngieDocument, accessId: string, create = true) {
    const key = accessId + ':' + document.document.id
    const cached = locations.get(key)
    if (cached) {
      try {
        const saved = await readDashboard(cached)
        if (saved?.document.document.id === document.document.id) return cached
        if (!saved) {
          try {
            const text = await (await (await cached.getFileHandle('dashboard.json')).getFile()).text()
            if (created.has(key) && text === '') return cached
            throw new Error('El dashboard de destino no es válido. Se conserva sin sobrescribir.')
          } catch (error) {
            if (!isMissing(error)) throw error
            // Check the directory itself still exists, then retry an interrupted first write.
            await cached.entries().next()
            return cached
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
      const saved = await readDashboard(entry)
      if (saved?.document.document.id !== document.document.id) continue
      if (found) throw new Error('Hay varias carpetas con el mismo ID de dashboard. Conserva una única carpeta de trabajo para ese documento.')
      found = entry
    }
    if (!found) {
      if (!create) return null
      const base = workspaceFolderName(document)
      let name = base, suffix = 0
      while (names.has(name.toLowerCase())) {
        name = `${base}_${document.document.id.slice(0, 8)}${suffix ? '_' + suffix : ''}`
        suffix++
      }
      found = await root.getDirectoryHandle(name, { create: true })
      // Never claim a folder containing an unrelated file, including a damaged JSON.
      if (!(await found.entries().next()).done) throw new Error('La carpeta de destino ya contiene archivos. Vuelve a guardar para elegir un destino libre.')
      created.add(key)
    }
    locations.set(key, found)
    return found
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
      const root = selected.handle.name.toLowerCase() === 'angie_dashboard' ? selected.handle : await selected.handle.getDirectoryHandle('angie_dashboard')
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
    const owned: { name: string; time: number }[] = []
    for await (const [name, entry] of copies.entries()) {
      const match = backupPattern.exec(name)
      if (entry.kind !== 'file' || !match) continue
      try {
        const result = migrateDocument(JSON.parse(await (await entry.getFile()).text()))
        if (result.success && result.document.document.id === previous.document.document.id) owned.push({ name, time: Number(match[1]) })
      } catch { /* Unrecognized copies belong to the user and are never pruned. */ }
    }
    owned.sort((a, b) => b.time - a.time)
    if (owned.length && timestamp - owned[0]!.time < backupInterval) return
    const name = `dashboard_${String(timestamp).padStart(13, '0')}_${crypto.randomUUID()}.json`
    await writeText(copies, name, previous.text)
    owned.unshift({ name, time: timestamp })
    // Delete only this dashboard's recognized recovery copies, after a new one exists.
    for (const old of owned.slice(5)) await copies.removeEntry(old.name)
  }

  async function save(document: AngieDocument): Promise<WorkspaceSaveResult> {
    try {
      const text = serializeDocument(document)
      const selected = await getRoot()
      if (!selected) return { status: 'unconfigured' }
      if (await selected.handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
        throw new Error('Autoriza la carpeta desde Archivo → Permisos. Los cambios siguen guardados en este dispositivo.')
      }
      const root = selected.handle.name.toLowerCase() === 'angie_dashboard' ? selected.handle : await selected.handle.getDirectoryHandle('angie_dashboard', { create: true })
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
        const externalChange = expectedContents.has(key) && expectedContents.get(key) !== previous.text
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
      const gpxErrors = await saveGpx(folder, document, selected.accessId)
      if (gpxErrors.length) return { status: 'error', message: 'Dashboard guardado; hay GPX pendientes en la carpeta. ' + gpxErrors.join(' ') }
      return { status: 'saved', path: `angie_dashboard/${folder.name}/dashboard.json`, savedAt: timestamp.toISOString() }
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo guardar en la carpeta de trabajo.' }
    }
  }

  async function saveReport(document: AngieDocument, report: { filename: string; html: string }): Promise<WorkspaceSaveResult> {
    try {
      if (!/^informe_[0-9TZ-]+_[0-9a-f-]{36}\.html$/.test(report.filename)) throw new Error('Nombre de informe no válido.')
      const selected = await getRoot()
      if (!selected) return { status: 'unconfigured' }
      if (await selected.handle.queryPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Autoriza la carpeta desde Archivo → Permisos para guardar el informe.')
      const root = selected.handle.name.toLowerCase() === 'angie_dashboard' ? selected.handle : await selected.handle.getDirectoryHandle('angie_dashboard', { create: true })
      const folder = await locate(root, document, selected.accessId)
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
    } catch (error) { return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo guardar el informe.' } }
  }

  // One lock across tabs prevents interleaved reads, backups and writes.
  function withWrite(action: () => Promise<WorkspaceSaveResult>) {
    const result = writing.then(() => navigator.locks?.request
      ? navigator.locks.request('angie-dashboard-workspace-write', action)
      : action())
    writing = result.then(() => {}, () => {})
    return result.catch((error): WorkspaceSaveResult => ({ status: 'error', message: error instanceof Error ? error.message : 'No se pudo acceder a la carpeta de trabajo.' }))
  }
  return { readGpx,
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
    return { accessId: selected.accessId, handle }
  })
}
