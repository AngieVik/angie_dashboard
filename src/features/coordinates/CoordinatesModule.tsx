import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup } from '@/components/ui/input-group'

import { toast } from '@/components/ui/sonner'
import { Check, ClipboardPaste, Trash } from 'lucide-react'
import { RadarButton } from './RadarButton'
import type { RadarControl } from './RadarButton'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { copyText } from '../../platform/clipboard'
import { COORDINATE_INPUT_LENGTH_ERROR, MAX_COORDINATE_INPUT_LENGTH, parseCoordinate } from './parseCoordinate'
import { convertCoordinate, toGeographic } from './convertCoordinate'
import { createGoogleMapsLink } from './googleMapsLink'
import type { GeographicCoordinate } from './coordinateTypes'
import styles from './coordinates.module.css'

export function CoordinatesModule({ generation = 0, selectedCoordinate, onInputChange, radar }: { generation?: number; selectedCoordinate?: GeographicCoordinate; onInputChange?: (input: string, point: GeographicCoordinate | null) => void; radar: RadarControl }) {
  const id = useId(), revision = useRef(0)
  const noticeId = id + '-clipboard'
  const { blocked, blockedRef } = useViewportInteraction()
  const selectedInput = selectedCoordinate ? `${selectedCoordinate.latitude.toFixed(6)}, ${selectedCoordinate.longitude.toFixed(6)}` : ''
  const [entry, setEntry] = useState({ selection: selectedCoordinate, input: '', generation, automatic: false })
  const input = entry.input
  const automatic = radar.active
  const receivedCoordinate = automatic ? selectedCoordinate : undefined
  const baselineClipboard = useRef<(() => void) | null>(null)
  const [error, setError] = useValidationNotice(null, generation)
  const setInput = (input: string) => {
    if (input.length > MAX_COORDINATE_INPUT_LENGTH) { setError(COORDINATE_INPUT_LENGTH_ERROR); return }
    setEntry(current => ({ ...current, input })); setError(null)
  }
  if (entry.generation !== generation) {
    setEntry({ selection: selectedCoordinate, input: '', generation, automatic })
    setError(null)
  } else if (entry.selection !== selectedCoordinate || entry.automatic !== automatic) {
    setEntry({ ...entry, selection: selectedCoordinate, automatic, input: automatic && selectedCoordinate ? selectedInput : input })
    if (automatic && selectedCoordinate) setError(null)
  }
  const result = useMemo(() => {
    const parsed = parseCoordinate(input)
    if (!parsed.ok) return null
    const dd = toGeographic(parsed.coordinate)
    return { coordinate: dd, conversions: (['DD', 'DMS', 'DMM', 'UTM'] as const).map(format => convertCoordinate(parsed.coordinate, format)),
      link: createGoogleMapsLink(dd.latitude, dd.longitude) }
  }, [input])
  // Selection changes and edits invalidate clipboard operations still in flight.
  useLayoutEffect(() => { revision.current++ }, [generation, automatic, receivedCoordinate, input])
  useLayoutEffect(() => { if (receivedCoordinate) baselineClipboard.current?.() }, [receivedCoordinate])
  useLayoutEffect(() => { onInputChange?.(input, result?.coordinate ?? null) }, [input, result, automatic, onInputChange])
  useEffect(() => () => { toast.dismiss(noticeId); revision.current++ }, [generation, noticeId])
  useEffect(() => {
    if (!automatic) return
    let cancelled = false, reading = false, unavailable = false
    let previous: string | undefined
    async function readClipboard(accept = true) {
      if (cancelled || reading || unavailable || blockedRef.current || document.visibilityState !== 'visible' || !document.hasFocus()) return
      reading = true
      const current = revision.current
      try {
        const value = await navigator.clipboard.readText()
        if (cancelled) return
        const changed = value !== previous
        previous = value
        if (!accept || !changed || current !== revision.current || blockedRef.current) return
        if (value.length > MAX_COORDINATE_INPUT_LENGTH) { setError(COORDINATE_INPUT_LENGTH_ERROR); return }
        if (!parseCoordinate(value).ok) return
        revision.current++
        setEntry(entry => ({ ...entry, input: value })); setError(null)
      } catch {
        if (!cancelled) {
          unavailable = true
          if (current === revision.current) toast.error('No se pudo leer el portapapeles.', { id: noticeId })
        }
      } finally { reading = false }
    }
    const baseline = () => { void readClipboard(false) }
    baselineClipboard.current = baseline
    const refresh = () => { void readClipboard() }
    const clipboardChanged = () => { previous = undefined; refresh() }
    const pasted = (event: ClipboardEvent) => {
      const value = event.clipboardData?.getData('text/plain')
      if (blockedRef.current || !value) return
      if (value.length > MAX_COORDINATE_INPUT_LENGTH) {
        if (event.target instanceof HTMLElement && event.target.id === id + '-input') event.preventDefault()
        setError(COORDINATE_INPUT_LENGTH_ERROR)
        return
      }
      if (!parseCoordinate(value).ok) return
      if (event.target instanceof HTMLElement && event.target.id === id + '-input') event.preventDefault()
      previous = value
      revision.current++
      setEntry(entry => ({ ...entry, input: value })); setError(null)
    }
    refresh()
    const timer = setInterval(refresh, 750)
    window.addEventListener('focus', refresh)
    navigator.clipboard?.addEventListener('clipboardchange', clipboardChanged)
    document.addEventListener('visibilitychange', refresh)
    document.addEventListener('paste', pasted)
    return () => {
      cancelled = true
      if (baselineClipboard.current === baseline) baselineClipboard.current = null
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      navigator.clipboard?.removeEventListener('clipboardchange', clipboardChanged)
      document.removeEventListener('visibilitychange', refresh)
      document.removeEventListener('paste', pasted)
    }
  }, [automatic, generation, blockedRef, setError, id, noticeId])
  function toggleAutomatic() {
    if (blockedRef.current) return
    revision.current++; setError(null)
    radar.onToggle()
  }
  function convert() {
    if (blockedRef.current) return
    revision.current++
    const parsed = parseCoordinate(input)
    if (!parsed.ok) { setError(input.length > MAX_COORDINATE_INPUT_LENGTH ? parsed.error : 'No se reconoce la latitud y longitud'); return }
    setInput(parsed.normalizedInput)
    const unavailable = (['DD', 'DMS', 'DMM', 'UTM'] as const).map(format => convertCoordinate(parsed.coordinate, format)).find(result => !result.ok)
    if (unavailable && !unavailable.ok) toast.error(unavailable.error, { id: noticeId })
  }
  function clear() {
    if (blockedRef.current) return
    revision.current++
    setInput('')
  }
  async function paste() {
    if (blockedRef.current) return
    const current = ++revision.current
    try {
      const value = await navigator.clipboard.readText()
      if (blockedRef.current || current !== revision.current) return
      setInput(value)
    } catch {
      if (!blockedRef.current && current === revision.current) toast.error('No se pudo pegar. Pega las coordenadas manualmente.', { id: noticeId })
    }
  }
  async function copyRow(value: string | null) {
    if (blockedRef.current || value === null) return
    const current = ++revision.current
    const copied = await copyText(value)
    if (current !== revision.current) return
    if (!(copied)) toast.error('No se pudo copiar.', { id: noticeId })
  }
  const rows = (['DD', 'DMS', 'DMM', 'UTM'] as const).map(format => {
    const conversion = result?.conversions.find(item => item.format === format)
    return { format: format as string, value: conversion?.ok ? conversion.text : null }
  })
  rows.push({ format: 'Maps', value: result?.link ?? null })
  return <div data-slot="coordinates-module" className={`${styles.base} coordinates-module`}>
    <form onSubmit={event => { event.preventDefault(); convert() }}>
      <InputGroup>
        <Input id={id + '-input'} aria-label="Coordenadas" className="technical-data" value={input} disabled={blocked}
          inputBudget={{ limit: MAX_COORDINATE_INPUT_LENGTH, path: 'Coordenadas', onReject: setError }}
          aria-invalid={Boolean(error)} spellCheck={false} autoComplete="off"
          onChange={event => {
            if (blockedRef.current) return
            revision.current++
            setInput(event.target.value)
          }} />
        <Button appearance="integrated" aria-label="Validar coordenadas y mostrar formatos" disabled={blocked} onClick={convert}><Check aria-hidden="true" /></Button>
        <RadarButton active={automatic} onToggle={toggleAutomatic} disabled={blocked} />
        <Button appearance="integrated" aria-label="Pegar coordenadas" disabled={blocked} onClick={() => { void paste() }}><ClipboardPaste aria-hidden="true" /></Button>
        <Button appearance="integrated" aria-label="Borrar coordenadas" disabled={blocked} onClick={clear}><Trash aria-hidden="true" /></Button>
      </InputGroup>

    </form>
    <dl className="coordinates-results">
      {rows.map(row => {
        const available = row.value !== null
        return <div key={row.format} role={available ? 'button' : undefined}
          tabIndex={available && !blocked ? 0 : undefined} aria-label={available ? 'Copiar ' + row.format : undefined}
          aria-disabled={available ? blocked : undefined} onClick={() => { void copyRow(row.value) }}
          onKeyDown={event => {
            if (available && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); void copyRow(row.value) }
          }}>
          <dt>{row.format}</dt>
          <dd className="technical-data" aria-label={'Resultado ' + row.format}>
            <span className="coordinates-value">{row.format === 'Maps' && row.value ? 'www.google.com/maps/...' : row.value ?? '—'}</span>
          </dd>
        </div>
      })}
    </dl>
  </div>
}
