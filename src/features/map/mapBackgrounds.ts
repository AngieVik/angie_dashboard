export const MAP_BACKGROUNDS = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  },
  pnoa: {
    name: 'Foto aérea PNOA',
    url: 'https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{-y}.jpeg',
    attribution: 'PNOA CC BY 4.0 <a href="https://www.scne.es/" target="_blank" rel="noopener noreferrer">scne.es</a>',
  },
  ign: {
    name: 'Topográfico IGN',
    url: 'https://tms-mapa-raster.ign.es/1.0.0/mapa-raster/{z}/{x}/{-y}.jpeg',
    attribution: 'CC BY 4.0 <a href="https://www.ign.es/" target="_blank" rel="noopener noreferrer">IGN</a>',
  },
} as const

export const PNOA_INFORMATION = {
  url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseOrto/{z}/{x}/{-y}.png',
  attribution: 'IGNBaseOrto CC BY 4.0 <a href="https://www.ign.es/" target="_blank" rel="noopener noreferrer">IGN</a>',
} as const

export type MapBackground = keyof typeof MAP_BACKGROUNDS

export function isMapBackground(value: unknown): value is MapBackground {
  return typeof value === 'string' && Object.hasOwn(MAP_BACKGROUNDS, value)
}
