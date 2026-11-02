import catalog from './catalog.json'

const PYTHON_SPACES = /[\t\n\v\f\r\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/u
const NO_TRIBE = 'Sans tribe'

type CatalogEntry = { name: string; tribe: string | null }

export function featureKey(label: string): string {
  return label
    .replaceAll('_', ' ')
    .replace(/\([^\n]*?\)|\[[^\n]*?\]/g, '')
    .replaceAll('/', ' and ')
    .replaceAll('-', ' ')
    .split(PYTHON_SPACES)
    .filter((word) => word !== '')
    .join(' ')
    .toLowerCase()
}

const entries: CatalogEntry[] = catalog.map((feature) => ({ name: feature.name, tribe: feature.tribe === NO_TRIBE ? null : feature.tribe }))
const nameOfAlias = new Map(catalog.flatMap((feature) => (feature.aliases ?? []).map((alias): [string, string] => [alias, feature.name])))

export function catalogEntryOf(label: string): CatalogEntry | null {
  const key = featureKey(nameOfAlias.get(label) ?? label)
  return entries.find((entry) => featureKey(entry.name) === key) ?? null
}
