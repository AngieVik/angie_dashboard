import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { DrawingImage, Position } from '@/domain/document/types'
import { Button } from '@/components/ui/button'
import { Crop, FlipHorizontal2, FlipVertical2, Move, RotateCw, Trash2 } from 'lucide-react'
import { loadBoardImage } from '../board/imageLoader'
import type { Projection } from './shapeGeometry'
import styles from './drawing.module.css'

export type ImageMode = 'move' | 'crop' | 'rotate'
export interface ImageActions { insert: (file: File) => void }
const pixels = new WeakMap<DrawingImage['source'], Blob>()
const corners = ['nw', 'ne', 'se', 'sw'] as const

// Inserting is on the toolbar; these tools edit the selected image.
export function ImageTools({ mode, setMode, selected, remove }: {
  mode: ImageMode; setMode: (value: ImageMode) => void; selected: boolean; remove: () => void
}) {
  return <>
    {selected && <div className={styles.actions} role="group" aria-label="Editar imagen">
      {([['move', 'Mover y redimensionar', Move], ['crop', 'Recortar', Crop], ['rotate', 'Girar y voltear', RotateCw]] as const).map(([id, title, Icon]) =>
        <Button key={id} disabled={!selected} aria-label={title} title={title} aria-pressed={selected && mode === id} onClick={() => setMode(id)}><Icon /></Button>)}
      <Button aria-label="Borrar imagen" title="Borrar imagen" onClick={remove}><Trash2 /></Button>
    </div>}
  </>
}

