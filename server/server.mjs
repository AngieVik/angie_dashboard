import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const host = process.env.HOST ?? '127.0.0.1', port = Number(process.env.PORT ?? 4180)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe ser un puerto entre 1 y 65535.')
if (!existsSync(resolve(root, 'index.html'))) throw new Error('No existe el build de Angie. Ejecuta npm run build antes de npm start.')
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg' }

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return }
  try {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    if (path.startsWith('/api/')) { response.writeHead(404); response.end(); return }
    let file = resolve(root, '.' + path)
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403); response.end(); return }
    const info = await stat(file).catch(() => null)
    if (!info?.isFile()) {
      if (extname(path)) { response.writeHead(404); response.end(); return }
      file = resolve(root, 'index.html')
    }
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
    if (request.method === 'HEAD') { response.end(); return }
    const stream = createReadStream(file)
    stream.on('error', () => response.destroy())
    stream.pipe(response)
  } catch { if (!response.headersSent) response.writeHead(400); response.end() }
})
server.listen(port, host, () => { process.stdout.write(`Angie: http://${host}:${port}\n`) })
