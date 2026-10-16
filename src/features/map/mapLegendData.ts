import mtn25Image from './legends/mtn25.png?inline'
import ignOrthoImage from './legends/ignbase_orto.png?inline'
import osmMainRoadsImage from './legends/mainroad15.svg?inline'
import osmIntermittentWaterImage from './legends/intermittent_water.svg?inline'
import osmSummitImage from './legends/summit.svg?inline'

export interface LegendRow {
  symbol: string
  meaning: string
  sample: 'relief' | 'hypsometry' | 'river' | 'water' | 'settlement' | 'motorway' | 'road' | 'track' | 'railway' | 'boundary' | 'protected' | 'vegetation' | 'building'
}
export interface TopographicLegend {
  maxZoom: number
  title: string
  reference: string
  image?: string
  rows?: LegendRow[]
}

const IGN_DOCUMENTS = 'https://www.ign.es/web/resources/docs/IGNCnig/'
const GENERAL_MAPS = 'https://centrodedescargas.cnig.es/CentroDescargas/buscadorCatalogo.do?codFamilia=Mapas'
const OVERVIEW_ROWS: LegendRow[] = [
  { symbol: 'Relieve', meaning: 'Tintas de altitud y sombreado', sample: 'hypsometry' },
  { symbol: 'Poblaciones', meaning: 'Nombres y signos de ciudades y localidades', sample: 'settlement' },
  { symbol: 'Vías principales', meaning: 'Autopistas y autovías', sample: 'motorway' },
  { symbol: 'Carreteras', meaning: 'Red de comunicación por carretera', sample: 'road' },
  { symbol: 'Ferrocarriles', meaning: 'Red ferroviaria', sample: 'railway' },
  { symbol: 'Ríos', meaning: 'Cursos de agua', sample: 'river' },
  { symbol: 'Lagos y embalses', meaning: 'Superficies de agua', sample: 'water' },
  { symbol: 'Límites administrativos', meaning: 'Delimitaciones territoriales', sample: 'boundary' },
]
const TOPOGRAPHIC_ROWS: LegendRow[] = [
  { symbol: 'Autopistas y autovías', meaning: 'Vías principales', sample: 'motorway' },
  { symbol: 'Carreteras', meaning: 'Vías de comunicación', sample: 'road' },
  { symbol: 'Pistas y caminos', meaning: 'Vías de menor entidad', sample: 'track' },
  { symbol: 'Ferrocarriles', meaning: 'Vías ferroviarias', sample: 'railway' },
  { symbol: 'Ríos y arroyos', meaning: 'Cursos de agua', sample: 'river' },
  { symbol: 'Lagos y embalses', meaning: 'Superficies de agua', sample: 'water' },
  { symbol: 'Curvas de nivel y cotas', meaning: 'Altitud y forma del terreno', sample: 'relief' },
  { symbol: 'Edificaciones', meaning: 'Construcciones y recintos', sample: 'building' },
  { symbol: 'Vegetación', meaning: 'Coberturas y usos del suelo', sample: 'vegetation' },
  { symbol: 'Límites administrativos', meaning: 'Delimitaciones territoriales', sample: 'boundary' },
  { symbol: 'Espacios protegidos', meaning: 'Parques y áreas de protección', sample: 'protected' },
]

// These SVG samples are schematic reading aids, not official legend graphics.
// Source series: CBG - MTN50.pdf, CBG - MP200.pdf and CBG - Mapa500.pdf
// in IGN_DOCUMENTS. Keep them distinct from the original MTN25/IGNBaseOrto images.

