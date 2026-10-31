import init, { WasmFinder } from 'tzf-wasm'
import wasmUrl from 'tzf-wasm/tzf_wasm_bg.wasm?url'
import { isSupportedTimeZone } from '@/platform/timeZones'
import type { GeographicCoordinate } from './coordinateTypes'

let finder: Promise<WasmFinder> | undefined
function loadFinder() {
  finder ??= init({ module_or_path: wasmUrl }).then(() => new WasmFinder()).catch(error => { finder = undefined; throw error })
  return finder
}

export async function coordinateTimeZone({ latitude, longitude }: GeographicCoordinate): Promise<string> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Coordenadas no válidas.')
  const data = await loadFinder()
  // The geographic library takes longitude first; Angie stores latitude first.
  const timeZone = data.get_tz_name(longitude, latitude)
  if (!timeZone || !isSupportedTimeZone(timeZone)) throw new Error('No se pudo resolver una zona horaria compatible. Selecciónala manualmente.')
  return timeZone
}
