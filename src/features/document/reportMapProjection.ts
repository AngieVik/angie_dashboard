import { latLng, point } from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'

export type ReportMapProjection = Pick<LeafletMap, 'getSize' | 'getCenter' | 'getZoom' | 'getZoomScale' | 'latLngToContainerPoint' | 'containerPointToLatLng' | 'distance'>

export function freezeReportMapProjection(map: LeafletMap): ReportMapProjection {
  const crs = map.options.crs!, zoom = map.getZoom(), size = map.getSize().clone(), center = map.getCenter()
  const latitude = center.lat, longitude = center.lng
  const origin = map.getPixelOrigin().clone(), pane = map.layerPointToContainerPoint([0, 0]).clone()
  return {
    getSize: () => size.clone(), getCenter: () => latLng(latitude, longitude), getZoom: () => zoom,
    getZoomScale: (to, from = zoom) => crs.scale(to) / crs.scale(from),
    latLngToContainerPoint: value => crs.latLngToPoint(latLng(value), zoom).round().subtract(origin).add(pane),
    containerPointToLatLng: value => crs.pointToLatLng(point(value).subtract(pane).add(origin), zoom),
    distance: (a, b) => crs.distance(latLng(a), latLng(b)),
  }
}