// IGN capabilities consulted on 2026-10-14:
// https://www.ign.es/wmts/mapa-raster?SERVICE=WMTS&REQUEST=GetCapabilities
// Its abstract gives the transitions at 952, 224, 112, 60.20, 14.28, 5.04
// and 1.4 m/px. GoogleMapsCompatible resolution is 156543.033928 / 2**z
// (ScaleDenominator * 0.00028), yielding these integer tile-zoom ranges.
// These are source-series ranges in Spain, not a ground-scale calculation
// using latitude or the dashboard/module zoom. MTN25 is not universal.
// IGN metadata spaignMTNAR also explicitly places Alta Resolución at z >= 17.
const TOPOGRAPHIC_LEGENDS: TopographicLegend[] = [
  { maxZoom: 7, title: 'Atlas Nacional · 1:11.000.000', reference: GENERAL_MAPS, rows: OVERVIEW_ROWS },
  { maxZoom: 9, title: 'Mapa de España · 1:3.000.000', reference: GENERAL_MAPS, rows: OVERVIEW_ROWS },
  { maxZoom: 10, title: 'Mapa de España · 1:1.250.000', reference: IGN_DOCUMENTS + 'CBG%20-%20Mapasgenerales.pdf', rows: OVERVIEW_ROWS },
  { maxZoom: 11, title: 'Mapa de España · 1:500.000', reference: IGN_DOCUMENTS + 'CBG%20-%20Mapa500.pdf', rows: OVERVIEW_ROWS },
  { maxZoom: 13, title: 'Mapa Provincial · 1:200.000', reference: IGN_DOCUMENTS + 'CBG%20-%20MP200.pdf', rows: OVERVIEW_ROWS },
  { maxZoom: 14, title: 'MTN50 · 1:50.000', reference: IGN_DOCUMENTS + 'CBG%20-%20MTN50.pdf#page=3', rows: TOPOGRAPHIC_ROWS },
  { maxZoom: 16, title: 'MTN25 · 1:25.000', reference: 'https://www.ign.es/web/ign/portal/catalogo-de-simbolos-cartograficos-mtn25',
    image: mtn25Image },
  { maxZoom: 19, title: 'Mapa Topográfico Nacional · Alta resolución',
    reference: 'https://www.idee.es/csw-inspire-idee/srv/spa/csw?SERVICE=CSW&VERSION=2.0.2&REQUEST=GetRecordById&outputSchema=http://www.isotc211.org/2005/gmd&ElementSetName=full&ID=spaignMTNAR', rows: TOPOGRAPHIC_ROWS },
]

export function getTopographicLegend(zoom: number): TopographicLegend {
  return TOPOGRAPHIC_LEGENDS.find(legend => Math.round(zoom) <= legend.maxZoom) ?? TOPOGRAPHIC_LEGENDS[TOPOGRAPHIC_LEGENDS.length - 1]!
}

export const IGN_ORTHO_LEGEND = 'https://www.ign.es/wms-inspire/ign-base/leyendas/ignbase_orto.png'
export const IGN_ORTHO_LEGEND_IMAGE = ignOrthoImage
export const MTN25_LEGEND_REFERENCE = 'https://www.ign.es/wms-inspire/mapa-raster/leyendas/mtn25.png'
export const OSM_LEGEND_REFERENCE = 'https://wiki.openstreetmap.org/wiki/OpenStreetMap_Carto/Key'

export interface OsmLegendEntry {
  name: string
  fill?: string
  stroke?: string
  dash?: string
  image?: string
  line?: boolean
}

// Selection of the provider's original mapnik legend, using detail-level
// samples (z15–16). Colours/dashes and image filenames come from:
// https://github.com/openstreetmap/openstreetmap-website/blob/master/config/legend.yml
// Original image assets: app/assets/images/legend/mapnik in that repository.
// Images in ./legends are unmodified local copies of those provider originals
// and the IGN LegendURLs above (retrieved 2026-10-15). Inline imports keep
// them in the map's JS chunk, covered by the existing PWA precache patterns.
export const OSM_LEGEND_ENTRIES: OsmLegendEntry[] = [
  { name: 'Autopista', fill: '#e892a2', stroke: '#dc2a67' },
  { name: 'Carreteras principales', image: osmMainRoadsImage },
  { name: 'Pista', stroke: '#996600', dash: '6 5', line: true },
  { name: 'Camino ecuestre', stroke: 'green', dash: '4 2', line: true },
  { name: 'Vía ciclista', stroke: 'blue', dash: '3 3.5', line: true },
  { name: 'Camino peatonal', stroke: 'salmon', dash: '3 3.5', line: true },
  { name: 'Ferrocarril', fill: '#707070', stroke: 'white', dash: '8', line: true },
  { name: 'Límite administrativo', fill: '#8d618b88' },
  { name: 'Lago o embalse', fill: '#aad3df' },
  { name: 'Agua intermitente', image: osmIntermittentWaterImage },
  { name: 'Bosque', fill: '#add19e' },
  { name: 'Prado o hierba', fill: '#cdebb0' },
  { name: 'Cultivos', fill: '#eef0d5' },
  { name: 'Parque', fill: '#c8facc' },
  { name: 'Zona residencial', fill: '#e0dfdf' },
  { name: 'Zona industrial', fill: '#ebdbe8' },
  { name: 'Edificio', fill: '#c4b6ab', stroke: '#a99a8d' },
  { name: 'Cumbre', image: osmSummitImage },
]

