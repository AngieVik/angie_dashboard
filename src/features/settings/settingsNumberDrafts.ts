import type { AppSettings } from './appSettings'
import { MAGNET_DISTANCE_MAX, MAGNET_DISTANCE_MIN } from '@/layout/magnetSettings'
import { VIEWPORT_ZOOM_MAX, VIEWPORT_ZOOM_MIN, ZOOM_STEP_DEFAULT, ZOOM_STEP_MAX } from '@/layout/viewportMath'
import { NOTICE_DURATION_MAX, NOTICE_DURATION_MIN } from '../notices/noticePreferences'

export type SettingsNumberKey = 'initialZoom' | 'zoomStep' | 'magnetDistance' | 'noticeDuration'
export type SettingsNumberDrafts = Partial<Record<SettingsNumberKey, string>>

export function applySettingsNumberDrafts(settings: AppSettings, drafts: SettingsNumberDrafts): AppSettings {
  const next = { ...settings, notices: { ...settings.notices } }
  for (const [key, text] of Object.entries(drafts)) {
    if (!text.trim() || !Number.isFinite(Number(text))) continue
    const value = Number(text)
    if (key === 'initialZoom') next.initialZoom = Math.min(VIEWPORT_ZOOM_MAX, Math.max(VIEWPORT_ZOOM_MIN, value / 100))
    else if (key === 'zoomStep') next.zoomStep = Math.min(ZOOM_STEP_MAX, Math.max(ZOOM_STEP_DEFAULT, Math.round(value)))
    else if (key === 'magnetDistance') next.magnetDistance = Math.min(MAGNET_DISTANCE_MAX, Math.max(MAGNET_DISTANCE_MIN, Math.round(value)))
    else if (key === 'noticeDuration') next.notices.duration = Math.min(NOTICE_DURATION_MAX, Math.max(NOTICE_DURATION_MIN, Math.round(value)))
  }
  return next
}
