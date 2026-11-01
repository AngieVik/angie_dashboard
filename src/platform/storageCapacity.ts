export interface StorageCapacity { usage?: number; quota?: number; available?: number; estimateError?: string }
export async function readStorageCapacity(): Promise<StorageCapacity> {
  try {
    const estimate = typeof navigator !== 'undefined' ? await navigator.storage?.estimate?.() : undefined
    const usage = estimate?.usage, quota = estimate?.quota
    return { usage, quota, available: usage !== undefined && quota !== undefined ? Math.max(0, quota - usage) : undefined }
  } catch { return { estimateError: 'No se pudo estimar el espacio del sitio.' } }
}
export function formatStorageBytes(value: number) {
  return value >= 1024 ** 3 ? (value / 1024 ** 3).toFixed(1) + ' GiB'
    : value >= 1024 ** 2 ? (value / 1024 ** 2).toFixed(1) + ' MiB' : (value / 1024).toFixed(1) + ' KiB'
}
