import { useLayoutEffect, useSyncExternalStore } from 'react'
import type { AccessibilityPreferences, MotionPreference } from './accessibilityPreferences'

const motionQuery = '(prefers-reduced-motion: reduce)'
function subscribeMotion(listener: () => void) {
  const media = window.matchMedia(motionQuery)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
const systemReducedMotion = () => window.matchMedia(motionQuery).matches

export function useReducedMotion(motion: MotionPreference) {
  const system = useSyncExternalStore(subscribeMotion, systemReducedMotion, () => false)
  return motion === 'reduce' || system
}

export function useAccessibilityPreferences(preferences: AccessibilityPreferences) {
  const reducedMotion = useReducedMotion(preferences.motion)
  const { textSize, highContrast } = preferences
  useLayoutEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--accessibility-text-scale', String(textSize / 100))
    root.dataset.textSize = String(textSize)
    root.dataset.highContrast = String(highContrast)
    root.dataset.reducedMotion = String(reducedMotion)
    return () => {
      root.style.removeProperty('--accessibility-text-scale')
      delete root.dataset.textSize
      delete root.dataset.highContrast
      delete root.dataset.reducedMotion
    }
  }, [textSize, highContrast, reducedMotion])
}
