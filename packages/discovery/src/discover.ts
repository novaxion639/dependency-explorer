/**
 * Discovery — scans local Skello repo checkouts and reconciles them with the
 * dependency map (ADR-0004, ADR-0007).
 *
 * Usage (from the workspace root):
 *   pnpm discover                 # classified drift report (markdown)
 *   pnpm discover:json            # same, as JSON
 *   pnpm discover:apply           # also write packages/data/src/generated/discovered.json
 *
 * Evidence sources (Phase 1 + 1.5):
 *   - package.json SDK dependencies (TypeScript repos)
 *   - Rails monolith client classes (app/services/microservices)
 *   - serverless config: deploy state (.serverless/) or static literal scan
 *   - frontend env service URLs + usage sites (names only, never values)
 *   - queue-name literals cross-referenced sender → consumer (async/SQS)
 *   - CODEOWNERS team slugs (ownership via curated mapping only)
 *
 * SDK presence is evidence of a dependency, not proof of runtime calls —
 * verified facts carry provenance instead of silently becoming truth.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectivityMap } from '@dependency-explorer/data'
import type { DiscoveredOverlay } from '@dependency-explorer/schema'
import { IGNORED_SDKS, sdkToServiceName, isStructuralGithubTeam, FRONTEND_HOST_ALIASES } from './mapping'
import { normalizeEndpoint, normalizeEndpointVersionless, isBoilerplateEndpoint } from './endpoints'
import { extractTsRepo, extractRepoOwnership, type TsRepoFacts } from './extractors/typescript'
import { extractRailsMonolith } from './extractors/rails'
import { extractServerless, type ServerlessFacts } from './extractors/serverless'
import { extractRailsRoutes } from './extractors/rails-routes'
import { extractFrontend } from './extractors/frontend'
import { findQueueSenders } from './extractors/queue-senders'
import { checkFlows, type FlowCheckResult } from './flow-check'
import { extractSdkRegistry } from './extractors/sdk-registry'
import { verifySdkUsage, type SdkUsageFinding } from './sdk-usage'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_BASE = path.resolve(__dirname, '../../../../')
const OVERLAY_PATH = path.resolve(__dirname, '../../data/src/generated/discovered.json')

const JSON_MODE = process.argv.includes('--json')
const APPLY_MODE = process.argv.includes('--apply')

// ── Dataset lookups ───────────────────────────────────────────────────────────

const serviceNames = new Set(connectivityMap.services.map(s => s.name))
const connectionKeys = new Set(connectivityMap.connections.map(c => `${c.from}→${c.to}`))
const connectionsByKey = new Map(connectivityMap.connections.map(c => [`${c.from}→${c.to}`, c]))
const slugToTeamId = new Map<string, string>()
for (const team of connectivityMap.teams ?? []) {
  for (const slug of team.githubTeams ?? []) slugToTeamId.set(slug, team.id)
}

// ── Result shapes ─────────────────────────────────────────────────────────────

interface Candidate { from: string; to: string; evidence: string; transport: string }
interface UnknownTarget { from: string; evidence: string; normalizedTarget: string }
interface Stale { from: string; to: string; sdkPackage: string }
interface Unverifiable { from: string; to: string; reason: string }
interface EndpointCheck {
  service: string
  source: ServerlessFacts['source']
  verified: number
  total: number
  missingInCode: string[]
  extraInCode: number
}

interface Report {
  scannedRepos: string[]
  /** connection key → accumulated evidence strings */
  connectionEvidence: Record<string, string[]>
  candidates: Candidate[]
  unknownTargets: UnknownTarget[]
  stale: Stale[]
  unverifiable: Unverifiable[]
  endpointChecks: EndpointCheck[]
  endpointStamps: Record<string, { lastVerified: string; evidence: string }>
  asyncSenders: Array<{ from: string; to: string; queues: string[]; files: string[] }>
  frontendServices: Array<{ service: string; inMap: boolean; evidence: string }>
  monolithSurface: { totalRoutes: number; resourceDeclarations: number; topSegments: Array<[string, number]> } | null
  /** SDK dependencies whose imports are type-only or absent — weak evidence, likely not runtime calls */
  weakSdkEvidence: Array<{ from: string; to: string; pkg: string; usage: string }>
  /** call-site verification of SDK connections against the skello-libs-ts registry */
  sdkUsage: SdkUsageFinding[]
  sdkRegistryStats: { packages: number; methods: number } | null
  flowCheck: FlowCheckResult
  ignoredSdks: Record<string, string[]>
  reposWithoutServiceDefinition: Array<{ repo: string; httpEndpoints: number; queues: number }>
  railsUnmapped: string[]
  unmappedGithubTeams: string[]
  serviceFacts: DiscoveredOverlay['services']
}

