import { describe, expect, it } from 'vitest'
import { parseCoordinate } from './parseCoordinate'
import { convertCoordinate, toGeographic } from './convertCoordinate'
import { createGoogleMapsLink } from './googleMapsLink'

function parsed(input: string) {
  const result = parseCoordinate(input)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error)
  return result.coordinate
}

describe('Coordenadas V1', () => {
  it.each([
    ['37.060234, -2.002295', 'DD', 37.060234, -2.002295],
    ['37°03\'36.8"N 2°00\'08.2"W', 'DMS', 37.06022222222222, -2.002277777777778],
    ["37°03.614'N 2°00.137'W", 'DMM', 37.06023333333334, -2.002283333333333],
  ] as const)('analiza el ejemplo %s sin equiparar precisiones distintas', (input, format, latitude, longitude) => {
    const coordinate = parsed(input)
    expect(coordinate.format).toBe(format)
    const dd = toGeographic(coordinate)
    expect(dd.latitude).toBeCloseTo(latitude, 10)
    expect(dd.longitude).toBeCloseTo(longitude, 10)
    expect(convertCoordinate(coordinate, format)).toMatchObject({ ok: true, text: input })
  })

  it('30S representa banda S del norte y conserva Este/Norte', () => {
    const coordinate = parsed('30S 588700 4101800')
    expect(coordinate).toMatchObject({ format: 'UTM', zone: 30, band: 'S', easting: 588700, northing: 4101800 })
    const dd = toGeographic(coordinate)
    expect(dd.latitude).toBeGreaterThan(32)
    expect(dd.latitude).toBeLessThan(40)
    expect(dd.longitude).toBeGreaterThan(-3)
    expect(dd.longitude).toBeLessThan(0)
    expect(convertCoordinate(coordinate, 'UTM')).toMatchObject({ ok: true, text: '30S 588700 4101800' })
  })

  // Reference values from PROJ's official UTM examples, independent of this implementation.
  // https://proj.org/en/stable/operations/projections/utm.html
  it('convierte 12°E 56°N al huso natural 33 y verifica la inversa del ejemplo PROJ en huso 32', () => {
    const utm = convertCoordinate(parsed('56, 12'), 'UTM')
    expect(utm.ok).toBe(true)
    if (utm.ok) {
      const [zone, easting, northing] = utm.text.split(' ')
      expect(zone).toBe('33V')
      // Symmetric ±3° from the central meridians of zones 32/33: E = 1,000,000 − 687,071.44.
      expect(Number(easting)).toBeCloseTo(312928.56, 2)
      expect(Number(northing)).toBeCloseTo(6210141.33, 2)
    }
    const dd = toGeographic(parsed('32V 687071.44 6210141.33'))
    expect(dd.latitude).toBeCloseTo(56, 6)
    expect(dd.longitude).toBeCloseTo(12, 6)
  })

  it.each([
    ['30M 500000 9889469.841', -1, -3],
    ['30N 500000 0', 0, -3],
    ['1N 500000 0', 0, -177],
    ['60N 500000 0', 0, 177],
  ])('resuelve bandas M/N y husos extremos: %s', (input, latitude, longitude) => {
    const dd = toGeographic(parsed(input))
    expect(dd.latitude).toBeCloseTo(latitude, 7)
    expect(dd.longitude).toBeCloseTo(longitude, 7)
  })

  it.each([
    ['  37.060234.   -2.002295  ', '37.060234, -2.002295'],
    ['37,060234, -2,002295', '37.060234, -2.002295'],
    ['37.060234 -2.002295', '37.060234, -2.002295'],
    [' 37 ° 03 \' 36,8 " N   2 ° 00 \' 08,2 " W ', '37°03\'36.8"N 2°00\'08.2"W'],
    ["37°03,614'N   2°00,137'W", "37°03.614'N 2°00.137'W"],
    ['30 S, 588700, 4101800', '30S 588700 4101800'],
  ])('corrige solo espacios y separadores: %s', (input, normalizedInput) => {
    const result = parseCoordinate(input)
    expect(result).toMatchObject({ ok: true, normalizedInput })
    if (result.ok) expect(result.normalizedInput.match(/\d+/g)).toEqual(input.match(/\d+/g))
  })

  it.each([
    '', 'abc', '37.060234', '37.12', '37,12', '37.060', '37.0',
    '30N 500000.1', '30N 500000,1', '37..060234, -2.002295', '37.060234, -2.002295, 4',
    '91, 2', '37, -181', 'NaN, 2', 'Infinity, 2', '1e3, 2',
    '37°60\'00"N 2°00\'00"W', '37°03\'60"N 2°00\'00"W',
    '90°00\'00.1"N 2°00\'00"W', '37°03\'00"N 180°00\'01"E',
    "37°60'N 2°00'W", "37°03'N 181°00'W", "-37°03'N 2°00'W",
    '0S 588700 4101800', '61S 588700 4101800', '30I 588700 4101800', '30O 588700 4101800',
    '30A 588700 4101800', '30Z 588700 4101800', '30S 588700', '30S 588700 4101800 4',
    '30S -588700 4101800', '30S 99999 4101800', '30S 900001 4101800', '30S 588700 10000001',
    '30S 500000 0', '30M 500000 0',
  ])('rechaza íntegramente entrada inválida: %s', input => {
    const result = parseCoordinate(input)
    expect(result).toMatchObject({ ok: false, input })
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0)
    expect(result).not.toHaveProperty('coordinate')
  })

  it('convierte DD a DMS y DMM con acarreo y hemisferios correctos', () => {
    expect(convertCoordinate(parsed('37.060234, -2.002295'), 'DMS')).toMatchObject({ ok: true, text: '37°03\'36.8"N 2°00\'08.3"W' })
    expect(convertCoordinate(parsed('37.060234, -2.002295'), 'DMM')).toMatchObject({ ok: true, text: "37°03.614'N 2°00.138'W" })
    expect(convertCoordinate(parsed('-12.999999999, 179.999999999'), 'DMS')).toMatchObject({ ok: true, text: '13°00\'00.0"S 180°00\'00.0"E' })
    expect(convertCoordinate(parsed('-12.999999999, 179.999999999'), 'DMM')).toMatchObject({ ok: true, text: "13°00.000'S 180°00.000'E" })
    expect(toGeographic(parsed('12°30\'00"S 2°30\'00"E'))).toEqual({ latitude: -12.5, longitude: 2.5 })
  })

  it.each([['0, -180', '1N'], ['0, 180', '60N'], ['-80, -3', '30C'], ['84, -3', '30X'], ['60, 6', '32V'], ['78, 20', '33X']])('elige huso y banda geográficos para %s', (input, prefix) => {
    const result = convertCoordinate(parsed(input), 'UTM')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text.startsWith(`${prefix} `)).toBe(true)
      const restored = toGeographic(parsed(result.text)), original = toGeographic(parsed(input))
      expect(restored.latitude).toBeCloseTo(original.latitude, 6)
      expect(restored.longitude).toBeCloseTo(original.longitude, 6)
    }
  })

  it.each(['90, 0', '-90, 0', '84.1, 2', '-80.1, 2'])('conserva coordenada geográfica válida fuera de la cobertura UTM: %s', input => {
    const coordinate = parsed(input)
    expect(convertCoordinate(coordinate, 'UTM')).toMatchObject({ ok: false })
    expect(convertCoordinate(coordinate, 'DD').ok).toBe(true)
    const dd = toGeographic(coordinate)
    expect(createGoogleMapsLink(dd.latitude, dd.longitude)).toContain('https://www.google.com/maps/search/')
  })

  it('genera enlace de Maps en orden latitud/longitud y rechaza números no válidos', () => {
    expect(createGoogleMapsLink(37.060234, -2.002295)).toBe('https://www.google.com/maps/search/?api=1&query=37.060234%2C-2.002295')
    for (const [latitude, longitude] of [[NaN, 2], [37, Infinity], [91, 2], [37, -181]]) {
      expect(() => createGoogleMapsLink(latitude!, longitude!)).toThrow()
    }
  })
})
