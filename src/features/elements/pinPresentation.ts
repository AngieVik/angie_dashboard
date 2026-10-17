import type { CSSProperties } from 'react'
import type { DocumentElement, ElementVisual, PinAnchor, PinNameColor, Position } from '../../domain/document/types'
import { getPinBox } from './iconCatalog'

export const PIN_ANCHORS: readonly { value: Exclude<PinAnchor, Position>; label: string; x: number; y: number }[] = [
  { value: 'top-left', label: 'Superior izquierdo', x: 0, y: 0 },
  { value: 'top', label: 'Superior central', x: .5, y: 0 },
  { value: 'top-right', label: 'Superior derecho', x: 1, y: 0 },
  { value: 'left', label: 'Centro izquierdo', x: 0, y: .5 },
  { value: 'center', label: 'Centro', x: .5, y: .5 },
  { value: 'right', label: 'Centro derecho', x: 1, y: .5 },
  { value: 'bottom-left', label: 'Inferior izquierdo', x: 0, y: 1 },
  { value: 'bottom', label: 'Inferior central', x: .5, y: 1 },
  { value: 'bottom-right', label: 'Inferior derecho', x: 1, y: 1 },
]

export function getPinAnchorPoint(visual: ElementVisual, anchor: PinAnchor = 'center') {
  const point = typeof anchor === 'string' ? PIN_ANCHORS.find(point => point.value === anchor) ?? PIN_ANCHORS[4]! : anchor
  const box = getPinBox(visual), angle = (visual.rotation ?? 0) * Math.PI / 180
  const x = (point.x - .5) * box.width * (visual.flipX ? -1 : 1)
  const y = (point.y - .5) * box.height * (visual.flipY ? -1 : 1)
  return { x: box.width / 2 + x * Math.cos(angle) - y * Math.sin(angle),
    y: box.height / 2 + x * Math.sin(angle) + y * Math.cos(angle) }
}

export function getPinAnchorFromPoint(visual: ElementVisual, point: Position): Position {
  const box = getPinBox(visual), angle = (visual.rotation ?? 0) * Math.PI / 180
  const x = point.x - box.width / 2, y = point.y - box.height / 2
  // Undo rotation and flips to store a proportional point in the original pin.
  return { x: Math.max(0, Math.min(1, .5 + (x * Math.cos(angle) + y * Math.sin(angle)) * (visual.flipX ? -1 : 1) / box.width)),
    y: Math.max(0, Math.min(1, .5 + (-x * Math.sin(angle) + y * Math.cos(angle)) * (visual.flipY ? -1 : 1) / box.height)) }
}

export const PIN_NAME_COLORS: Record<PinNameColor, { label: string; backgroundColor: string; color: string }> = {
  dark: { label: 'Negro / blanco', backgroundColor: '#111111', color: '#ffffff' },
  light: { label: 'Blanco / negro', backgroundColor: '#ffffff', color: '#111111' },
  yellow: { label: 'Amarillo / negro', backgroundColor: '#fde047', color: '#111111' },
  blue: { label: 'Azul / blanco', backgroundColor: '#1e40af', color: '#ffffff' },
  green: { label: 'Verde / blanco', backgroundColor: '#166534', color: '#ffffff' },
  red: { label: 'Rojo / blanco', backgroundColor: '#991b1b', color: '#ffffff' },
}

export function pinTransform(visual: ElementVisual) {
  return `rotate(${visual.rotation ?? 0}deg) scale(${visual.flipX ? -1 : 1}, ${visual.flipY ? -1 : 1})`
}

export function getRotatedPinBox(visual: ElementVisual) {
  const box = getPinBox(visual), angle = (visual.rotation ?? 0) * Math.PI / 180
  const cos = Math.round(Math.abs(Math.cos(angle)) * 1e12) / 1e12, sin = Math.round(Math.abs(Math.sin(angle)) * 1e12) / 1e12
  return { width: box.width * cos + box.height * sin, height: box.width * sin + box.height * cos }
}

export function pinNameLines(name: string) {
  const characters = [...name.replace(/[\r\n]+/g, ' ')]
  return [characters.slice(0, 9).join(''), ...(characters.length > 9 ? [characters.slice(9, 18).join('')] : [])]
}

type PinNameElement = Pick<DocumentElement, 'visual' | 'nameFontSize' | 'nameOffset' | 'nameColor'> & { name?: string }
export function getPinNameLayout(element: PinNameElement, measuredWidth?: number) {
  const box = getRotatedPinBox(element.visual), fontSize = element.nameFontSize ?? 16
  const height = fontSize * 1.25 * pinNameLines(element.name ?? '').length + 2 * element.visual.scale
  const width = measuredWidth ?? 200 * element.visual.scale
  const offset = element.nameOffset ?? { x: 0, y: box.height / 2 + 6 + height / 2 }
  return { width, height, offset }
}

export function pinNameStyle(element: PinNameElement): CSSProperties {
  const box = getPinBox(element.visual), { offset, width } = getPinNameLayout(element)
  const theme = PIN_NAME_COLORS[element.nameColor ?? 'dark']
  return { left: box.width / 2 + offset.x, top: box.height / 2 + offset.y, transform: 'translate(-50%, -50%)',
    fontSize: element.nameFontSize ?? 16, lineHeight: `${(element.nameFontSize ?? 16) * 1.25}px`,
    maxWidth: width, padding: `${element.visual.scale}px ${4 * element.visual.scale}px`,
    backgroundColor: theme.backgroundColor, color: theme.color }
}
