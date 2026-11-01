import type { AngieDocument, AngieDocumentV4, EmbeddedBoardImage, ReferencedBoardImage } from '../domain/document/types'
import { embeddedImageFile } from '../platform/files/embeddedImage'
import { checkFileBytes } from '../domain/input/inputBudgets'

export interface ImageResource { id: string; blob: Blob }
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

export async function registerImage(blob: Blob, expectedId?: string): Promise<string> {
  let pending = fingerprints.get(blob)
  if (!pending) { pending = fingerprint(blob); fingerprints.set(blob, pending) }
  const id = await pending
  if (expectedId !== undefined && id !== expectedId) throw new Error('La huella de la imagen original no coincide. Se conserva el registro.')
  if (!originals.has(id)) originals.set(id, blob)
  return id
}

export function imageResource(id: string): ImageResource {
  const blob = originals.get(id)
  if (!blob) throw new Error('No está disponible la imagen original: ' + id)
  return { id, blob }
}

export function boardImageFile(image: EmbeddedBoardImage | ReferencedBoardImage): File {
  if ('dataUrl' in image) return embeddedImageFile(image.dataUrl)
  const { blob } = imageResource(image.resourceId)
  return new File([blob], blob.type === 'image/png' ? 'fondo.png' : 'fondo.jpg', { type: blob.type })
}

export async function workingDocument(document: AngieDocument): Promise<AngieDocument> {
  const image = document.board.backgroundImage
  if (!image || !('dataUrl' in image)) return document
  const resourceId = await registerImage(embeddedImageFile(image.dataUrl))
  return { ...document, board: { ...document.board, backgroundImage: { resourceId, layout: image.layout } } }
}

export async function portableDocument(document: AngieDocument): Promise<AngieDocumentV4> {
  const image = document.board?.backgroundImage
  if (!image || 'dataUrl' in image) return document as AngieDocumentV4
  const { blob } = imageResource(image.resourceId)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunks: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 12_288) {
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + 12_288))))
  }
  return { ...document, board: { ...document.board, backgroundImage: {
    dataUrl: `data:${blob.type};base64,${chunks.join('')}`, layout: image.layout,
  } } }
}
