export function customStatusLabelError(label: string): string | null {
  if (!label.trim()) return 'Escribe el nombre del estado personalizado.'
  if (/[\r\n\u2028\u2029]/.test(label)) return 'El nombre del estado personalizado debe tener una sola línea.'
  return null
}
