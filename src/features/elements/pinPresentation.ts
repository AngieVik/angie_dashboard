import type { CSSProperties } from 'react'
import type { DocumentElement, ElementVisual, PinNameColor } from '../../domain/document/types'
import { getPinBox } from './iconCatalog'

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