function ImagePixels({ source }: { source: DrawingImage['source'] }) {
  const element = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const blob = pixels.get(source), node = element.current
    if (!blob || !node) return
    const url = URL.createObjectURL(blob); node.src = url
    return () => URL.revokeObjectURL(url)
  }, [source])
  return <img draggable={false} ref={element} alt={source.name} />
}
export function DrawingImages({ images, selected, select, enabled, mode, actions, projection, save, warn }: {
  images: DrawingImage[]; selected: string | null; select: (id: string) => void; enabled: boolean; mode: ImageMode
  actions: Ref<ImageActions>; projection: Projection; save: (items: DrawingImage[]) => boolean; warn: (message: string) => void
}) {
  const root = useRef<HTMLDivElement>(null), pending = useRef(false)
  const latest = useRef({ images, save, select, projection })
  useEffect(() => { latest.current = { images, save, select, projection } }, [images, save, select, projection])
  const [preview, setPreview] = useState<DrawingImage | null>(null)
  const drag = useRef<{ id: number; image: DrawingImage; start: Position; action: string; next: DrawingImage } | null>(null)
  useImperativeHandle(actions, () => ({ async insert(file) {
    if (pending.current) return
    pending.current = true
    try {
      const decoded = await loadBoardImage(file)
      if (!decoded.success) throw new Error(decoded.message)
      let blob: Blob
      try {
        const canvas = document.createElement('canvas')
        canvas.width = decoded.width; canvas.height = decoded.height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('No se pudo preparar la imagen.')
        context.drawImage(decoded.image, 0, 0)
        blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo preparar la imagen.')), 'image/png'))
      } finally { decoded.dispose() }
      const node = root.current
      if (!node) return
      const { projection, images, save, select } = latest.current
      const factor = Math.min(1, node.clientWidth / decoded.width, node.clientHeight / decoded.height) * .8
      if (factor <= 0) return
      const dx = factor * decoded.width / 2, dy = factor * decoded.height / 2, x = node.clientWidth / 2, y = node.clientHeight / 2
      const item: DrawingImage = { id: crypto.randomUUID(), source: { name: file.name }, rotation: 0, flipX: false, flipY: false,
        corners: [projection.world({ x: x - dx, y: y - dy }), projection.world({ x: x + dx, y: y + dy })], crop: { left: 0, top: 0, right: 0, bottom: 0 } }
      pixels.set(item.source, blob)
      if (save([...images, item])) select(item.id)
    } catch (error) { if (root.current) warn(error instanceof Error ? error.message : 'No se pudo insertar la imagen.') }
    finally { pending.current = false }
  } }))
  function local(e: React.PointerEvent) {
    const node = root.current!, rect = node.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * node.clientWidth / rect.width, y: (e.clientY - rect.top) * node.clientHeight / rect.height }
  }
  function move(e: React.PointerEvent) {
    const g = drag.current
    if (!g || g.id !== e.pointerId || !enabled) return
    const p = local(e), dx = p.x - g.start.x, dy = p.y - g.start.y
    const base = g.image, a = projection.screen(base.corners[0]), b = projection.screen(base.corners[1])
    const item = { ...base }, action = g.action
    if (action === 'move') item.corners = [projection.world({ x: a.x + dx, y: a.y + dy }), projection.world({ x: b.x + dx, y: b.y + dy })]
    else if (action === 'rotate') {
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2
      item.rotation += (Math.atan2(p.y - cy, p.x - cx) - Math.atan2(g.start.y - cy, g.start.x - cx)) * 180 / Math.PI
    } else {
      const angle = base.rotation * Math.PI / 180
      const x = dx * Math.cos(angle) + dy * Math.sin(angle), y = dy * Math.cos(angle) - dx * Math.sin(angle)
      const west = action.includes('w'), north = action.includes('n'), w = Math.max(1, b.x - a.x), h = Math.max(1, b.y - a.y)
      if (mode === 'crop') {
        const crop = { ...base.crop }
        if (west) crop.left = Math.max(0, Math.min(.98 - crop.right, crop.left + x / w))
        else crop.right = Math.max(0, Math.min(.98 - crop.left, crop.right - x / w))
        if (north) crop.top = Math.max(0, Math.min(.98 - crop.bottom, crop.top + y / h))
        else crop.bottom = Math.max(0, Math.min(.98 - crop.top, crop.bottom - y / h))
        item.crop = crop
      } else {
        const nw = Math.max(8, w + (west ? -x : x)), nh = Math.max(8, h + (north ? -y : y))
        const tx = (nw - w) / 2 * (west ? -1 : 1), ty = (nh - h) / 2 * (north ? -1 : 1)
        const cx = (a.x + b.x) / 2 + tx * Math.cos(angle) - ty * Math.sin(angle), cy = (a.y + b.y) / 2 + tx * Math.sin(angle) + ty * Math.cos(angle)
        item.corners = [projection.world({ x: cx - nw / 2, y: cy - nh / 2 }), projection.world({ x: cx + nw / 2, y: cy + nh / 2 })]
      }
    }
    g.next = item; setPreview(item)
  }
  return <div className={styles.images} ref={root}>{images.map(base => {
    const item = enabled && preview?.id === base.id ? preview : base
    const a = projection.screen(item.corners[0]), b = projection.screen(item.corners[1]), crop = item.crop
    const active = selected === item.id && enabled
    const flip = (key: 'flipX' | 'flipY') => save(images.map(image => image.id === base.id ? { ...image, [key]: !image[key] } : image))
    return <div key={base.id} data-drawing-image data-selected={active} className={styles.image} style={{ left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y,
      transform: 'rotate(' + item.rotation + 'deg)', pointerEvents: enabled ? 'auto' : 'none' }} onPointerDown={e => {
      if (!enabled || !e.isPrimary || e.button !== 0 || (e.target as Element).closest('[data-flip]')) return
      e.preventDefault(); e.stopPropagation(); select(item.id)
      const action = (e.target as HTMLElement).dataset.action ?? 'move'
      if (action === 'move' && active && mode !== 'move') return
      drag.current = { id: e.pointerId, image: base, start: local(e), action, next: base }; e.currentTarget.setPointerCapture(e.pointerId)
    }} onPointerMove={move} onPointerUp={e => {
      const g = drag.current
      if (g?.id !== e.pointerId) return
      e.stopPropagation(); drag.current = null; setPreview(null)
      if (enabled && g.image !== g.next) save(images.map(image => image === base ? g.next : image))
    }} onLostPointerCapture={() => { drag.current = null; setPreview(null) }}>
      <div className={styles.imagePixels} style={{ clipPath: 'inset(' + [crop.top, crop.right, crop.bottom, crop.left].map(n => n * 100 + '%').join(' ') + ')' }}>
        <div style={{ transform: 'scale(' + (item.flipX ? -1 : 1) + ',' + (item.flipY ? -1 : 1) + ')' }}><ImagePixels source={item.source} /></div>
      </div>
      {active && mode !== 'rotate' && corners.map(c => <button type="button" key={c} className={styles.handle} data-action={c}
        aria-label={(mode === 'crop' ? 'Recortar ' : 'Redimensionar ') + c}
        style={{ left: (c.includes('w') ? crop.left : 1 - crop.right) * 100 + '%', top: (c.includes('n') ? crop.top : 1 - crop.bottom) * 100 + '%' }} />)}
      {active && mode === 'rotate' && <>{[0, 100].map(side => <button type="button" key={side} className={styles.handle} style={{ left: side + '%', top: '50%' }} aria-label="Girar imagen" data-action="rotate" />)}
        <div className={styles.flip}>
          <Button data-flip aria-label="Voltear horizontal" title="Voltear horizontal" aria-pressed={item.flipX} onClick={() => flip('flipX')}><FlipHorizontal2 /></Button>
          <Button data-flip aria-label="Voltear vertical" title="Voltear vertical" aria-pressed={item.flipY} onClick={() => flip('flipY')}><FlipVertical2 /></Button>
        </div></>}
    </div>
  })}</div>
}

