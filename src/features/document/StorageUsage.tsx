import type { StorageCapacity } from '@/platform/storageCapacity'
import { formatStorageBytes } from '@/platform/storageCapacity'

export function StorageUsage({ capacity }: { capacity?: StorageCapacity }) {
  return <p role="status" aria-label="Capacidad del sitio">
    {!capacity ? 'Consultando espacio…' : capacity.estimateError ?? (capacity.usage === undefined || capacity.quota === undefined
      ? 'Estimación de espacio no disponible.'
      : `Espacio del sitio (estimado): ${formatStorageBytes(capacity.usage)} de ${formatStorageBytes(capacity.quota)}. Disponibles: ${formatStorageBytes(capacity.available ?? 0)}.`)}
  </p>
}
