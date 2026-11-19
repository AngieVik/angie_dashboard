import type { DocumentSnapshot } from './documentStore'

/** @notice-level warning */
export function localStorageNoticeMessages(snapshot: DocumentSnapshot): string[] {
  const explanation = snapshot.storageConflict
    ? 'Otra pestaña cambió la copia local. Esta sesión no puede sobrescribirla. Usa Guardar como para conservar tus cambios en un archivo.'
    : !snapshot.active ? 'No se pudo leer la recuperación de este dispositivo.' : 'Los cambios de esta sesión no tienen una copia local confirmada.'
  return [...(snapshot.localStorageMessage ? [snapshot.localStorageMessage] : []), explanation]
}

/** @notice-level warning */
export function timerStorageNoticeMessage(storage: 'conflict' | 'corrupt' | 'unavailable'): string {
  return storage === 'conflict'
    ? 'Otra pestaña ha cambiado los temporizadores. Recargar sustituirá los cambios locales pendientes.'
    : storage === 'corrupt' ? 'El registro guardado de temporizadores está dañado. Las alarmas automáticas están bloqueadas hasta recuperar el almacén.'
      : 'Autoguardado no disponible'
}
