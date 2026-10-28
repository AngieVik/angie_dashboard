import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup } from '@/components/ui/input-group'
import { HelpTooltip } from '@/components/ui/tooltip'
import { Check, ClipboardPaste, RadioTower, Trash } from 'lucide-react'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { copyText } from '../../platform/clipboard'
import { parseCoordinate } from './parseCoordinate'
import { convertCoordinate, toGeographic } from './convertCoordinate'
import { createGoogleMapsLink } from './googleMapsLink'
import type { GeographicCoordinate } from './coordinateTypes'
import styles from './coordinates.module.css'

export function CoordinatesModule({ generation = 0, selectedCoordinate, onInputChange }: { generation?: number; selectedCoordinate?: GeographicCoordinate; onInputChange?: (input: string) => void } = {}) {
  const id = useId(), revision = useRef(0)
  const { blocked, blockedRef } = useViewportInteraction()
  const selectedInput = selectedCoordinate ? `${selectedCoordinate.latitude.toFixed(6)}, ${selectedCoordinate.longitude.toFixed(6)}` : ''
  const [entry, setEntry] = useState({ selection: selectedCoordinate, input: '', generation, automatic: false })
  const input = entry.input
  const automatic = entry.generation === generation && entry.automatic
  const receivedCoordinate = automatic ? selectedCoordinate : undefined
  const baselineClipboard = useRef<(() => void) | null>(null)
  const setInput = (input: string) => setEntry(current => ({ ...current, input }))
  const [error, setError] = useValidationNotice(null, generation)
  const [copiedRow, setCopiedRow] = useState<{ format: string; message: string } | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  if (entry.generation !== generation) {
    setEntry({ selection: selectedCoordinate, input: '', generation, automatic: false })
    setCopiedRow(null); setError(null)
  } else if (entry.selection !== selectedCoordinate) {
    setEntry({ ...entry, selection: selectedCoordinate, input: automatic && selectedCoordinate ? selectedInput : input })
    if (automatic && selectedCoordinate) { setCopiedRow(null); setError(null) }
  }
  const result = useMemo(() => {
    const parsed = parseCoordinate(input)
    if (!parsed.ok) return null
    const dd = toGeographic(parsed.coordinate)
    return { conversions: (['DD', 'DMS', 'DMM', 'UTM'] as const).map(format => convertCoordinate(parsed.coordinate, format)),
      link: createGoogleMapsLink(dd.latitude, dd.longitude) }
  }, [input])
  // Selection changes and edits invalidate clipboard operations still in flight.
  useLayoutEffect(() => { revision.current++ }, [generation, automatic, receivedCoordinate, input])
  useLayoutEffect(() => { if (receivedCoordinate) baselineClipboard.current?.() }, [receivedCoordinate])
  useLayoutEffect(() => { onInputChange?.(input) }, [input, onInputChange])
  useEffect(() => () => { clearTimeout(copyTimer.current); revision.current++ }, [])
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
        if (!accept || !changed || current !== revision.current || blockedRef.current || !parseCoordinate(value).ok) return
        revision.current++
        clearTimeout(copyTimer.current); setCopiedRow(null)
        setEntry(entry => ({ ...entry, input: value })); setError(null)
      } catch {
        if (!cancelled) {
          unavailable = true
          if (current === revision.current) setError('No se pudo leer el portapapeles.')
        }
      } finally { reading = false }
    }
    const baseline = () => { void readClipboard(false) }
    baselineClipboard.current = baseline
    const refresh = () => { void readClipboard() }
    const clipboardChanged = () => { previous = undefined; refresh() }
    const pasted = (event: ClipboardEvent) => {
      const value = event.clipboardData?.getData('text/plain')
      if (blockedRef.current || !value || !parseCoordinate(value).ok) return
      if (event.target instanceof HTMLElement && event.target.id === id + '-input') event.preventDefault()
      previous = value
      revision.current++
      clearTimeout(copyTimer.current); setCopiedRow(null)
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
  }, [automatic, generation, blockedRef, setError, id])
  function clearCopy() { clearTimeout(copyTimer.current); setCopiedRow(null) }
  function toggleAutomatic() {
    if (blockedRef.current) return
    revision.current++; clearCopy(); setError(null)
    setEntry(current => ({ ...current, automatic: !current.automatic,
      input: !current.automatic && selectedCoordinate ? selectedInput : current.input }))
  }
  function convert() {
    if (blockedRef.current) return
    revision.current++; clearCopy()
    const parsed = parseCoordinate(input)
    if (!parsed.ok) { setError('No se reconoce la latitud y longitud'); return }
    setInput(parsed.normalizedInput); setError(null)
  }
  function clear() {
    if (blockedRef.current) return
    revision.current++; clearCopy()
    setInput(''); setError(null)
  }
  async function paste() {
    if (blockedRef.current) return
    clearCopy()
    const current = ++revision.current
    try {
      const value = await navigator.clipboard.readText()
      if (blockedRef.current || current !== revision.current) return
      setInput(value); setError(null)
    } catch {
      if (!blockedRef.current && current === revision.current) setError('No se pudo pegar. Pega las coordenadas manualmente.')
    }
  }
  async function copyRow(format: string, value: string | null) {
    if (blockedRef.current || value === null) return
    clearCopy()
    const current = ++revision.current
    const copied = await copyText(value)
    if (current !== revision.current) return
    setCopiedRow({ format, message: copied ? format === 'Maps' ? 'Enlace copiado' : 'Coordenada copiada' : 'No se pudo copiar.' })
    copyTimer.current = setTimeout(() => setCopiedRow(null), 3000)
  }
  const rows = (['DD', 'DMS', 'DMM', 'UTM'] as const).map(format => {
    const conversion = result?.conversions.find(item => item.format === format)
    return { format: format as string, value: conversion?.ok ? conversion.text : null, error: conversion && !conversion.ok ? conversion.error : '' }
  })
  rows.push({ format: 'Maps', value: result?.link ?? null, error: '' })
  return <div data-slot="coordinates-module" className={`${styles.base} coordinates-module`}>
    <form onSubmit={event => { event.preventDefault(); convert() }}>
      <InputGroup>
        <Input id={id + '-input'} aria-label="Coordenadas" className="technical-data" value={input} disabled={blocked}
          aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined} spellCheck={false} autoComplete="off"
          onChange={event => {
            if (blockedRef.current) return
            revision.current++; clearCopy()
            setInput(event.target.value); setError(null)
          }} />
        <HelpTooltip text="Validar coordenadas"><Button appearance="integrated" aria-label="Validar coordenadas y mostrar formatos" disabled={blocked} onClick={convert}><Check aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Recepción automática"><Button appearance="integrated" className="coordinates-receiver" aria-label="Recepción automática de coordenadas" aria-pressed={automatic} disabled={blocked} onClick={toggleAutomatic}><RadioTower aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Pegar coordenadas"><Button appearance="integrated" aria-label="Pegar coordenadas" disabled={blocked} onClick={() => { void paste() }}><ClipboardPaste aria-hidden="true" /></Button></HelpTooltip>
        <HelpTooltip text="Borrar coordenadas"><Button appearance="integrated" aria-label="Borrar coordenadas" disabled={blocked} onClick={clear}><Trash aria-hidden="true" /></Button></HelpTooltip>
      </InputGroup>
      {error && <p role="alert" id={id + '-error'} className="coordinates-error">{error}</p>}
    </form>
    <dl className="coordinates-results">
      {rows.map(row => {
        const available = row.value !== null, message = copiedRow?.format === row.format ? copiedRow.message : null
        return <div key={row.format} role={available ? 'button' : undefined}
          tabIndex={available && !blocked ? 0 : undefined} aria-label={available ? 'Copiar ' + row.format : undefined}
          aria-disabled={available ? blocked : undefined} onClick={() => { void copyRow(row.format, row.value) }}
          onKeyDown={event => {
            if (available && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); void copyRow(row.format, row.value) }
          }}>
          <dt>{row.format}</dt>
          <dd className="technical-data" aria-label={'Resultado ' + row.format} data-copying={Boolean(message)}>
            <span className="coordinates-value">{row.format === 'Maps' && row.value ? 'www.google.com/maps/...' : row.value ?? row.error}</span>
            {message && <span role="status" className="coordinates-copy-overlay">{message}</span>}
          </dd>
        </div>
      })}
    </dl>
  </div>
}
