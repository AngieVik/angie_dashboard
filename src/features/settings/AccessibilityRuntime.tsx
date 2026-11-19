import { useAccessibilityPreferences } from './useAccessibilityPreferences'
import { useSettings } from './useSettings'

// Root preferences must survive replacement of App by the recovery screen.
export function AccessibilityRuntime() {
  const { settings } = useSettings()
  useAccessibilityPreferences(settings.accessibility)
  return null
}
