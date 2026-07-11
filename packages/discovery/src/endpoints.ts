/**
 * Shared endpoint identity helpers used by both the drift report (discover)
 * and the scaffold generator.
 */

/**
 * "GET /v1/dynamoScan/{id}/" and "GET /v1/dynamo-scan/:id" normalize
 * identically: params collapse to {}, segments are lowercased with -/_
 * stripped (camelCase vs kebab-case). Method and segment count stay strict —
 * list-vs-get-one or POST-vs-PUT differences are real drift, never matched.
 */
export function normalizeEndpoint(method: string, rawPath: string): string {
  let p = rawPath
  if (!p.startsWith('/')) p = `/${p}`
  p = p.replace(/\{[^}]+\}/g, '{}').replace(/:[A-Za-z0-9_]+/g, '{}')
  const segments = p.split('/').map(seg => seg === '{}' ? seg : seg.toLowerCase().replace(/[-_]/g, ''))
  p = segments.join('/').replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  return `${method.toUpperCase()} ${p}`
}

/** Same, with a single leading version segment (/v1, /v2…) stripped — the
 *  dataset often omits it while serverless configs include it. */
export function normalizeEndpointVersionless(method: string, rawPath: string): string {
  const stripped = rawPath.replace(/^\/?v\d+(\/|$)/, '/')
  return normalizeEndpoint(method, stripped)
}

/** Swagger/health self-endpoints every service exposes — architectural noise,
 *  excluded from scaffolding and from drift counts. */
export function isBoilerplateEndpoint(method: string, rawPath: string): boolean {
  if (method.toUpperCase() !== 'GET') return false
  const p = rawPath.replace(/\/$/, '') || '/'
  return p === '/' || p === '/docs.json' || p === '/health' || p === '/healthz' || p.startsWith('/swagger')
}

/** "BulkCreateLowPrioritySMSRoute" → "bulk-create-low-priority-sms-route" */
export function kebab(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}
