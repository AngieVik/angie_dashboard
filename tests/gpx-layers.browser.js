/* global window, document, performance */
// Focused real Leaflet checks: no invented links, aggregate labels, cancellation.
async page => page.evaluate(async () => {
  const resources = performance.getEntriesByType('resource').map(entry => entry.name)
  const { default: L } = await import(resources.find(url => url.includes('/leaflet.js?v=')))
  const { GpxLayers, gpxLayerMemory } = await import(resources.find(url => new URL(url).pathname === '/src/features/map/gpxLayers.ts'))
  const check = (value, message) => { if (!value) throw new Error(message) }
  const element = document.createElement('div'); element.style.cssText = 'position:fixed;width:512px;height:384px;top:0;left:0'
  document.body.append(element)
  const map = L.map(element, { preferCanvas: true, zoomAnimation: false }).setView([36, -4], 3)
  const renderer = new GpxLayers(map)
  const before = gpxLayerMemory()
  const wait = async () => {
    const deadline = performance.now() + 15000
    while (gpxLayerMemory().jobs) { if (performance.now() > deadline) throw new Error('Layer queue did not finish'); await new Promise(resolve => setTimeout(resolve, 5)) }
  }
  const file = { id: 'segments', fingerprint: 'segments', color: '#D63A3A', visible: true, kilometers: false, kilometerInterval: .1,
    data: { lines: [Array.from({ length: 600 }, (_, i) => ({ latitude: 36 + i / 100000, longitude: -4 })),
      [{ latitude: 40, longitude: -4 }, { latitude: 41, longitude: -4 }], [{ latitude: 42, longitude: -4 }]],
    waypoints: [{ latitude: 43, longitude: -4, name: '<b>Literal</b>' }], pointCount: 604 } }
  try {
    renderer.sync([file], 3); await wait()
    let endpoints = 0, literal = false
    map.eachLayer(layer => {
      if (layer instanceof L.Polyline) {
        const points = layer.getLatLngs()
        check(!points.some(point => point.lat < 37) || !points.some(point => point.lat >= 40), 'Disconnected GPX segments were joined')
        for (const point of points) if (point.lat === 36 || point.lat === 36.00599 || point.lat === 40 || point.lat === 41) endpoints++
      }
      if (layer instanceof L.CircleMarker && layer.getTooltip()) literal = layer.getTooltip().getContent().textContent === '<b>Literal</b>'
    })
    check(endpoints === 4, 'Original endpoints were lost or invented')
    check(literal, 'Waypoint names must remain literal text')
    renderer.sync([{ ...file, visible: false }], 3)
    check(gpxLayerMemory().layers === before.layers, 'Hide retained visual layers')
    renderer.sync([{ ...file, color: '#3697DC' }], 3)
    renderer.dispose(); await new Promise(resolve => setTimeout(resolve, 30))
    check(gpxLayerMemory().jobs === 0 && gpxLayerMemory().layers === before.layers, 'Cancelled work resurrected a layer')
    const data = { lines: [[{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 120 }]], waypoints: [], pointCount: 2 }
    renderer.sync([{ ...file, data, kilometers: true }, { ...file, id: 'second', data, kilometers: true }], 20)
    await wait()
    let labels = 0
    map.eachLayer(layer => { if (layer instanceof L.Marker) labels++ })
    check(labels > 0 && labels <= 1000, 'PK label budget must be aggregated across files')
    return { status: 'PASS', segmentsRemainSeparate: true, endpointsPreserved: true, literalWaypoint: true,
      cancelAndHide: true, aggregatePkLabels: labels }
  } finally { renderer.dispose(); map.remove(); element.remove() }
})
