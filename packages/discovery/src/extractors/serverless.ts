import * as fs from 'node:fs'
import * as path from 'node:path'

export interface DiscoveredEndpoint {
  method: string
  path: string
  /** serverless function key (e.g. "ApiAbsenceConfigBulkCreate") when identifiable */
  functionName?: string
  /** serverless function description when present */
  description?: string
}

export interface ServerlessFacts {
  /** deploy-state = resolved config from a real deploy; static-scan = literals mined from serverless TS sources */
  source: 'deploy-state' | 'static-scan'
  endpoints: DiscoveredEndpoint[]
  /** SQS queue names this service owns (resources) or consumes (event sources) */
  queueNames: string[]
}

// ── Deploy-state parsing (.serverless/serverless-state.json) ─────────────────

function queueNameFromArn(arn: unknown, resources: Record<string, any>): string | null {
  if (typeof arn === 'string') {
    const last = arn.split(':').pop()
    return last && last.length > 3 ? last : null
  }
  if (arn && typeof arn === 'object' && 'Fn::GetAtt' in (arn as Record<string, unknown>)) {
    const logical = (arn as Record<string, string[]>)['Fn::GetAtt']?.[0]
    if (!logical) return null
    const queueName = resources[logical]?.Properties?.QueueName
    return typeof queueName === 'string' ? queueName : logical
  }
  return null
}

export function parseServerlessState(state: any): Omit<ServerlessFacts, 'source'> {
  const endpoints: DiscoveredEndpoint[] = []
  const queueNames = new Set<string>()
  const resources: Record<string, any> = state?.service?.resources?.Resources ?? {}

  for (const [logical, res] of Object.entries<any>(resources)) {
    if (res?.Type === 'AWS::SQS::Queue') {
      const name = res.Properties?.QueueName
      queueNames.add(typeof name === 'string' ? name : logical)
    }
    // API Gateway routes defined as raw CloudFormation (e.g. SQS-SendMessage
    // direct integrations) are real public API surface with no Lambda event.
    if (res?.Type === 'AWS::ApiGatewayV2::Route' && typeof res.Properties?.RouteKey === 'string') {
      const [method, p] = res.Properties.RouteKey.split(/\s+/)
      if (method && p && HTTP_METHODS.has(method.toUpperCase())) {
        endpoints.push({ method: method.toUpperCase(), path: p, functionName: logical })
      }
    }
  }

  for (const [fnKey, fn] of Object.entries<any>(state?.service?.functions ?? {})) {
    const identity = { functionName: fnKey, description: typeof fn?.description === 'string' ? fn.description : undefined }
    for (const event of fn?.events ?? []) {
      const httpApi = event?.httpApi
      if (httpApi) {
        if (typeof httpApi === 'object' && httpApi.resolvedMethod) {
          endpoints.push({ method: String(httpApi.resolvedMethod).toUpperCase(), path: httpApi.resolvedPath ?? '/', ...identity })
        } else if (typeof httpApi === 'object' && httpApi.method) {
          endpoints.push({ method: String(httpApi.method).toUpperCase(), path: httpApi.path ?? '/', ...identity })
        } else if (typeof httpApi === 'string') {
          const [method, p] = httpApi.split(/\s+/)
          if (method && p) endpoints.push({ method: method.toUpperCase(), path: p, ...identity })
        }
        continue
      }
      const http = event?.http
      if (http && typeof http === 'object' && http.method) {
        endpoints.push({ method: String(http.method).toUpperCase(), path: http.path?.startsWith('/') ? http.path : `/${http.path ?? ''}`, ...identity })
        continue
      }
      if (typeof http === 'string') {
        const [method, p] = http.split(/\s+/)
        if (method && p) endpoints.push({ method: method.toUpperCase(), path: p.startsWith('/') ? p : `/${p}`, ...identity })
        continue
      }
      const sqsArn = event?.sqs?.arn ?? (typeof event?.sqs === 'string' ? event.sqs : null)
      if (sqsArn) {
        const name = queueNameFromArn(sqsArn, resources)
        if (name) queueNames.add(name)
      }
    }
  }

  return { endpoints, queueNames: [...queueNames].sort() }
}

// ── Static scanning of serverless TS sources ─────────────────────────────────

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Walk backward from an event line to identify the enclosing serverless
 * function: the nearest `Identifier: {` line with smaller indentation, plus
 * any `description: '…'` between it and the event. Heuristic — returns {}
 * rather than guessing when nothing plausible is found.
 */
