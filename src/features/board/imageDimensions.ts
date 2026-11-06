interface ImageDimensions { width: number; height: number }

function invalidHeader(): never { throw new Error('Cabecera de imagen inválida o incompleta') }

// Metadata only; never asks the browser to decode pixels.
// PNG: https://www.w3.org/TR/png/#11IHDR
// JPEG: https://www.w3.org/Graphics/JPEG/itu-t81.pdf (B.2.2 and B.2.4.1)
export async function readImageDimensions(file: Blob): Promise<ImageDimensions> {
  if (file.type === 'image/png') {
    const bytes = new Uint8Array(await file.slice(0, 33).arrayBuffer())
    const signature = [137, 80, 78, 71, 13, 10, 26, 10]
    if (bytes.length !== 33 || !signature.every((byte, index) => bytes[index] === byte)) invalidHeader()
    const view = new DataView(bytes.buffer)
    // IHDR must be first, with exactly 13 bytes of data.
    if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) invalidHeader()
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (file.type !== 'image/jpeg') invalidHeader()

  // Keep at most a 64 KiB window. Skip APP/EXIF/ICC and other segment payloads
  // by their length, without copying the entire (up to 50 MiB) original.
  const windowBytes = 64 * 1024
  let start = 0
  let bytes = new Uint8Array(await file.slice(0, windowBytes).arrayBuffer())
  let view = new DataView(bytes.buffer)
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) invalidHeader()
  let offset = 2
  while (offset < file.size) {
    // Ten bytes include the marker, segment length and fixed SOF fields.
    if (offset + 10 > start + bytes.length) {
      start = offset
      bytes = new Uint8Array(await file.slice(start, start + windowBytes).arrayBuffer())
      view = new DataView(bytes.buffer)
    }
    const index = offset - start
    if (index + 2 > bytes.length || bytes[index] !== 0xff) invalidHeader()
    const marker = view.getUint8(index + 1)
    if (marker === 0xff) { offset++; continue } // Marker fill bytes.
    if (marker === 0x01) { offset += 2; continue } // TEM has no length.
    // No dimensions before the scan/end, nested SOI or restart markers.
    if (marker < 0xc0 || marker === 0xda || (marker >= 0xd0 && marker <= 0xd9)) invalidHeader()
    if (index + 4 > bytes.length) invalidHeader()
    const length = view.getUint16(index + 2)
    if (length < 2 || offset + 2 + length > file.size) invalidHeader()
    // All SOF markers, excluding DHT, JPG and DAC, which also occupy C0..CF.
    const isFrame = marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrame) {
      if (length < 8 || index + 10 > bytes.length) invalidHeader()
      const components = view.getUint8(index + 9)
      if (components === 0 || length !== 8 + 3 * components) invalidHeader()
      // A zero height (deferred DNL) cannot be budgeted before decoding.
      return { width: view.getUint16(index + 7), height: view.getUint16(index + 5) }
    }
    offset += 2 + length
  }
  return invalidHeader()
}
