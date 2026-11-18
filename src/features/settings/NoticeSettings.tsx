import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { NoticeHistoryDialog } from '../notices/NoticeHistoryDialog'
import { NOTICE_LEVELS, NOTICE_LEVEL_LABELS, NOTICE_DURATION_MIN, NOTICE_DURATION_MAX } from '../notices/noticePreferences'
import type { NoticePreferences } from '../notices/noticePreferences'
import { noticeHistoryStore } from '../notices/noticeHistoryStore'
import { noticeOptions, noticeOptionChecked, noticeOptionText, noticeGroupChecked, selectNoticeGroup, selectNoticeOption } from './noticeSelection'
import type { NoticeOption } from './noticeSelection'
import type { SettingsStore } from './settingsStore'
import styles from './settings.module.css'

export function NoticeSettings({ store }: { store: SettingsStore }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const history = useSyncExternalStore(noticeHistoryStore.subscribe, noticeHistoryStore.getSnapshot)
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyButton = useRef<HTMLButtonElement>(null)
  const duration = snapshot.numberDrafts.noticeDuration ?? null
  const setDuration = (value: string | null) => store.setNumberDraft('noticeDuration', value)
  const disabled = !snapshot.ready || snapshot.loading || snapshot.saving
  const preferences = snapshot.settings.notices
  const messages = useMemo(() => noticeOptions(preferences, history), [preferences, history])
  function saveDuration() {
    if (!disabled) store.commitNumberDraft('noticeDuration')
  }
  return <div className={styles.general}>
    <fieldset>
      <legend>Menú de avisos</legend>
      <RadioGroup className={styles.noticeOptions} aria-label="Mostrar menú de avisos" disabled={disabled}
        value={snapshot.settings.noticesAlwaysVisible ? 'always' : 'pending'} onValueChange={value => {
          if (!disabled && (value === 'always' || value === 'pending')) void store.updateGeneral({ noticesAlwaysVisible: value === 'always' })
        }}>
        <label><RadioGroupItem value="always" />Siempre</label>
        <label><RadioGroupItem value="pending" />Solo cuando haya un aviso</label>
      </RadioGroup>
      <Button ref={historyButton} className={styles.historyButton} onClick={() => setHistoryOpen(true)}>Registro</Button>
    </fieldset>
    <fieldset disabled={disabled}>
      <legend>Duración</legend>
      <label className={styles.noticeDuration}>Segundos
        <Input type="number" inputMode="numeric" aria-label="Duración de los avisos en segundos" min={NOTICE_DURATION_MIN} max={NOTICE_DURATION_MAX} step={1}
          disabled={disabled} value={duration ?? preferences.duration} onChange={event => setDuration(event.target.value)} onBlur={saveDuration}
          onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); saveDuration() }
            if (event.key === 'Escape' && duration !== null) { event.preventDefault(); event.stopPropagation(); setDuration(null) }
          }} />
      </label>
    </fieldset>
    <fieldset disabled={disabled}>
      <legend>Niveles que mostrar</legend>
      <div className={styles.noticeLevels}>
        {NOTICE_LEVELS.map(level => <label key={level}><Checkbox checked={noticeGroupChecked(preferences, messages, level)} disabled={disabled}
          onCheckedChange={checked => {
            if (!disabled) void store.updateNotices(selectNoticeGroup(preferences, messages, level, checked))
          }} />{NOTICE_LEVEL_LABELS[level]}</label>)}
      </div>
    </fieldset>
    <fieldset disabled={disabled}>
      <legend>Lista de avisos</legend>
      <div className={styles.noticeMessages}>
        {messages.map(option => <NoticeMessageSetting key={option.original} option={option} options={messages}
          store={store} preferences={preferences} disabled={disabled} />)}
      </div>
    </fieldset>
    {historyOpen && <NoticeHistoryDialog onClose={() => setHistoryOpen(false)} onCloseFocus={() => historyButton.current?.focus()} />}
  </div>
}

function NoticeMessageSetting({ option, options, store, preferences, disabled }: {
  option: NoticeOption; options: readonly NoticeOption[]; store: SettingsStore; preferences: NoticePreferences; disabled: boolean
}) {
  return <label className={styles.noticeMessage}><Checkbox checked={noticeOptionChecked(preferences, option)} disabled={disabled} onCheckedChange={checked => {
    if (!disabled) void store.updateNotices(selectNoticeOption(preferences, options, option, checked))
  }} /><span>{noticeOptionText(preferences, option)}</span></label>
}
