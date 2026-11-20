import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { clearTimeout, setTimeout } from 'node:timers'
import { request } from 'node:http'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const timeoutMs = 5000

function ready(child) {
  return new Promise((resolve, reject) => {
    let output = '', errors = ''
    const finish = (error, port) => {
      clearTimeout(timer)
      child.stdout.off('data', stdout)
      child.stderr.off('data', stderr)
      child.off('error', failed)
      child.off('exit', exited)
      if (error) reject(error)
      else resolve(port)
    }
    const stdout = chunk => {
      output = (output + chunk).slice(-2048)
      const match = /(?:^|\n)Angie: http:\/\/127\.0\.0\.1:(\d+)\r?\n/.exec(output)
      if (!match) return
      const port = Number(match[1])
      if (port < 1 || port > 65535) finish(new Error('El servidor anunció un puerto no válido.'))
      else finish(null, port)
    }
    const stderr = chunk => { errors = (errors + chunk).slice(-2048) }
    const failed = error => finish(error)
    const exited = code => finish(new Error(`El servidor terminó al arrancar (${code}): ${errors.trim()}`))
    const timer = setTimeout(() => finish(new Error('El servidor local no arrancó a tiempo.')), timeoutMs)
    child.stdout.on('data', stdout)
    child.stderr.on('data', stderr)
    child.once('error', failed)
    child.once('exit', exited)
  })
}

function responseFor(port, method, pathname) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, method, path: pathname, agent: false }, response => {
      let bytes = 0
      response.on('data', chunk => { bytes += chunk.length })
      response.on('error', reject)
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, bytes }))
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Tiempo agotado: ${method} ${pathname}`)))
    req.end()
  })
}

function security(headers) {
  assert.equal(headers['x-content-type-options'], 'nosniff', 'Falta nosniff')
  assert.equal(headers['x-frame-options'], 'DENY', 'Falta protección contra enmarcado')
  assert.equal(typeof headers['content-security-policy'], 'string', 'Falta CSP')
  const directives = new Map(headers['content-security-policy'].split(';').map(value => {
    const [name, ...sources] = value.trim().split(/\s+/)
    return [name, sources]
  }))
  assert.deepEqual(directives.get('frame-ancestors'), ["'none'"], 'CSP permite enmarcar la app')
  assert.deepEqual(directives.get('object-src'), ["'none'"], 'CSP permite objetos')
  assert.deepEqual(directives.get('base-uri'), ["'none'"], 'CSP permite cambiar la base')
  assert.deepEqual(directives.get('worker-src'), ["'self'"], 'CSP de workers inesperada')
  assert.ok(directives.get('script-src')?.includes("'self'"), 'CSP no permite scripts locales')
  assert.ok(!directives.get('script-src')?.includes("'unsafe-inline'"), 'CSP permite scripts inline')
}

async function stop(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return
  const exited = once(child, 'exit')
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
  child.kill()
  try { await exited } finally { clearTimeout(timer) }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write('Uso: npm run check:server\nRequiere dist/ compilado. Arranca un servidor temporal en loopback, comprueba cabeceras, métodos, rutas y MIME, y lo detiene. Sin navegador ni consultas externas.\n')
    return
  }
  if (args.length) throw new Error('Argumentos no reconocidos. Usa --help.')
  const dist = path.join(root, 'dist')
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('No existe el build. Ejecuta npm run build antes de npm run check:server.')
  const files = fs.readdirSync(dist, { recursive: true }).map(file => file.replaceAll('\\', '/'))
    .filter(file => fs.statSync(path.join(dist, file)).isFile())
  const child = spawn(process.execPath, [path.join(root, 'server/server.mjs')], {
    cwd: root, env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  })
  let checks = 0
  try {
    const port = await ready(child)
    const check = async (method, pathname, status, type) => {
      const result = await responseFor(port, method, pathname)
      assert.equal(result.status, status, `${method} ${pathname}`)
      security(result.headers)
      if (method === 'HEAD') assert.equal(result.bytes, 0, `HEAD con cuerpo: ${pathname}`)
      if (status === 200) assert.equal(result.headers['cache-control'], 'no-cache')
      if (status === 405) assert.equal(result.headers.allow, 'GET, HEAD')
      if (type) assert.equal(result.headers['content-type'], type, `MIME: ${pathname}`)
      checks++
    }
    await check('GET', '/', 200, 'text/html; charset=utf-8')
    await check('HEAD', '/', 200, 'text/html; charset=utf-8')
    await check('HEAD', '/vista-interna-de-comprobacion', 200, 'text/html; charset=utf-8')
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) await check(method, '/', 405)
    for (const pathname of ['/api/', '/package.json', '/recurso-inexistente-de-comprobacion.js']) await check('HEAD', pathname, 404)
    await check('GET', '/%2e%2e%2fpackage.json', 403)
    await check('GET', '/%', 400)
    const types = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
      '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' }
    for (const [extension, type] of Object.entries(types)) {
      const file = files.find(file => file.endsWith(extension))
      assert.ok(file, `El build no contiene recursos ${extension}`)
      await check('HEAD', '/' + file.split('/').map(encodeURIComponent).join('/'), 200, type)
    }
    for (const pathname of ['/sw.js', '/registerSW.js']) await check('HEAD', pathname, 200, types['.js'])
  } finally { await stop(child) }
  process.stdout.write(`Servidor local: ${checks} comprobaciones correctas de cabeceras, métodos, rutas y MIME; servidor temporal detenido.\n`)
}

main().catch(error => { process.stderr.write(`check:server: ${error.message}\n`); process.exitCode = 1 })
