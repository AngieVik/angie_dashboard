import { NOTICE_CATALOG, NOTICE_LEVELS, noticeText } from '../notices/noticePreferences'
import type { NoticeId, NoticeLevel, NoticePreferences } from '../notices/noticePreferences'
import type { NoticeHistoryEntry } from '../notices/noticeHistoryStore'
import { NOTICE_MESSAGES } from '../notices/noticeMessages'

export interface NoticeOption { original: string; source?: NoticeId; levels: NoticeLevel[] }

export function noticeOptions(preferences: NoticePreferences, history: readonly NoticeHistoryEntry[]): NoticeOption[] {
  const list = new Map<string, { source?: NoticeId; levels: Set<NoticeLevel> }>()
  function add(original: string, levels: readonly NoticeLevel[], source?: NoticeId) {
    const current = list.get(original) ?? { levels: new Set<NoticeLevel>() }
    levels.forEach(level => current.levels.add(level))
    if (source) current.source = source
    list.set(original, current)
  }
  NOTICE_MESSAGES.forEach(message => add(message.text, message.levels))
  for (const [id, definition] of Object.entries(NOTICE_CATALOG)) {
    if (definition.text !== '{detalle}') add(definition.text, [definition.level], id as NoticeId)
  }
  for (const [original, saved] of Object.entries(preferences.messages)) {
    if (!Object.hasOwn(NOTICE_CATALOG, original)) add(original, saved.levels ?? (list.has(original) ? [] : ['error']))
  }
  for (const entry of [...history].reverse()) {
    const source = entry.notice && Object.hasOwn(NOTICE_CATALOG, entry.notice) ? entry.notice as NoticeId : undefined
    add(entry.original, [entry.level], source)
  }
  return [...list].sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([original, entry]) => ({ original, source: entry.source, levels: NOTICE_LEVELS.filter(level => entry.levels.has(level)) }))
}

function selected(preferences: NoticePreferences, option: NoticeOption) {
  const saved = Object.hasOwn(preferences.messages, option.original) ? preferences.messages[option.original] : undefined
  return saved?.enabled ?? (option.source ? preferences.messages[option.source]?.enabled : undefined) ?? true
}
export function noticeOptionText(preferences: NoticePreferences, option: NoticeOption) {
  if (option.source) return noticeText(preferences, option.source, option.original)
  return (Object.hasOwn(preferences.messages, option.original) ? preferences.messages[option.original]?.text : undefined) ?? option.original
}
export function noticeOptionChecked(preferences: NoticePreferences, option: NoticeOption) {
  return selected(preferences, option) && option.levels.some(level => preferences.levels.includes(level))
}
export function noticeGroupChecked(preferences: NoticePreferences, options: readonly NoticeOption[], level: NoticeLevel): boolean | 'indeterminate' {
  if (!preferences.levels.includes(level)) return false
  const group = options.filter(option => option.levels.includes(level))
  const count = group.filter(option => selected(preferences, option)).length
  return count === group.length ? true : count === 0 ? false : 'indeterminate'
}
function selection(preferences: NoticePreferences, option: NoticeOption, enabled: boolean) {
  return { enabled, text: noticeOptionText(preferences, option), levels: [...option.levels] }
}
export function selectNoticeGroup(preferences: NoticePreferences, options: readonly NoticeOption[], level: NoticeLevel, checked: boolean): NoticePreferences {
  const messages = { ...preferences.messages }
  for (const option of options) {
    if (option.levels.includes(level)) messages[option.original] = selection(preferences, option, checked)
  }
  // Preserve compatibility with preferences saved before selection was per message.
  for (const [id, definition] of Object.entries(NOTICE_CATALOG)) {
    if (definition.level === level && Object.hasOwn(messages, id)) messages[id] = { ...messages[id]!, enabled: checked }
  }
  return { ...preferences, messages, levels: NOTICE_LEVELS.filter(item => item === level ? checked : preferences.levels.includes(item)) }
}
export function selectNoticeOption(preferences: NoticePreferences, options: readonly NoticeOption[], option: NoticeOption, checked: boolean): NoticePreferences {
  const messages = { ...preferences.messages }
  const enabling = checked ? option.levels.filter(level => !preferences.levels.includes(level)) : []
  // Enabling one member of a disabled group keeps its other members unchecked.
  for (const other of options) {
    if (other.levels.some(level => enabling.includes(level)) && !noticeOptionChecked(preferences, other)) messages[other.original] = selection(preferences, other, false)
  }
  messages[option.original] = selection(preferences, option, checked)
  return { ...preferences, messages, levels: NOTICE_LEVELS.filter(level => preferences.levels.includes(level) || enabling.includes(level)) }
}