const TODAY = new Date().toISOString().slice(0, 10)

function findRepos(): string[] {
  try {
    return fs.readdirSync(REPO_BASE, { withFileTypes: true })
      .filter(e => e.isDirectory()
        && (e.name.startsWith('svc-') || ['skello-app', 'skello-app-front', 'superadmin'].includes(e.name)))
      .map(e => e.name)
      .sort()
  } catch {
    return []
  }
}

/**
 * Ownership comes ONLY from the CODEOWNERS wildcard line: it must name exactly
 * one mapped product team (generic owners like team-dev are simply unmapped).
 * Path-rule frequency is NOT ownership — squad-infra owns /aws/ everywhere,
 * which once assigned every service to a single squad before this was caught.
 */
function pickTeamId(wildcardOwners: string[]): string | undefined {
  const mapped = [...new Set(wildcardOwners.filter(slug => slugToTeamId.has(slug)))]
  return mapped.length === 1 ? slugToTeamId.get(mapped[0]!) : undefined
}


// ── Scan ──────────────────────────────────────────────────────────────────────

function run(): Report {
  const repos = findRepos()
  const report: Report = {
    scannedRepos: repos,
    connectionEvidence: {},
    candidates: [],
    unknownTargets: [],
    stale: [],
    unverifiable: [],
    endpointChecks: [],
    endpointStamps: {},
    asyncSenders: [],
    frontendServices: [],
    monolithSurface: null,
    weakSdkEvidence: [],
    sdkUsage: [],
    sdkRegistryStats: null,
    flowCheck: checkFlows(connectivityMap),
    ignoredSdks: {},
    reposWithoutServiceDefinition: [],
    railsUnmapped: [],
    unmappedGithubTeams: [],
    serviceFacts: {},
  }

  const allSlugs = new Set<string>()
  const candidatesByKey = new Map<string, Candidate>()

  const addEvidence = (from: string, to: string, evidence: string, transport: string) => {
    const key = `${from}→${to}`
    if (connectionKeys.has(key)) {
      ;(report.connectionEvidence[key] ??= []).push(evidence)
    } else {
      const existing = candidatesByKey.get(key)
      if (existing) {
        existing.evidence += `; ${evidence}`
      } else {
        candidatesByKey.set(key, { from, to, evidence, transport })
      }
    }
  }

  // ── Per-repo facts: package.json, CODEOWNERS, serverless ──────────────────
  const serverlessByRepo = new Map<string, ServerlessFacts>()
  const sdkValueEdges: Array<{ from: string; to: string; pkg: string }> = []

  for (const repo of repos) {
    const tsFacts: TsRepoFacts | null = extractTsRepo(REPO_BASE, repo)
    const codeowners = tsFacts?.codeowners ?? extractRepoOwnership(REPO_BASE, repo)
    Object.keys(codeowners.counts).forEach(s => allSlugs.add(s))

    const sls = extractServerless(REPO_BASE, repo)
    if (sls) serverlessByRepo.set(repo, sls)

    if (!serviceNames.has(repo)) {
      report.reposWithoutServiceDefinition.push({
        repo,
        httpEndpoints: sls?.endpoints.length ?? 0,
        queues: sls?.queueNames.length ?? 0,
      })
      continue
    }

    report.serviceFacts[repo] = {
      repoUrl: tsFacts?.repoUrl ?? `https://github.com/skelloapp/${repo}`,
      teamId: pickTeamId(codeowners.wildcardOwners),
      githubTeams: Object.keys(codeowners.counts).sort(),
    }

    for (const pkg of tsFacts?.sdkPackages ?? []) {
      if (pkg in IGNORED_SDKS) {
        ;(report.ignoredSdks[pkg] ??= []).push(repo)
        continue
      }
      const target = sdkToServiceName(pkg)
      if (!target || !serviceNames.has(target)) {
        report.unknownTargets.push({ from: repo, evidence: pkg, normalizedTarget: target ?? '(ignored)' })
        continue
      }
      if (target === repo) continue
      const usage = tsFacts?.sdkUsage[pkg] ?? 'declared-only'
      // type-only import + an SQS connection is the documented DTO-contract
      // pattern (ADR-0007 / svc-requests→svc-events) — not weak evidence.
      const existing = connectionsByKey.get(`${repo}→${target}`)
      if (usage !== 'value') {
        if (!(usage === 'type-only' && existing?.protocol === 'sqs')) {
          report.weakSdkEvidence.push({ from: repo, to: target, pkg, usage })
        }
      } else if (existing) {
        sdkValueEdges.push({ from: repo, to: target, pkg })
      }
      // an unused (declared-only) dependency is never grounds to PROPOSE a
      // new connection — it only shows up in the weak-evidence section
      if (!existing && usage === 'declared-only') continue
      addEvidence(repo, target, `package.json: ${pkg} (${usage} import)`, `rest (SDK client, ${usage} import)`)
    }
  }

  // ── Rails monolith outbound clients ────────────────────────────────────────
  const rails = extractRailsMonolith(REPO_BASE)
  if (rails) {
    report.railsUnmapped = rails.unmapped
    for (const edge of rails.edges) {
      if (!serviceNames.has(edge.to)) {
        report.unknownTargets.push({ from: 'skello-app', evidence: edge.evidence.join(', '), normalizedTarget: edge.to })
        continue
      }
      addEvidence('skello-app', edge.to, edge.evidence.join(', '), edge.transport)
    }
  }

  // ── Frontend service usage ─────────────────────────────────────────────────
  const front = extractFrontend(REPO_BASE)
  if (front) {
    for (const [host, ev] of Object.entries(front.services)) {
      const summary = ev.envVars.length
        ? `env ${ev.envVars.join(', ')} used in ${ev.usageCount} files`
        : `service URL referenced in ${ev.usageFiles.join(', ')}`
      // hostnames don't always match service names (svc-esignature →
      // svc-documents-esignature); null alias = known legacy host, skip quietly
      const aliased = host in FRONTEND_HOST_ALIASES ? FRONTEND_HOST_ALIASES[host] : host
      if (aliased === null) {
        report.frontendServices.push({ service: `${host} (legacy v1 host)`, inMap: false, evidence: summary })
        continue
      }
      const inMap = serviceNames.has(aliased)
      report.frontendServices.push({ service: aliased === host ? host : `${host} → ${aliased}`, inMap, evidence: summary })
      if (inMap) {
        if (ev.usageCount > 0 || ev.envVars.length === 0) {
          addEvidence('skello-app-front', aliased, `frontend: ${summary}`, 'rest (HTTP)')
        }
      } else {
        report.unknownTargets.push({ from: 'skello-app-front', evidence: summary, normalizedTarget: aliased })
      }
    }
  }

  // ── Async queue cross-reference ────────────────────────────────────────────
  const queueOwners = new Map<string, string>()
  for (const [repo, sls] of serverlessByRepo) {
    if (!serviceNames.has(repo)) continue
    for (const q of sls.queueNames) {
      if (!queueOwners.has(q)) queueOwners.set(q, repo)
    }
  }
  // skello-app-front excluded: its env mirrors backend config — a browser app
  // does not send to SQS, matches there would fabricate edges.
  const senderRepos = repos.filter(r => r !== 'skello-app-front' && serviceNames.has(r))
  const senders = findQueueSenders(REPO_BASE, senderRepos, queueOwners)
  for (const s of senders) {
    report.asyncSenders.push(s)
    addEvidence(s.from, s.to, `queue literal ${s.queues.join(', ')} in ${s.files.join(', ')}`, 'sqs (queue literal)')
  }

  // ── Endpoint verification for dataset services ─────────────────────────────
  for (const svc of connectivityMap.services) {
    const sls = serverlessByRepo.get(svc.name)
    if (!sls || svc.endpoints.length === 0) continue
    const codeEndpoints = new Map(sls.endpoints.map(e => [normalizeEndpoint(e.method, e.path), e]))
    const codeEndpointsVersionless = new Map(sls.endpoints.map(e => [normalizeEndpointVersionless(e.method, e.path), e]))
    const matchedCode = new Set<unknown>()
    const missing: string[] = []
    let verified = 0
    for (const ep of svc.endpoints) {
      const exact = codeEndpoints.get(normalizeEndpoint(ep.method, ep.path))
      const tolerant = exact ?? codeEndpointsVersionless.get(normalizeEndpointVersionless(ep.method, ep.path))
      if (tolerant && !matchedCode.has(tolerant)) {
        verified++
        matchedCode.add(tolerant)
        report.endpointStamps[`${svc.name}#${ep.id}`] = {
          lastVerified: TODAY,
          evidence: `serverless ${sls.source}: ${tolerant.method} ${tolerant.path}${exact ? '' : ' (version-prefix tolerant match)'}`,
        }
      } else {
        missing.push(ep.id)
      }
    }
    const meaningfulCode = sls.endpoints.filter(e =>
      matchedCode.has(e) || !isBoilerplateEndpoint(e.method, e.path))
    report.endpointChecks.push({
      service: svc.name,
      source: sls.source,
      verified,
      total: svc.endpoints.length,
      missingInCode: missing,
      extraInCode: meaningfulCode.length - matchedCode.size,
    })
  }

  // ── SDK call-site verification against the skello-libs-ts registry ────────
  const registry = extractSdkRegistry(REPO_BASE)
  if (registry) {
    report.sdkRegistryStats = {
      packages: registry.packages.size,
      methods: [...registry.packages.values()].reduce((n, m) => n + m.length, 0),
    }
    const endpointIdsByService = new Map(connectivityMap.services.map(s => [
      s.name,
      {
        exact: new Map(s.endpoints.map(e => [normalizeEndpoint(e.method, e.path), e.id])),
        versionless: new Map(s.endpoints.map(e => [normalizeEndpointVersionless(e.method, e.path), e.id])),
      },
    ]))
    report.sdkUsage = verifySdkUsage(
      REPO_BASE,
      sdkValueEdges.map(e => ({ ...e, usedEndpoints: connectionsByKey.get(`${e.from}→${e.to}`)?.usedEndpoints ?? [] })),
      registry,
      endpointIdsByService,
    )
  }

  // ── Monolith inbound surface (informational) ───────────────────────────────
  const routes = extractRailsRoutes(REPO_BASE)
  if (routes) {
    report.monolithSurface = {
      totalRoutes: routes.routes.length,
      resourceDeclarations: routes.resourceDeclarations,
      topSegments: Object.entries(routes.byTopSegment).sort((a, b) => b[1] - a[1]).slice(0, 12),
    }
  }

  // ── Reverse pass: every dataset connection needs evidence or an explanation ─
  for (const conn of connectivityMap.connections) {
    const key = `${conn.from}→${conn.to}`
    if (report.connectionEvidence[key]?.length) continue

    if (!fs.existsSync(path.join(REPO_BASE, conn.from))) {
      report.unverifiable.push({ from: conn.from, to: conn.to, reason: 'repo not checked out locally' })
      continue
    }
    if (conn.from === 'skello-app') {
      report.unverifiable.push({ from: conn.from, to: conn.to, reason: 'no mapped Rails client or queue literal found (heuristic scan)' })
      continue
    }
    if (conn.from === 'skello-app-front') {
      report.unverifiable.push({ from: conn.from, to: conn.to, reason: 'no env URL or usage evidence found (frontend heuristic)' })
      continue
    }
    if (!conn.sdkPackage.startsWith('@skelloapp/')) {
      report.unverifiable.push({ from: conn.from, to: conn.to, reason: `non-npm declaration (${conn.sdkPackage}), no queue evidence` })
      continue
    }
    report.stale.push({ from: conn.from, to: conn.to, sdkPackage: conn.sdkPackage })
  }

  report.candidates = [...candidatesByKey.values()]
  report.unmappedGithubTeams = [...allSlugs]
    .filter(s => !slugToTeamId.has(s) && !isStructuralGithubTeam(s))
    .sort()
  return report
}

