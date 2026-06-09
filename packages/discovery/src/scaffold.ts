/**
 * Endpoint scaffold — regenerates a service's endpoint definitions from its
 * serverless config (ADR-0007 amendment: this is human-invoked codegen whose
 * output lands in a git diff for review, not autonomous drift application).
 *
 * Usage (from the workspace root):
 *   pnpm discover:scaffold --list            # show services whose endpoint docs drift from code
 *   pnpm discover:scaffold svc-feature-flags svc-labour-laws …
 *
 * Matching cascade per existing endpoint (most→least conservative):
 *   1. path+method match (incl. version-prefix / separator tolerance)
 *      → endpoint kept untouched (curated metadata preserved)
 *   2. function-name identity: kebab(functionKey) === endpoint.id
 *      → id + curated metadata kept, path/method updated to code truth
 *   3. no match → endpoint REMOVED (it does not exist in code); references in
 *      connections.usedEndpoints are cleaned up, all loudly reported
 * Code endpoints with no dataset counterpart become new entries (id from
 * function name, description from serverless config, empty useCase for
 * human enrichment).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ConnectivityService, ServiceConnection, ServiceEndpoint } from '@dependency-explorer/schema'
import { extractServerless, type DiscoveredEndpoint } from './extractors/serverless'
import { normalizeEndpoint, normalizeEndpointVersionless, kebab, isBoilerplateEndpoint } from './endpoints'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_BASE = path.resolve(__dirname, '../../../../')
const DATA_SRC = path.resolve(__dirname, '../../data/src')

const LIST_MODE = process.argv.includes('--list')
const TARGETS = process.argv.slice(2).filter(a => !a.startsWith('--'))

// ── Raw manual-layer loading (NOT the merged map — no overlay, no provenance) ─

async function loadService(name: string): Promise<ConnectivityService> {
  const mod = await import(path.join(DATA_SRC, 'services', `${name}.ts`))
  return mod.default
}

async function loadConnections(): Promise<ServiceConnection[]> {
  const mod = await import(path.join(DATA_SRC, 'connections.ts'))
  return mod.default
}

// ── Serialization (mirrors the existing file shapes exactly) ─────────────────

function serializeServiceFile(svc: Record<string, unknown>): string {
  const varName = (svc.name as string).replace(/-/g, '_')
  return `import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const ${varName}: ConnectivityService = ConnectivityServiceSchema.parse(${JSON.stringify(svc, null, 2)})

export default ${varName}
`
}

function serializeConnectionsFile(connections: ServiceConnection[]): string {
  const ordered = connections.map(c => ({
    from: c.from,
    to: c.to,
    sdkPackage: c.sdkPackage,
    communicationType: c.communicationType,
    protocol: c.protocol,
    authType: c.authType,
    description: c.description,
    usedEndpoints: c.usedEndpoints,
  }))
  return `import { ServiceConnectionSchema } from '@dependency-explorer/schema'
import type { ServiceConnection } from '@dependency-explorer/schema'
import { z } from 'zod'

/**
 * Service-to-service connections.
 * communicationType / protocol / authType are explicit on every entry —
 * never inferred from sdkPackage naming (ADR-0004).
 */
const connections: ServiceConnection[] = z.array(ServiceConnectionSchema).parse(${JSON.stringify(ordered, null, 2)})

