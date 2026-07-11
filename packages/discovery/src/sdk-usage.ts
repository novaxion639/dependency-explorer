import * as fs from 'node:fs'
import * as path from 'node:path'
import { normalizeEndpoint, normalizeEndpointVersionless } from './endpoints'
import { findPackageDirs } from './extractors/typescript'
import type { SdkRegistry } from './extractors/sdk-registry'

/**
 * Call-site verification: which SDK methods does a consumer actually invoke,
 * and which endpoints do those methods hit? Bridges the registry
 * (method → path, from skello-libs-ts sources) with consumer source scans to
 * confirm, suggest or challenge each connection's usedEndpoints.
 *
 * A method call only counts inside files that import that SDK package —
 * generic names like findAll would otherwise false-positive across the codebase.
 */

export interface CalledMethod {
  method: string
  httpMethod: string
  path: string
  endpointId: string | null
  files: string[]
}

export interface AmbiguousCall {
  /** method name shared by several registry entries — which endpoint is hit can't be told statically */
  method: string
  candidateIds: string[]
  files: string[]
}

export interface SdkUsageFinding {
  from: string
  to: string
  pkg: string
  calledMethods: CalledMethod[]
  ambiguousCalls: AmbiguousCall[]
  /** endpoint ids with unambiguous call-site evidence, missing from the connection's usedEndpoints */
  suggestedAdditions: string[]
  /** usedEndpoints entries with no call-site evidence at all (not even an ambiguous candidate) */
  unproven: string[]
}

interface TargetEndpoints {
  exact: Map<string, string>
  versionless: Map<string, string>
}

// Ultra-generic method names: even when unique within an SDK's registry, a
// bare `.create(` call site (DI containers, other classes) cannot be safely
// attributed — kept as ambiguous evidence, never auto-suggested.
const GENERIC_METHOD_NAMES = new Set(['create', 'update', 'delete', 'get', 'post', 'put', 'patch', 'list', 'findOne', 'findAll', 'find', 'remove', 'upsert'])

const SOURCE_EXTS = /\.(ts|tsx|js|vue)$/
const MAX_FILE_SIZE = 512 * 1024
const FILE_SAMPLE_CAP = 2

function walkSources(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkSources(full, out)
    else if (SOURCE_EXTS.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(full)
  }
  return out
}

export function verifySdkUsage(
  repoBase: string,
  connections: Array<{ from: string; to: string; pkg: string; usedEndpoints: string[] }>,
  registry: SdkRegistry,
  endpointIdsByService: Map<string, TargetEndpoints>,
): SdkUsageFinding[] {
  const findings: SdkUsageFinding[] = []
  const contentCache = new Map<string, Array<{ rel: string; content: string }>>()

  const repoContents = (repo: string) => {
    if (!contentCache.has(repo)) {
      const root = path.join(repoBase, repo)
      const files = findPackageDirs(root).flatMap(d => walkSources(path.join(d, 'src')))
      const loaded: Array<{ rel: string; content: string }> = []
      for (const f of files) {
        try {
          if (fs.statSync(f).size > MAX_FILE_SIZE) continue
          loaded.push({ rel: path.relative(root, f), content: fs.readFileSync(f, 'utf-8') })
        } catch {
          // skip unreadable
        }
      }
      contentCache.set(repo, loaded)
    }
    return contentCache.get(repo)!
  }

  for (const conn of connections) {
    const methods = registry.packages.get(conn.pkg)
    if (!methods?.length) continue
    const targets = endpointIdsByService.get(conn.to)
    if (!targets) continue

    const importing = repoContents(conn.from).filter(f => f.content.includes(`'${conn.pkg}'`) || f.content.includes(`"${conn.pkg}"`))
    if (!importing.length) continue

    const resolveId = (httpMethod: string, p: string) =>
      targets.exact.get(normalizeEndpoint(httpMethod, p))
        ?? targets.versionless.get(normalizeEndpointVersionless(httpMethod, p))
        ?? null

    // Generic method names (create, delete, findOne…) appear on several
    // repository classes within one SDK — a bare `.create(` call site cannot
    // be attributed to a single endpoint statically.
    const byName = new Map<string, typeof methods>()
    for (const m of methods) {
      if (!byName.has(m.name)) byName.set(m.name, [])
      byName.get(m.name)!.push(m)
    }

    const called: CalledMethod[] = []
    const ambiguous: AmbiguousCall[] = []
    for (const [name, variants] of byName) {
      const callRe = new RegExp(`\\.${name}\\s*[(<]`)
      const files = importing.filter(f => callRe.test(f.content)).map(f => f.rel)
      if (!files.length) continue
      const distinctTargets = new Map(variants.map(v => [`${v.httpMethod} ${v.path}`, v]))
      if (distinctTargets.size === 1 && !GENERIC_METHOD_NAMES.has(name)) {
        const m = [...distinctTargets.values()][0]!
        called.push({ method: name, httpMethod: m.httpMethod, path: m.path, endpointId: resolveId(m.httpMethod, m.path), files: files.slice(0, FILE_SAMPLE_CAP) })
      } else {
        const candidateIds = [...new Set([...distinctTargets.values()]
          .map(v => resolveId(v.httpMethod, v.path))
          .filter((id): id is string => !!id))]
        ambiguous.push({ method: name, candidateIds, files: files.slice(0, FILE_SAMPLE_CAP) })
      }
    }
    if (!called.length && !ambiguous.length) continue

    const evidencedIds = new Set(called.map(c => c.endpointId).filter((id): id is string => !!id))
    const plausibleIds = new Set([...evidencedIds, ...ambiguous.flatMap(a => a.candidateIds)])
    findings.push({
      from: conn.from,
      to: conn.to,
      pkg: conn.pkg,
      calledMethods: called,
      ambiguousCalls: ambiguous,
      suggestedAdditions: [...evidencedIds].filter(id => !conn.usedEndpoints.includes(id)),
      unproven: conn.usedEndpoints.filter(id => !plausibleIds.has(id)),
    })
  }

  return findings
}
