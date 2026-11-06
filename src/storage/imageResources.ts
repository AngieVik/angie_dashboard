import type { ReferencedBoardImage } from '../domain/document/types'
import { checkFileBytes } from '../domain/input/inputBudgets'

interface ImageResource { id: string; blob: Blob }
// Originals are immutable and shared outside document revisions. Nothing here re-encodes pixels.
const originals = new Map<string, Blob>()
const fingerprints = new WeakMap<Blob, Promise<string>>()

async function fingerprint(blob: Blob) {
  checkFileBytes(blob.size, 'image')
  const bytes = await blob.arrayBuffer()
  const signature = new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength))
  const valid = blob.type === 'image/png'
    ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte)
    : blob.type === 'image/jpeg' && signature[0] === 255 && signature[1] === 216 && signature[2] === 255
  if (!valid) throw new Error('El original debe ser una imagen PNG o JPEG válida.')
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return 'sha256:' + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function registerImage(blob: Blob): Promise<string> {
  let pending = fingerprints.get(blob)
  if (!pending) { pending = fingerprint(blob); fingerprints.set(blob, pending) }
  const id = await pending
  if (!originals.has(id)) originals.set(id, blob)
  return id
}

function imageResource(id: string): ImageResource {
  const blob = originals.get(id)
  if (!blob) throw new Error('No está disponible la imagen original: ' + id)
  return { id, blob }
}

export function boardImageFile(image: ReferencedBoardImage): File {
  const { blob } = imageResource(image.resourceId)
  return new File([blob], blob.type === 'image/png' ? 'fondo.png' : 'fondo.jpg', { type: blob.type })
}

export function releaseImages() { originals.clear() }
export function releaseImage(id: string) { originals.delete(id) }
