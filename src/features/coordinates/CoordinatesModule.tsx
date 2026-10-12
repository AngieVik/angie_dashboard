import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { InputGroup } from '../../components/ui/input-group'
import { HelpTooltip } from '../../components/ui/tooltip'
import { Trash } from 'lucide-react'
import { useValidationNotice } from '../../components/ui/useValidationNotice'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { copyText } from '../../platform/clipboard'
import { parseCoordinate } from './parseCoordinate'
import { convertCoordinate, toGeographic } from './convertCoordinate'
import { createGoogleMapsLink } from './googleMapsLink'
import type { FormattedCoordinate } from './coordinateTypes'
import './coordinates.css'

export function CoordinatesModule({ generation = 0 }: { generation?: number } = {}) {
  const id = useId(), revision = useRef(0)
  const { blocked, blockedRef } = useViewportInteraction()
  const [input, setInput] = useState('')
  const [error, setError] = useValidationNotice(null, generation)
  const [result, setResult] = useState<{ conversions: FormattedCoordinate[]; link: string } | null>(null)
  const [copiedRow, setCopiedRow] = useState<{ format: string; message: string } | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => { clearTimeout(copyTimer.current); revision.current++ }, [])
  function clearCopy() { clearTimeout(copyTimer.current); setCopiedRow(null) }
  function convert() {
    if (blockedRef.current) return
    revision.current++; clearCopy()
    const parsed = parseCoordinate(input)
    if (!parsed.ok) { setError('No se reconoce la latitud y longitud'); return }
    const dd = toGeographic(parsed.coordinate)
    setInput(parsed.normalizedInput); setError(null)
    setResult({ conversions: (['DD', 'DMS', 'DMM', 'UTM'] as const).map(format => convertCoordinate(parsed.coordinate, format)),
      link: createGoogleMapsLink(dd.latitude, dd.longitude) })
  }
  function clear() {
    if (blockedRef.current) return
    revision.current++; clearCopy()
    setInput(''); setError(null); setResult(null)
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
  return <div className="coordinates-module">
    <form onSubmit={event => { event.preventDefault(); convert() }}>
      <InputGroup className="coordinates-entry">
        <Input id={id + '-input'} aria-label="Coordenadas" className="document-title technical-data" value={input} disabled={blocked}
          aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined} spellCheck={false} autoComplete="off"
          onChange={event => {
            if (blockedRef.current) return
            revision.current++; clearCopy()
            setInput(event.target.value); setError(null)
          }} />
        <HelpTooltip text="Borrar coordenadas"><Button aria-label="Borrar coordenadas" disabled={blocked} onClick={clear}><Trash aria-hidden="true" /></Button></HelpTooltip>
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
