export const TEXT_SIZES = [100, 125, 150, 200] as const
export type TextSize = typeof TEXT_SIZES[number]
export type MotionPreference = 'system' | 'reduce'
export interface AccessibilityPreferences { textSize: TextSize; highContrast: boolean; motion: MotionPreference }

export function defaultAccessibilityPreferences(): AccessibilityPreferences {
  return { textSize: 100, highContrast: false, motion: 'system' }
}

export function validateAccessibilityPreferences(value: unknown): AccessibilityPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 3 || !('textSize' in value) || !('highContrast' in value) || !('motion' in value)
    || !TEXT_SIZES.some(size => size === value.textSize) || typeof value.highContrast !== 'boolean'
    || (value.motion !== 'system' && value.motion !== 'reduce')) throw new Error('La configuración de accesibilidad no es válida.')
  return { textSize: value.textSize as TextSize, highContrast: value.highContrast, motion: value.motion }
}