// ── Apply ─────────────────────────────────────────────────────────────────────

function writeOverlay(report: Report) {
  const overlay: DiscoveredOverlay = {
    generatedAt: new Date().toISOString(),
    scannedRepos: report.scannedRepos,
    services: report.serviceFacts,
    connections: Object.fromEntries(
      Object.entries(report.connectionEvidence).map(([key, evidences]) => [
        key,
        { lastVerified: TODAY, evidence: evidences.join('; ') },
      ]),
    ),
    endpoints: report.endpointStamps,
  }
  fs.mkdirSync(path.dirname(OVERLAY_PATH), { recursive: true })
  fs.writeFileSync(OVERLAY_PATH, JSON.stringify(overlay, null, 2) + '\n')
  console.log(`\nOverlay written: ${path.relative(process.cwd(), OVERLAY_PATH)}`)
  console.log(`  ${Object.keys(overlay.services).length} services enriched, ${Object.keys(overlay.connections).length} connections verified, ${Object.keys(overlay.endpoints ?? {}).length} endpoints verified`)
}

// ── Report ────────────────────────────────────────────────────────────────────

function printMarkdown(r: Report) {
  const section = (title: string, lines: string[]) => {
    console.log(`\n## ${title} (${lines.length})\n`)
    console.log(lines.length ? lines.join('\n') : '_none_')
  }

  console.log('# Discovery Report')
  console.log(`\nScanned ${r.scannedRepos.length} repos in ${REPO_BASE}`)

  const verified = Object.entries(r.connectionEvidence)
  section('✅ Verified connections — in map, evidence found',
    verified.map(([key, ev]) => `- ${key.replace('→', ' → ')} _(${ev.join('; ')})_`))

  section('🆕 Candidates — evidence in code, missing from map (adopt via PR)',
    r.candidates.map(c => `- **${c.from} → ${c.to}** (${c.transport}) — ${c.evidence}`))

  section('⚠️ Possibly stale — in map, no evidence in checked-out repo',
    r.stale.map(s => `- ${s.from} → ${s.to} (\`${s.sdkPackage}\` not in package.json, no queue literal)`))

  section('⏭ Unverifiable — in map, cannot be checked by current extractors',
    r.unverifiable.map(u => `- ${u.from} → ${u.to} — ${u.reason}`))

  section('🔌 Endpoint verification (dataset vs serverless config)',
    r.endpointChecks.map(c => {
      const miss = c.missingInCode.length
        ? ` — missing in code: ${c.missingInCode.slice(0, 4).join(', ')}${c.missingInCode.length > 4 ? '…' : ''}`
        : ''
      const extra = c.extraInCode ? ` — +${c.extraInCode} in code not in map` : ''
      return `- ${c.service}: **${c.verified}/${c.total}** verified (${c.source})${miss}${extra}`
    }))

  section('📨 Async sender evidence (queue literals)',
    r.asyncSenders.map(s => `- ${s.from} → ${s.to} via \`${s.queues.join('`, `')}\` (${s.files.join(', ')})`))

  section('🖥 Frontend service usage',
    r.frontendServices.map(f => `- svc host \`${f.service}\` ${f.inMap ? '(in map)' : '**(not in map)**'} — ${f.evidence}`))

  if (r.monolithSurface) {
    console.log(`\n## 📥 Monolith inbound surface (informational)\n`)
    console.log(`${r.monolithSurface.totalRoutes} explicit routes + ${r.monolithSurface.resourceDeclarations} resource declarations. Top segments:`)
    console.log(r.monolithSurface.topSegments.map(([seg, n]) => `- /${seg} (${n})`).join('\n'))
  }

  section('🩻 Weak SDK evidence — type-only or unused imports (likely NOT runtime calls)',
    r.weakSdkEvidence.map(w => `- ${w.from} → ${w.to} via \`${w.pkg}\` (**${w.usage}**)`))

  if (r.sdkRegistryStats) {
    console.log(`\n## 🧩 SDK call-site verification (registry: ${r.sdkRegistryStats.packages} packages, ${r.sdkRegistryStats.methods} methods)\n`)
    const interesting = r.sdkUsage.filter(f => f.suggestedAdditions.length || f.unproven.length)
    console.log(`${r.sdkUsage.length} SDK connections with call-site evidence; ${interesting.length} with usedEndpoints drift:`)
    for (const f of interesting) {
      console.log(`- **${f.from} → ${f.to}**`)
      for (const c of f.calledMethods.filter(c => c.endpointId && f.suggestedAdditions.includes(c.endpointId))) {
        console.log(`  + suggest \`${c.endpointId}\` — .${c.method}() → ${c.httpMethod} ${c.path} (${c.files.join(', ')})`)
      }
      for (const a of f.ambiguousCalls) {
        console.log(`  ~ ambiguous .${a.method}() — one of [${a.candidateIds.join(', ')}] (${a.files.join(', ')})`)
      }
      for (const id of f.unproven) console.log(`  ? unproven \`${id}\` (no call site, not even ambiguous)`)
      for (const c of f.calledMethods.filter(c => !c.endpointId)) {
        console.log(`  ! unmatched call .${c.method}() → ${c.httpMethod} ${c.path} (no endpoint on ${f.to})`)
      }
    }
  }

  console.log(`\n## 🧭 Flow verification (${r.flowCheck.findings.length} findings)\n`)
  console.log(`${r.flowCheck.stepsChecked} service steps checked (${r.flowCheck.responseSteps} response arrows), ${r.flowCheck.pathsChecked} action paths checked.`)
  if (r.flowCheck.findings.length) {
    console.log(r.flowCheck.findings.map(f => `- [${f.kind}] **${f.flow}**: ${f.detail}`).join('\n'))
  } else {
    console.log('_all flows consistent with connections and endpoints_')
  }

  section('❓ Unknown targets — evidence pointing outside the map',
    r.unknownTargets.map(u => `- ${u.from} → \`${u.evidence}\` (resolves to "${u.normalizedTarget}")`))

  section('📦 Repos without a service definition (add to the map?)',
    r.reposWithoutServiceDefinition.map(x =>
      `- ${x.repo}${x.httpEndpoints ? ` — ${x.httpEndpoints} HTTP endpoints` : ''}${x.queues ? `, ${x.queues} queues` : ''}`))

  section('🗺 Rails clients needing a mapping decision',
    r.railsUnmapped.map(f => `- ${f}`))

  section('👥 Product-team slugs not mapped in teams.ts (structural squads excluded)',
    r.unmappedGithubTeams.map(t => `- ${t}`))

  section('📚 Ignored shared libraries',
    Object.entries(r.ignoredSdks).map(([pkg, repos]) =>
      `- \`${pkg}\` — ${IGNORED_SDKS[pkg]} (${repos.length} repos)`))

  const epVerified = Object.keys(r.endpointStamps).length
  const epTotal = r.endpointChecks.reduce((n, c) => n + c.total, 0)
  console.log(`\n## Summary\n`)
  console.log(`| connections verified | endpoint stamps | candidates | stale | unverifiable | unknown targets |`)
  console.log(`|---|---|---|---|---|---|`)
  console.log(`| ${verified.length} | ${epVerified}/${epTotal} | ${r.candidates.length} | ${r.stale.length} | ${r.unverifiable.length} | ${r.unknownTargets.length} |`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

const report = run()
if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2))
} else {
  printMarkdown(report)
}
if (APPLY_MODE) {
  writeOverlay(report)
}
