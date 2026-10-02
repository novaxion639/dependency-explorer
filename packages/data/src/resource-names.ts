function kebab(camel: string): string {
  return camel.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

export function normalizeResourceName(raw: string): { name: string; ownerHint?: string } {
  const cleaned = raw
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+DB$/, '')
    .replace(/\$\{[^}]*\}|\{env\}/g, '')
    .replace(/[-_.]{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .trim()
  const prefixed = cleaned.match(/^(svc[A-Z][A-Za-z0-9]*)-(.+)$/)
  return prefixed?.[1] && prefixed[2] ? { name: prefixed[2], ownerHint: kebab(prefixed[1]) } : { name: cleaned }
}
