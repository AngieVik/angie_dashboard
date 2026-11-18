import { toast as sonnerToast } from 'sonner'
import type { ExternalToast } from 'sonner'
import { noticeHistoryStore } from '@/features/notices/noticeHistoryStore'
import { NOTICE_LEVELS, noticeEnabled, noticeText } from '@/features/notices/noticePreferences'
import type { NoticeId, NoticeLevel } from '@/features/notices/noticePreferences'
import { getSettingsStore } from '@/features/settings/settingsStore'

type NoticeOptions = ExternalToast & { notice?: NoticeId; requiredAction?: boolean }
type NoticeMethod = (message: Parameters<typeof sonnerToast>[0], options?: NoticeOptions) => string | number
type AppToast = Omit<typeof sonnerToast, NoticeLevel> & NoticeMethod & Record<NoticeLevel, NoticeMethod>
let hiddenSequence = 0

function show(level: NoticeLevel, message: Parameters<typeof sonnerToast>[0], options: NoticeOptions = {}) {
  const { notice, requiredAction = false, ...data } = options
  const preferences = getSettingsStore().getSnapshot().settings.notices
  const text = !requiredAction && notice && typeof message === 'string' ? noticeText(preferences, notice, message) : message
  // History remains available even when a popup or its level has been disabled.
  noticeHistoryStore.record(text, level, undefined, message, notice)
  if (!requiredAction && !(notice ? noticeEnabled(preferences, notice, level, typeof message === 'string' ? message : undefined) : preferences.levels.includes(level))) {
    if (data.id !== undefined) sonnerToast.dismiss(data.id)
    return data.id ?? `hidden-notice-${++hiddenSequence}`
  }
  return sonnerToast[level](text, { ...data, duration: requiredAction ? Infinity : preferences.duration * 1000,
    ...(requiredAction ? { dismissible: false, closeButton: false } : {}) })
}

// Keep the shared API, including dismiss, while applying saved notice preferences.
export const toast = new Proxy(sonnerToast, {
  apply(_target, _receiver, args) {
    return show('message', args[0], args[1])
  },
  get(target, property, receiver) {
    const method = Reflect.get(target, property, receiver)
    if (!NOTICE_LEVELS.some(level => level === property)) return method
    return (message: Parameters<NoticeMethod>[0], options?: NoticeOptions) => show(property as NoticeLevel, message, options)
  },
}) as AppToast
