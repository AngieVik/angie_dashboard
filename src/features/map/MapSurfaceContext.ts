import { createContext, useContext } from 'react'
import type { RefObject } from 'react'
import type { Map } from 'leaflet'

export const MapSurfaceContext = createContext<{ mapRef: RefObject<Map | null>; suppressSelection: RefObject<boolean> } | null>(null)

export function useMapSurface() {
  const surface = useContext(MapSurfaceContext)
  if (!surface) throw new Error('La capa necesita un visor de mapa.')
  return surface
}
