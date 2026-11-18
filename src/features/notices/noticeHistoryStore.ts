import type { NoticeLevel } from './noticePreferences'
export type { NoticeLevel } from './noticePreferences'
export interface NoticeHistoryEntry { id: number; at: number; message: string; original: string; notice?: string; level: NoticeLevel }
// Session-only, bounded independently of the document and local preferences.
export const NOTICE_HISTORY_LIMIT = 200
let entries: readonly NoticeHistoryEntry[] = []
let sequence = 0
const listeners = new Set<() => void>()
const activeMessages = new Map<string | number, string>()

export const noticeHistoryStore = {
  getSnapshot: () => entries,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  record(message: unknown, level: NoticeLevel = 'message', source?: string | number, original = message, notice?: string) {
    if (typeof message !== 'string' || !message.trim()) return
    if (source !== undefined) {
      if (activeMessages.get(source) === message) return
      activeMessages.set(source, message)
      if (activeMessages.size > NOTICE_HISTORY_LIMIT) activeMessages.delete(activeMessages.keys().next().value!)
    }
    entries = [{ id: ++sequence, at: Date.now(), message, original: typeof original === 'string' ? original : message, notice, level }, ...entries].slice(0, NOTICE_HISTORY_LIMIT)
    listeners.forEach(listener => listener())
  },
  release(source?: string | number) { if (source === undefined) activeMessages.clear(); else activeMessages.delete(source) },
}
