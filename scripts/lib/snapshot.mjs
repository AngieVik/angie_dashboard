import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
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
    'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'eslint.config.js', 'index.html', 'AGENTS.md', 'DISEÑO.md', 'ARQUITECTURA.md',
    '.env', '.env.local', '.env.production', '.env.production.local', 'node_modules/.package-lock.json',
    ...installedManifests(),
  ])].filter(file => fs.existsSync(path.join(root, file))).sort()
  const files = inputs.map(file => {
    const bytes = fs.readFileSync(path.join(root, file))
    return { file, bytes: bytes.length, hash: digest(bytes) }
  })
  const environment = Object.fromEntries(Object.keys(process.env).filter(key => /^(?:VITE_|NODE_ENV$|TZ$)/.test(key)).sort().map(key => [key, digest(process.env[key] ?? '')]))
  const engines = Object.fromEntries(['typescript', 'vite', 'ajv'].map(name => {
    const manifest = path.join(root, 'node_modules', name, 'package.json')
    return [name, fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')).version : null]
  }))
  const git = args => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
    catch { return null }
  }
  const head = git(['rev-parse', 'HEAD'])
  const status = git(['-c', 'core.excludesfile=', 'status', '--porcelain=v1', '--untracked-files=normal'])
  return {
    hash: digest(JSON.stringify({ files, environment })),
    engineHash: digest(JSON.stringify({ files: files.filter(item => item.file.startsWith('scripts/')), engines, node: process.version })),
    git: { head, dirty: status === null ? null : Boolean(status), changedEntries: status ? status.split('\n').length : 0 },
    environment, engines, node: process.version, files,
  }
}

export function changedInputs(before, after) {
  const left = new Map(before.files.map(item => [item.file, item.hash]))
  const right = new Map(after.files.map(item => [item.file, item.hash]))
  const changed = [...new Set([...left.keys(), ...right.keys()])].filter(file => left.get(file) !== right.get(file))
  if (JSON.stringify(before.environment) !== JSON.stringify(after.environment)) changed.push('(variables de entorno)')
  return changed
}
