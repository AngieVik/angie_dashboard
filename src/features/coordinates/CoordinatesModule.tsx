import { useId, useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useViewportInteraction } from '../../layout/ViewportContext'
import { copyText } from '../../platform/clipboard'
import { parseCoordinate } from './parseCoordinate'
import { convertCoordinate, toGeographic } from './convertCoordinate'
import { createGoogleMapsLink } from './googleMapsLink'
import type { FormattedCoordinate } from './coordinateTypes'
import './coordinates.css'

export function CoordinatesModule() {
  const id = useId(), revision = useRef(0)
  const { blocked, blockedRef } = useViewportInteraction()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
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

  async function copyCoordinate(conversion: FormattedCoordinate) {
    if (blockedRef.current || !conversion.ok) return
    const current = revision.current
    setCopyMessage(null); setRowCopyError(null)
    const copied = await copyText(conversion.text)
    if (current === revision.current) setRowCopyError(copied ? null : 'No se pudo copiar la coordenada.')
  }

  return <div className="coordinates-module">
    <form onSubmit={event => { event.preventDefault(); convert() }}>
      <div className="coordinates-entry">
        <Input id={`${id}-input`} aria-label="Coordenadas" className="document-title technical-data" value={input} disabled={blocked}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          placeholder="37.060234, -2.002295" spellCheck={false} autoComplete="off"
          onChange={event => {
            if (blockedRef.current) return
            revision.current++
            setInput(event.target.value); setError(null); setResult(null); setCopyMessage(null); setRowCopyError(null)
          }} />
        <Button type="submit" disabled={blocked}>Convertir</Button>
      </div>
      {error && <p role="alert" id={`${id}-error`} className="coordinates-error">{error}</p>}
    </form>
    {result && <>
      <dl className="coordinates-results">
        {result.conversions.map(conversion => <div key={conversion.format} role={conversion.ok ? 'button' : undefined}
          tabIndex={conversion.ok && !blocked ? 0 : undefined} aria-label={conversion.ok ? `Copiar ${conversion.format}` : undefined}
          aria-disabled={conversion.ok ? blocked : undefined} onClick={() => { void copyCoordinate(conversion) }}
          onKeyDown={event => {
            if (conversion.ok && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); void copyCoordinate(conversion) }
          }}>
          <dt>{conversion.format}</dt>
          <dd className="technical-data" aria-label={`Resultado ${conversion.format}`}>{conversion.ok ? conversion.text : conversion.error}</dd>
        </div>)}
      </dl>
      <div className="coordinates-link"><span>Enlace de Google Maps</span>
        <a className="technical-data" aria-label="Enlace de Google Maps" href={result.link} target="_blank" rel="noopener noreferrer"
          aria-disabled={blocked} tabIndex={blocked ? -1 : undefined} onClick={event => { if (blockedRef.current) event.preventDefault() }}>{result.link}</a>
      </div>
    </>}
    <Button disabled={blocked || !result} onClick={() => { void copy() }}>Copiar enlace</Button>
    {copyMessage && <p role="status" className="coordinates-copy-status">{copyMessage}</p>}
    {rowCopyError && <p role="status" className="coordinates-copy-error">{rowCopyError}</p>}
  </div>
}