export default connections
`
}

// ── Scaffolding ───────────────────────────────────────────────────────────────

interface ScaffoldResult {
  service: string
  kept: number
  updated: Array<{ id: string; from: string; to: string }>
  added: string[]
  removed: string[]
}

function buildEndpoint(code: DiscoveredEndpoint, usedIds: Set<string>): ServiceEndpoint {
  let id = code.functionName ? kebab(code.functionName) : kebab(`${code.method} ${code.path.replace(/[/{}]/g, ' ')}`).replace(/-+/g, '-')
  while (usedIds.has(id)) id = `${id}-2`
  usedIds.add(id)
  const params = [...code.path.matchAll(/\{([^}]+)\}/g)].map(m => ({
    name: m[1]!,
    in: 'path' as const,
    type: 'string',
    required: true,
    description: '',
  }))
  return {
    id,
    path: code.path,
    method: code.method.toUpperCase() as ServiceEndpoint['method'],
    description: code.description ?? `${code.method.toUpperCase()} ${code.path}`,
    useCase: '',
    params,
    response: {},
  }
}

function scaffoldEndpoints(svc: ConnectivityService, code: DiscoveredEndpoint[]): { endpoints: ServiceEndpoint[]; result: ScaffoldResult } {
  const result: ScaffoldResult = { service: svc.name, kept: 0, updated: [], added: [], removed: [], }
  const byExact = new Map(code.map(e => [normalizeEndpoint(e.method, e.path), e]))
  const byVersionless = new Map(code.map(e => [normalizeEndpointVersionless(e.method, e.path), e]))
  const byFnId = new Map(code.filter(e => e.functionName).map(e => [kebab(e.functionName!), e]))

  const matchedCode = new Set<DiscoveredEndpoint>()
  const endpoints: ServiceEndpoint[] = []
  const usedIds = new Set<string>()

  for (const ep of svc.endpoints) {
    // 1. path+method identity → keep curated entry as-is
    const pathMatch = byExact.get(normalizeEndpoint(ep.method, ep.path))
      ?? byVersionless.get(normalizeEndpointVersionless(ep.method, ep.path))
    if (pathMatch && !matchedCode.has(pathMatch)) {
      matchedCode.add(pathMatch)
      endpoints.push(ep)
      usedIds.add(ep.id)
      result.kept++
      continue
    }
    // 2. function-name identity → keep id + metadata, update path/method to code truth
    const fnMatch = byFnId.get(ep.id)
    if (fnMatch && !matchedCode.has(fnMatch)) {
      matchedCode.add(fnMatch)
      endpoints.push({ ...ep, path: fnMatch.path, method: fnMatch.method.toUpperCase() as ServiceEndpoint['method'] })
      usedIds.add(ep.id)
      result.updated.push({ id: ep.id, from: `${ep.method} ${ep.path}`, to: `${fnMatch.method} ${fnMatch.path}` })
      continue
    }
    // 3. no evidence in code → removed
    result.removed.push(ep.id)
  }

  for (const codeEp of code) {
    if (matchedCode.has(codeEp)) continue
    if (isBoilerplateEndpoint(codeEp.method, codeEp.path)) continue // swagger/health noise
    const ep = buildEndpoint(codeEp, usedIds)
    endpoints.push(ep)
    result.added.push(`${ep.id} (${ep.method} ${ep.path})`)
  }

  return { endpoints, result }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const serviceFiles = fs.readdirSync(path.join(DATA_SRC, 'services')).filter(f => f.endsWith('.ts'))
  const allServices = serviceFiles.map(f => f.replace(/\.ts$/, ''))

  if (LIST_MODE || TARGETS.length === 0) {
    console.log('# Scaffoldable services (endpoint docs vs serverless config)\n')
    for (const name of allServices) {
      const sls = extractServerless(REPO_BASE, name)
      if (!sls || sls.endpoints.length === 0) continue
      const svc = await loadService(name)
      const { result } = scaffoldEndpoints(svc, sls.endpoints)
      const drift = result.removed.length + result.added.length + result.updated.length
      const marker = drift === 0 ? '✓ in sync' : `drift: ${result.kept} kept, ${result.updated.length} path-fixed, ${result.added.length} added, ${result.removed.length} removed`
      console.log(`- ${name} (${sls.source}, ${sls.endpoints.length} code endpoints): ${marker}`)
    }
    console.log('\nRun: pnpm discover:scaffold <service> [<service>…] to regenerate.')
    return
  }

  const connections = await loadConnections()
  let connectionsDirty = false
  const cleanups: string[] = []

  for (const name of TARGETS) {
    if (!allServices.includes(name)) {
      console.error(`✗ ${name}: no service definition file`)
      continue
    }
    const sls = extractServerless(REPO_BASE, name)
    if (!sls || sls.endpoints.length === 0) {
      console.error(`✗ ${name}: no serverless endpoints extractable — not scaffolding`)
      continue
    }
    const svc = await loadService(name)
    const { endpoints, result } = scaffoldEndpoints(svc, sls.endpoints)

    const rewritten: Record<string, unknown> = { ...svc, endpoints }
    fs.writeFileSync(path.join(DATA_SRC, 'services', `${name}.ts`), serializeServiceFile(rewritten))

    // Clean connections.usedEndpoints referencing removed endpoints
    if (result.removed.length) {
      const validIds = new Set(endpoints.map(e => e.id))
      for (const conn of connections) {
        if (conn.to !== name) continue
        const dropped = conn.usedEndpoints.filter(id => !validIds.has(id))
        if (dropped.length) {
          conn.usedEndpoints = conn.usedEndpoints.filter(id => validIds.has(id))
          connectionsDirty = true
          cleanups.push(`${conn.from} → ${name}: dropped ${dropped.join(', ')}`)
        }
      }
    }

    console.log(`\n## ${name} (${sls.source})`)
    console.log(`  kept (path match):    ${result.kept}`)
    if (result.updated.length) {
      console.log(`  path-fixed (id match): ${result.updated.length}`)
      result.updated.forEach(u => console.log(`    - ${u.id}: ${u.from} → ${u.to}`))
    }
    console.log(`  added from code:      ${result.added.length}`)
    result.added.forEach(a => console.log(`    + ${a}`))
    if (result.removed.length) {
      console.log(`  REMOVED (no evidence): ${result.removed.length}`)
      result.removed.forEach(r => console.log(`    ✗ ${r}`))
    }
  }

  if (connectionsDirty) {
    fs.writeFileSync(path.join(DATA_SRC, 'connections.ts'), serializeConnectionsFile(connections))
    console.log(`\n## usedEndpoints cleanups (review these in the diff!)`)
    cleanups.forEach(c => console.log(`  - ${c}`))
  }

  console.log('\nDone. Review the git diff, then run: pnpm discover:apply && pnpm test')
}

main()
