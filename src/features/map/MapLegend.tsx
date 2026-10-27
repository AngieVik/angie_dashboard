import { useId, useState } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HelpTooltip } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { MapBackground } from './mapBackgrounds'
import { getTopographicLegend, IGN_ORTHO_LEGEND, IGN_ORTHO_LEGEND_IMAGE, MTN25_LEGEND_REFERENCE, OSM_LEGEND_ENTRIES, OSM_LEGEND_REFERENCE } from './mapLegendData'
import type { LegendRow, OsmLegendEntry } from './mapLegendData'
import styles from './MapLegend.module.css'

function LegendImage({ src, alt, width }: { src: string; alt: string; width?: number }) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  return failedSource === src ? <p role="status">Imagen no disponible. Consulta la referencia completa.</p> :
    <img className="map-legend-image" src={src} alt={alt} width={width} onError={() => setFailedSource(src)} />
}

function ImageLegend({ src, alt }: { src: string; alt: string }) {
  const [expanded, setExpanded] = useState(false)
  const viewportId = useId()
  return <div className="map-legend-sheet" data-expanded={expanded}>
    <div className="map-legend-sheet-heading">
      <Button className="map-legend-image-toggle" aria-expanded={expanded} aria-controls={viewportId}
        onClick={() => setExpanded(value => !value)}>
        {expanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}{expanded ? 'Ajustar' : 'Ampliar'}
      </Button>
    </div>
    <div id={viewportId} className="map-legend-image-viewport" tabIndex={expanded ? 0 : undefined} role="region" aria-label={alt}>
      <LegendImage src={src} alt={alt} />
    </div>
  </div>
}

function IgnSample({ sample }: { sample: LegendRow['sample'] }) {
  return <svg viewBox="0 0 72 32" width="72" height="32" aria-hidden="true">
    {sample === 'relief' && <>
      <path d="M2 25Q16 4 34 19T70 11M2 17Q16 -4 34 11T70 3M2 32Q16 12 34 27T70 19" fill="none" stroke="#a76e3c" />
      <text x="36" y="17" fill="#865427" fontSize="10" textAnchor="middle">600</text>
    </>}
    {sample === 'hypsometry' && <>
      {['#a9c98e', '#dce2a3', '#efe1a2', '#d7bb8e', '#b3987f', '#ddd4c9'].map((fill, index) =>
        <rect key={fill} x={6 + index * 10} y="6" width="10" height="20" fill={fill} />)}
    </>}
    {sample === 'river' && <path d="M2 24Q17 3 34 17T70 8" fill="none" stroke="#2598d5" strokeWidth="2" />}
    {sample === 'water' && <path d="M8 8L28 4 43 9 64 5 59 23 41 28 24 24 9 28Z" fill="#b5e5f4" stroke="#2598d5" />}
    {sample === 'settlement' && <>
      <circle cx="11" cy="16" r="4" fill="#181818" />
      <text x="22" y="20" fill="#181818" fontSize="11">Pueblo</text>
    </>}
    {sample === 'motorway' && <>
      <path d="M2 23L70 9" stroke="#df4131" strokeWidth="7" />
      <path d="M2 23L70 9" stroke="#ffbe58" strokeWidth="5" />
      <path d="M2 23L70 9" stroke="#fff" />
    </>}
    {sample === 'road' && <path d="M2 23L70 9" stroke="#df4131" strokeWidth="3" />}
    {sample === 'track' && <path d="M2 23L70 9" stroke="#555" strokeWidth="1.5" strokeDasharray="7 3" />}
    {sample === 'railway' && <>
      <path d="M2 23L70 9" stroke="#333" strokeWidth="1.5" />
      <path d="M2 23L70 9" stroke="#333" strokeWidth="6" strokeDasharray="1 7" />
    </>}
    {sample === 'boundary' && <path d="M2 23L70 9" stroke="#9380c4" strokeWidth="2" strokeDasharray="8 3 2 3" />}
    {sample === 'protected' && <path d="M2 23L70 9" stroke="#91bb60" strokeWidth="5" strokeDasharray="9 3" />}
    {sample === 'vegetation' && <>
      <rect x="7" y="5" width="58" height="22" fill="#d3e8b1" stroke="#8caa68" />
      <path d="M16 22l3 -10 3 10M31 22l3 -10 3 10M46 22l3 -10 3 10" fill="none" stroke="#648c44" />
    </>}
    {sample === 'building' && <>
      <path d="M9 6h19v9H9ZM34 12h15v14H34ZM53 5h10v14H53Z" fill="#b65b50" stroke="#8f443a" />
    </>}
  </svg>
}

