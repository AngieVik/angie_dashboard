export function filterWorkspaceName(value: string): string {
  return [...value.normalize('NFC')].filter(character => {
    const code = character.charCodeAt(0)
    return code > 31 && !(code >= 127 && code <= 159) && !(character.length === 1 && code >= 0xd800 && code <= 0xdfff) && !'<>:"/\\|?*'.includes(character)
  }).slice(0, 100).join('')
}

export function workspaceNameError(name: string): string | null {
  if (!name.trim()) return null
  if (filterWorkspaceName(name) !== name) return 'Utiliza un nombre de hasta 100 caracteres válido para una carpeta.'
  if (name !== name.trim() || /[ .]$/.test(name) || name === '.' || name === '..') return 'El nombre no puede empezar o terminar en espacios ni terminar en punto.'
  if (/^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(name)) return 'Este nombre está reservado por el sistema. Elige otro.'
  return null
}
