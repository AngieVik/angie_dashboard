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
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg' }

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  // Ajv compiles the bundled schema at runtime. unsafe-eval also permits tzf-wasm.
  // Removing this exception requires generating standalone validators at build time.
  "script-src 'self' 'unsafe-eval'",
  "script-src-attr 'none'",
  // React/Leaflet geometry and the srcdoc reports use inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://tms-pnoa-ma.idee.es https://tms-mapa-raster.ign.es https://tms-ign-base.idee.es https://www.ign.es",
  "font-src 'self' data:",
  "media-src 'self'",
  // mapSearch supports an operator-selected HTTPS Nominatim-compatible endpoint.
  "connect-src 'self' https:",
  "worker-src 'self'",
  // Reports are sandboxed srcdoc frames with their own restrictive CSP.
  "frame-src 'self'",
  "manifest-src 'self'",
].join('; ')

const server = createServer(async (request, response) => {
  // Set before routing so errors and HEAD responses receive the same protection.
  response.setHeader('Content-Security-Policy', contentSecurityPolicy)
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('X-Content-Type-Options', 'nosniff')
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
      'Cache-Control': 'no-cache' })
    if (request.method === 'HEAD') { response.end(); return }
    const stream = createReadStream(file)
    stream.on('error', () => response.destroy())
    stream.pipe(response)
  } catch { if (!response.headersSent) response.writeHead(400); response.end() }
})
server.listen(port, host, () => { process.stdout.write(`Angie: http://${host}:${port}\n`) })
