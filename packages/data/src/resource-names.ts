function kebab(camel: string): string {
  return camel.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

const OWNER_PREFIXED_STORES = new Set(['sqs', 'sns', 'kinesis'])

export function normalizeResourceName(raw: string, store: string): { name: string; ownerHint?: string } {
  const cleaned = raw
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+DB$/, '')
    .replace(/\$\{[^}]*\}|\{env\}/g, '')
    .replace(/-?\\\./g, '.')
    .replace(/\\/g, '')
    .replace(/[-_.]{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .trim()
  const prefixed = OWNER_PREFIXED_STORES.has(store) ? cleaned.match(/^(svc[A-Z][A-Za-z0-9]*)-(.+)$/) : null
  return prefixed?.[1] && prefixed[2] ? { name: prefixed[2], ownerHint: kebab(prefixed[1]) } : { name: cleaned }
}
