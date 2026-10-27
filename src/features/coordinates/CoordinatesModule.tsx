import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup } from '@/components/ui/input-group'
import { HelpTooltip } from '@/components/ui/tooltip'
import { Check, ClipboardPaste, Trash } from 'lucide-react'
import { useValidationNotice } from '@/hooks/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { copyText } from '../../platform/clipboard'
import { parseCoordinate } from './parseCoordinate'
import { convertCoordinate, toGeographic } from './convertCoordinate'
import { createGoogleMapsLink } from './googleMapsLink'
import type { PlanPin } from '../../domain/document/types'
import styles from './coordinates.module.css'

export function CoordinatesModule({ generation = 0, selectedCoordinate, onInputChange }: { generation?: number; selectedCoordinate?: PlanPin; onInputChange?: (input: string) => void } = {}) {
  const id = useId(), revision = useRef(0)
  const { blocked, blockedRef } = useViewportInteraction()
  const source = selectedCoordinate ? `${generation}:${selectedCoordinate.elementId}:${selectedCoordinate.latitude}:${selectedCoordinate.longitude}` : `${generation}:manual`
  const selectedInput = selectedCoordinate ? `${selectedCoordinate.latitude.toFixed(6)}, ${selectedCoordinate.longitude.toFixed(6)}` : ''
  const [entry, setEntry] = useState({ source, input: selectedInput, generation })
  const input = entry.input
  const setInput = (input: string) => setEntry({ source, input, generation })
  const [error, setError] = useValidationNotice(null, generation)
  const [copiedRow, setCopiedRow] = useState<{ format: string; message: string } | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  if (entry.source !== source) {
    setEntry({ source, input: selectedCoordinate || entry.generation !== generation ? selectedInput : input, generation })
    setCopiedRow(null); setError(null)
  }
  const result = useMemo(() => {
    const parsed = parseCoordinate(entry.input)
    if (!parsed.ok) return null
    const dd = toGeographic(parsed.coordinate)
    return { conversions: (['DD', 'DMS', 'DMM', 'UTM'] as const).map(format => convertCoordinate(parsed.coordinate, format)),
      link: createGoogleMapsLink(dd.latitude, dd.longitude) }
  }, [entry])
  // Selection changes and edits invalidate clipboard operations still in flight.
  useLayoutEffect(() => { revision.current++ }, [source, input])
  useLayoutEffect(() => { onInputChange?.(input) }, [input, onInputChange])
  useEffect(() => () => { clearTimeout(copyTimer.current); revision.current++ }, [])
  function clearCopy() { clearTimeout(copyTimer.current); setCopiedRow(null) }
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
