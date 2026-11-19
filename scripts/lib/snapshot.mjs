import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createHash } from 'node:crypto'
import { root, filesIn } from './project.mjs'

export const digest = value => createHash('sha256').update(value).digest('hex')

function installedManifests(directory = path.join(root, 'node_modules')) {
  if (!fs.existsSync(directory)) return []
  const result = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const target = path.join(directory, entry.name)
    if (entry.name.startsWith('@')) { result.push(...installedManifests(target)); continue }
    const manifest = path.join(target, 'package.json')
    if (fs.existsSync(manifest)) result.push(path.relative(root, manifest).replaceAll('\\', '/'))
    result.push(...installedManifests(path.join(target, 'node_modules')))
  }
  return result
}

export function snapshot() {
  const inputs = [...new Set([
    ...['src', 'scripts', 'server', 'public'].flatMap(filesIn),
    'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'eslint.config.js', 'index.html', 'AGENTS.md',
    'docs/architecture.md', 'docs/design.md', 'docs/development.md',
    '.env', '.env.local', '.env.production', '.env.production.local', 'node_modules/.package-lock.json',
    ...installedManifests(),
  ])].filter(file => fs.existsSync(path.join(root, file))).sort()
  const files = inputs.map(file => {
    const bytes = fs.readFileSync(path.join(root, file))
    return { file, bytes: bytes.length, hash: digest(bytes) }
  })
  const environment = Object.fromEntries(Object.keys(process.env).filter(key => /^(?:VITE_|NODE_ENV$|TZ$)/.test(key)).sort().map(key => [key, digest(process.env[key] ?? '')]))
  return { environment, files }
}

export function changedInputs(before, after) {
  const left = new Map(before.files.map(item => [item.file, item.hash]))
  const right = new Map(after.files.map(item => [item.file, item.hash]))
  const changed = [...new Set([...left.keys(), ...right.keys()])].filter(file => left.get(file) !== right.get(file))
  if (JSON.stringify(before.environment) !== JSON.stringify(after.environment)) changed.push('(variables de entorno)')
  return changed
}
