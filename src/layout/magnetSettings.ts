export const MAGNET_DISTANCE_MIN = 1
export const MAGNET_DISTANCE_MAX = 100
const MAGNET_DISTANCE_DEFAULT = 18

export interface MagnetOptions { distance: number; alignEdges: boolean }
export const DEFAULT_MAGNET_OPTIONS: Readonly<MagnetOptions> = { distance: MAGNET_DISTANCE_DEFAULT, alignEdges: true }
