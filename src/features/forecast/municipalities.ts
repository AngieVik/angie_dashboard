export interface Municipality { slug: string; name: string; province: string; search: string }

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
}

let catalogue: Promise<Municipality[]> | undefined

export function loadMunicipalities(): Promise<Municipality[]> {
  catalogue ??= import('./municipalities.json').then(({ default: data }) => {
    const provinces = new Map(data.provinces.map(province => [province.id, province.name] as const))
    return data.municipalities.map(municipality => {
      const province = provinces.get(municipality.province) ?? municipality.province
      return { ...municipality, province,
        search: normalize(municipality.name + ' ' + province + ' ' + municipality.slug.replace(/-/g, ' ')) }
    })
  })
  return catalogue
}

export function searchMunicipalities(municipalities: readonly Municipality[], query: string): Municipality[] {
  const text = normalize(query), terms = text.split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  return municipalities.filter(municipality => terms.every(term => municipality.search.includes(term)))
    .sort((a, b) => Number(normalize(b.name).startsWith(text)) - Number(normalize(a.name).startsWith(text)))
    .slice(0, 12)
}