function OsmSample({ entry }: { entry: OsmLegendEntry }) {
  if (entry.image) return <LegendImage src={entry.image} alt={'Símbolo de ' + entry.name} />
  return <svg viewBox="0 0 56 20" width="56" height="20" aria-hidden="true">
    {entry.line ? <>
      {entry.fill && <path d="M2 10H54" stroke={entry.fill} strokeWidth="4" />}
      <path d="M2 10H54" stroke={entry.stroke} strokeWidth="1.5" strokeDasharray={entry.dash} />
    </> : <rect x="2" y="5" width="52" height="10" fill={entry.fill} stroke={entry.stroke} />}
  </svg>
}

function ReferenceLink({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
}

function LegendContent({ background, information, zoom }: { background: MapBackground; information: boolean; zoom: number }) {
  if (background === 'osm') return <>
    <p className="map-legend-source">OSM Carto · estilo estándar</p>
    <p>Leyenda resumida · muestras de detalle. La aparición de símbolos depende del zoom.</p>
    <ul className="map-legend-osm">
      {OSM_LEGEND_ENTRIES.map(entry => <li key={entry.name}>
        <span className="map-legend-sample"><OsmSample entry={entry} /></span><span>{entry.name}</span>
      </li>)}
    </ul>
    <p>Fuente: OpenStreetMap, selección de su leyenda original.</p>
    <ReferenceLink href={OSM_LEGEND_REFERENCE}>Referencia completa de OSM Carto</ReferenceLink>
  </>
  if (background === 'pnoa') return information ? <>
    <p className="map-legend-source">PNOA + IGNBaseOrto</p>
    <p>Leyenda oficial · IGN / Sistema Cartográfico Nacional</p>
    <ImageLegend key={IGN_ORTHO_LEGEND_IMAGE} src={IGN_ORTHO_LEGEND_IMAGE} alt="Leyenda oficial de IGNBaseOrto, callejero para imagen" />
    <ReferenceLink href={IGN_ORTHO_LEGEND}>Abrir leyenda completa de IGNBaseOrto</ReferenceLink>
  </> : <>
    <p className="map-legend-source">Foto aérea PNOA</p>
    <p>Fotografía aérea sin simbología adicional</p>
    <ReferenceLink href="https://pnoa.ign.es/">Referencia PNOA</ReferenceLink>
  </>
  const legend = getTopographicLegend(zoom)
  return <>
    <p className="map-legend-source">{legend.title}</p>
    <p>Zoom geográfico {zoom} · series del IGN en España</p>
    {legend.image ? <>
      <p>Leyenda oficial · IGN CC BY 4.0</p>
      <ImageLegend key={legend.image} src={legend.image} alt={'Leyenda oficial de ' + legend.title} />
      <ReferenceLink href={MTN25_LEGEND_REFERENCE}>Abrir leyenda completa</ReferenceLink>
    </> : <>
      <p>Leyenda resumida · muestras esquemáticas</p>
      <ul className="map-legend-ign">
        {legend.rows?.map(row => <li key={row.symbol}>
          <span className="map-legend-sample"><IgnSample sample={row.sample} /></span>
          <span><strong>{row.symbol}</strong><span className="map-legend-meaning">{row.meaning}</span></span>
        </li>)}
      </ul>
    </>}
    <ReferenceLink href={legend.reference}>Referencia completa de la serie · IGN</ReferenceLink>
  </>
}

function LegendIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="5" cy="5" r="2" />
    <path d="M11 5h10M3 12h4M11 12h10M11 19h10" />
    <rect x="3" y="17" width="4" height="4" rx=".5" />
  </svg>
}

export function MapLegend({ background, information, zoom, disabled }: {
  background: MapBackground; information: boolean; zoom: number; disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  return <Popover open={open} onOpenChange={setOpen}>
    <HelpTooltip text="Leyenda"><PopoverTrigger asChild><Button className={`map-legend-trigger ${styles.trigger}`} aria-label="Leyenda" aria-pressed={open} disabled={disabled}><LegendIcon /></Button></PopoverTrigger></HelpTooltip>
    <PopoverContent className={`map-legend-popover ${styles.base}`} side="bottom" align="end" aria-labelledby={titleId}>
      <div className="map-legend-heading">
        <span id={titleId}>Leyenda</span>
        <Button aria-label="Cerrar leyenda" onClick={() => setOpen(false)}><X aria-hidden="true" /></Button>
      </div>
      <div className="map-legend-scroll" tabIndex={0} role="region" aria-label="Contenido de la leyenda">
        <LegendContent background={background} information={information} zoom={zoom} />
      </div>
    </PopoverContent>
  </Popover>
}