function findFunctionIdentity(lines: string[], eventLineIdx: number): { functionName?: string; description?: string } {
  const eventIndent = lines[eventLineIdx]!.match(/^\s*/)![0].length
  let description: string | undefined
  for (let j = eventLineIdx - 1; j >= Math.max(0, eventLineIdx - 60); j--) {
    const line = lines[j]!
    const indent = line.match(/^\s*/)![0].length
    if (!line.trim()) continue
    if (indent < eventIndent) {
      const d = line.match(/^\s*description:\s*['"`]([^'"`]+)['"`]/)
      if (d && !description) {
        description = d[1]!
        continue
      }
      const fn = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*):\s*\{\s*$/)
      const structural = ['events', 'httpApi', 'http', 'tags', 'environment', 'vpc', 'authorizer',
        'Properties', 'RequestParameters', 'Target', 'Resources', 'Integration']
      if (fn && !structural.includes(fn[1]!)) {
        return { functionName: fn[1]!, description }
      }
    }
  }
  return { description }
}

/** Mine method/path literals from serverless TypeScript source. Exported for tests. */
export function parseServerlessStatic(content: string): Omit<ServerlessFacts, 'source'> {
  const endpoints: DiscoveredEndpoint[] = []
  const queueNames = new Set<string>()
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // Shorthand: httpApi: 'GET /path'
    const shorthand = line.match(/\bhttpApi:\s*['"`]([A-Z]+)\s+([^'"`]+)['"`]/)
    if (shorthand && HTTP_METHODS.has(shorthand[1]!)) {
      endpoints.push({ method: shorthand[1]!, path: shorthand[2]!, ...findFunctionIdentity(lines, i) })
      continue
    }

    // Block form: httpApi: { / http: { followed by method: + path: within the block
    if (/\b(httpApi|http):\s*\{\s*$/.test(line)) {
      let method: string | null = null
      let epPath: string | null = null
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const inner = lines[j]!
        if (/^\s*\}/.test(inner)) break
        const m = inner.match(/\bmethod:\s*['"`]([A-Za-z]+)['"`]/)
        if (m) method = m[1]!.toUpperCase()
        const p = inner.match(/\bpath:\s*['"`]([^'"`]+)['"`]/)
        if (p) epPath = p[1]!
        if (method && epPath) break
      }
      if (method && epPath && HTTP_METHODS.has(method)) {
        endpoints.push({ method, path: epPath, ...findFunctionIdentity(lines, i) })
      }
      continue
    }

    // API Gateway V2 route resources: RouteKey: 'POST /email/high-priority'
    // (e.g. SQS-SendMessage direct integrations — no Lambda event exists)
    const route = line.match(/\bRouteKey:\s*['"`]([A-Z]+)\s+([^'"`]+)['"`]/)
    if (route && HTTP_METHODS.has(route[1]!)) {
      endpoints.push({ method: route[1]!, path: route[2]!, ...findFunctionIdentity(lines, i) })
      continue
    }

    // Queue names: QueueName: 'literal' or `template-${stage}` (template parts stripped)
    const q = line.match(/\bQueueName:\s*['"`]([^'"`]+)['"`]/)
    if (q) {
      const cleaned = q[1]!.replace(/\$\{[^}]*\}/g, '').replace(/^[-_.]+|[-_.]+$/g, '')
      if (cleaned.length >= 6) queueNames.add(cleaned)
    }
  }

  return { endpoints, queueNames: [...queueNames].sort() }
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkTsFiles(full, out)
    else if (e.name.endsWith('.ts')) out.push(full)
  }
  return out
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function extractServerless(repoBase: string, repo: string): ServerlessFacts | null {
  const repoPath = path.join(repoBase, repo)

  const statePath = path.join(repoPath, '.serverless', 'serverless-state.json')
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
      const parsed = parseServerlessState(state)
      if (parsed.endpoints.length || parsed.queueNames.length) {
        return { source: 'deploy-state', ...parsed }
      }
    } catch {
      // fall through to static scan
    }
  }

  const sources: string[] = []
  const rootConfig = path.join(repoPath, 'serverless.ts')
  if (fs.existsSync(rootConfig)) sources.push(rootConfig)
  sources.push(...walkTsFiles(path.join(repoPath, 'serverless')))
  if (!sources.length) return null

  const endpoints: DiscoveredEndpoint[] = []
  const queueNames = new Set<string>()
  for (const file of sources) {
    try {
      const parsed = parseServerlessStatic(fs.readFileSync(file, 'utf-8'))
      endpoints.push(...parsed.endpoints)
      parsed.queueNames.forEach(q => queueNames.add(q))
    } catch {
      // unreadable file — skip
    }
  }
  if (!endpoints.length && !queueNames.size) return null
  return { source: 'static-scan', endpoints, queueNames: [...queueNames].sort() }
}
