import fs from 'node:fs'
import path from 'node:path'

export const workflowFolder = 'output/diagnostic workflow'
export const workflowTimeZone = 'Europe/Madrid'

export function workflowRunName(startedAt, profile) {
  if (!['quick', 'full'].includes(profile)) throw new Error('Perfil de diagnóstico no válido.')
  const date = new Date(startedAt)
  if (!Number.isFinite(date.getTime())) throw new Error('Fecha de diagnóstico no válida.')
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: workflowTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}_${profile}`
}

// Reserve the name atomically at publication. Concurrent runs and repeated
// runs in the same minute must never replace an existing report.
export function reserveWorkflowRun(directory, startedAt, profile) {
  const parent = path.resolve(directory), base = workflowRunName(startedAt, profile)
  fs.mkdirSync(parent, { recursive: true })
  for (let attempt = 1; ; attempt++) {
    const runId = attempt === 1 ? base : `${base}_${String(attempt).padStart(2, '0')}`
    const target = path.join(parent, runId), pending = path.join(parent, `.pending-${runId}`)
    if (path.dirname(target) !== parent || path.dirname(pending) !== parent) throw new Error('Destino de diagnóstico fuera de la carpeta prevista.')
    if (fs.existsSync(target)) continue
    try { fs.mkdirSync(pending) }
    catch (error) { if (error.code === 'EEXIST') continue; throw error }
    // Another publisher may have finished between the first check and mkdir.
    if (fs.existsSync(target)) { fs.rmdirSync(pending); continue }
    return { runId, pending, target }
  }
}
