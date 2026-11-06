export const DOCUMENT_NAME_LIMIT = 120

export function documentNameError(value: string): string | null {
  if (!value.trim()) return 'Escribe un nombre para el UIBoard.'
  if (value.trim().length > DOCUMENT_NAME_LIMIT) return `El nombre admite hasta ${DOCUMENT_NAME_LIMIT} caracteres.`
  return null
}
