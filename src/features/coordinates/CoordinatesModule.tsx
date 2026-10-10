import { useId, useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { InputGroup } from '../../components/ui/input-group'
import { HelpTooltip } from '../../components/ui/tooltip'
import { Check } from 'lucide-react'
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
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [rowCopyError, setRowCopyError] = useState<string | null>(null)

  function convert() {
    if (blockedRef.current) return
    revision.current++
    setCopyMessage(null)
    setRowCopyError(null)
    const parsed = parseCoordinate(input)
    if (!parsed.ok) { setError(parsed.error); setResult(null); return }
    const dd = toGeographic(parsed.coordinate)
    setInput(parsed.normalizedInput)
    setError(null)
    setResult({ conversions: (['DD', 'DMS', 'DMM', 'UTM'] as const).map(format => convertCoordinate(parsed.coordinate, format)),
      link: createGoogleMapsLink(dd.latitude, dd.longitude) })
  }

  async function copy() {
    if (blockedRef.current || !result) return
    setRowCopyError(null)
    const current = revision.current
    const copied = await copyText(result.link)
    if (current === revision.current) setCopyMessage(copied ? 'Enlace copiado' : 'No se pudo copiar. Copia el enlace manualmente.')
  }

  async function copyCoordinate(value: string | null) {
    if (blockedRef.current || value === null) return
    const current = revision.current
    setCopyMessage(null); setRowCopyError(null)
    const copied = await copyText(value)
    if (current === revision.current) setRowCopyError(copied ? null : 'No se pudo copiar la coordenada.')
  }

  const rows = (['DD', 'DMS', 'DMM', 'UTM'] as const).map(format => {
    const conversion = result?.conversions.find(item => item.format === format)
    return { format: format as string, value: conversion?.ok ? conversion.text : null, error: conversion && !conversion.ok ? conversion.error : '' }
  })
  rows.push({ format: 'Maps', value: result?.link ?? null, error: '' })

  return <div className="coordinates-module">
    <form onSubmit={event => { event.preventDefault(); convert() }}>
      <InputGroup className="coordinates-entry">
        <Input id={`${id}-input`} aria-label="Coordenadas" className="document-title technical-data" value={input} disabled={blocked}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          placeholder="coordenadas" spellCheck={false} autoComplete="off"
          onChange={event => {
            if (blockedRef.current) return
            revision.current++
            setInput(event.target.value); setError(null); setResult(null); setCopyMessage(null); setRowCopyError(null)
          }} />
        <HelpTooltip text="Validar coordenadas y mostrar formatos"><Button type="submit" aria-label="Validar coordenadas y mostrar formatos" disabled={blocked}><Check aria-hidden="true" /></Button></HelpTooltip>
      </InputGroup>
      {error && <p role="alert" id={`${id}-error`} className="coordinates-error">{error}</p>}
    </form>
    <dl className="coordinates-results">
      {rows.map(row => {
        const available = row.value !== null
        const copyRow = () => { if (available) { if (row.format === 'Maps') void copy(); else void copyCoordinate(row.value) } }
        return <div key={row.format} role={available ? 'button' : undefined}
          tabIndex={available && !blocked ? 0 : undefined} aria-label={available ? `Copiar ${row.format}` : undefined}
          aria-disabled={available ? blocked : undefined} onClick={copyRow}
          onKeyDown={event => {
            if (available && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); copyRow() }
          }}>
          <dt>{row.format}</dt>
          <dd className="technical-data" aria-label={`Resultado ${row.format}`}>{row.value ?? row.error}</dd>
        </div>
      })}
    </dl>
    {copyMessage && <p role="status" className="coordinates-copy-status">{copyMessage}</p>}
    {rowCopyError && <p role="status" className="coordinates-copy-error">{rowCopyError}</p>}
  </div>
}
