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
import { IGNORED_SDKS, MONGO_CONTRACT_SDKS, sdkToServiceName, isStructuralGithubTeam, FRONTEND_HOST_ALIASES, streamSourceService, tfRepoToService } from './mapping'
import { normalizeEndpoint, normalizeEndpointVersionless, isBoilerplateEndpoint } from './endpoints'
import { extractTsRepo, extractRepoOwnership, type TsRepoFacts } from './extractors/typescript'
import { extractRailsMonolith } from './extractors/rails'
import { extractServerless, type ServerlessFacts } from './extractors/serverless'
import { extractAwsClients, type AwsUsageFact, type AwsUsageKind } from './extractors/aws-clients'
import { loadAwsSnapshot, analyzeAwsLive, type AwsLiveFindings } from './extractors/aws-live'
import { extractTerraform, type TerraformFacts } from './extractors/terraform'
import { extractRailsRoutes } from './extractors/rails-routes'
import { extractFrontend } from './extractors/frontend'
import { findQueueSenders } from './extractors/queue-senders'
import { checkFlows, checkFlowCodeLayers, checkDomainRules, type FlowCheckResult, type CodeLayerCheckResult, type RuleCheckResult } from './flow-check'
import { extractSdkRegistry } from './extractors/sdk-registry'
import { verifySdkUsage, type SdkUsageFinding } from './sdk-usage'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_BASE = path.resolve(__dirname, '../../../../')
const OVERLAY_PATH = path.resolve(__dirname, '../../data/src/generated/discovered.json')

const JSON_MODE = process.argv.includes('--json')
const APPLY_MODE = process.argv.includes('--apply')
// --aws [dir]: diff a read-only AWS snapshot (see aws-fetch.ts) against the map.
// The dir resolves against the cwd, then the workspace root; without a value,
// the most recent snapshot under .aws-snapshots/ is used.
function resolveAwsSnapshotDir(): string | null {
  const i = process.argv.indexOf('--aws')
  if (i < 0) return null
  const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const given = process.argv[i + 1]
  if (given && !given.startsWith('--')) {
    for (const base of [process.cwd(), path.resolve(pkgRoot, '../..'), pkgRoot]) {
      const candidate = path.resolve(base, given)
      if (fs.existsSync(candidate)) return candidate
    }
    throw new Error(`--aws snapshot directory not found: ${given}`)
  }
  const home = path.join(pkgRoot, '.aws-snapshots')
  const latest = fs.existsSync(home)
    ? fs.readdirSync(home, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort().pop()
    : undefined
  if (!latest) throw new Error(`--aws given but no snapshot found under ${home} — run pnpm discover:aws:fetch first`)
  return path.join(home, latest)
}
const AWS_SNAPSHOT_DIR = resolveAwsSnapshotDir()

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

interface AwsBinding {
  service: string
  /** aggregated stream event sources: source service resolved via curated mapping */
  streams: Array<{ stream: string; kind: string; source: string | null; listeners: number; cdcChannelInMap: boolean; pairInMap: boolean }>
  /** bucket-notification triggers: same source resolution as streams */
  s3Triggers: Array<{ bucket: string; functionName?: string; source: string | null; s3ChannelInMap: boolean; pairInMap: boolean }>
  schedules: Array<{ name: string; schedule: string; description?: string }>
  ownedResources: Array<{ cfType: string; name: string }>
}

interface AwsClientUsage {
  service: string
  facts: AwsUsageFact[]
  /** resource kinds proven in code with no matching service.databases entry */
  missingDatabaseEntries: string[]
  /** AWS-type databases entries with no code evidence (possible drift) */
  unevidencedDatabaseEntries: string[]
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
  awsBindings: AwsBinding[]
  awsClientUsage: AwsClientUsage[]
  terraform: Array<{ tfRepo: string; service: string; inMap: boolean; facts: TerraformFacts }>
  frontendServices: Array<{ service: string; inMap: boolean; evidence: string }>
  monolithSurface: { totalRoutes: number; resourceDeclarations: number; topSegments: Array<[string, number]> } | null
  /** SDK dependencies whose imports are type-only or absent — weak evidence, likely not runtime calls */
  weakSdkEvidence: Array<{ from: string; to: string; pkg: string; usage: string }>
  /** call-site verification of SDK connections against the skello-libs-ts registry */
  sdkUsage: SdkUsageFinding[]
  sdkRegistryStats: { packages: number; methods: number } | null
  flowCheck: FlowCheckResult
  codeLayerCheck: CodeLayerCheckResult
  ruleCheck: RuleCheckResult
  ignoredSdks: Record<string, string[]>
  reposWithoutServiceDefinition: Array<{ repo: string; httpEndpoints: number; queues: number }>
  railsUnmapped: string[]
  unmappedGithubTeams: string[]
  serviceFacts: DiscoveredOverlay['services']
  /** Layer 4: read-only AWS snapshot diff (only with --aws <dir>) */
  awsLive: AwsLiveFindings | null
}

const TODAY = new Date().toISOString().slice(0, 10)

function findRepos(): string[] {
  try {
    return fs.readdirSync(REPO_BASE, { withFileTypes: true })
      .filter(e => e.isDirectory()
        && !e.name.endsWith('-tf') // terraform checkouts have their own pass
        && (e.name.startsWith('svc-') || ['skello-app', 'skello-app-front', 'superadmin', 'skello-mobile', 'skello-punchclock'].includes(e.name)))
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
    awsBindings: [],
    awsClientUsage: [],
    terraform: [],
    frontendServices: [],
    monolithSurface: null,
    weakSdkEvidence: [],
    sdkUsage: [],
    sdkRegistryStats: null,
    flowCheck: checkFlows(connectivityMap),
    codeLayerCheck: checkFlowCodeLayers(connectivityMap, REPO_BASE),
    ruleCheck: checkDomainRules(connectivityMap, REPO_BASE),
    ignoredSdks: {},
    reposWithoutServiceDefinition: [],
    railsUnmapped: [],
    unmappedGithubTeams: [],
    serviceFacts: {},
    awsLive: null,
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

    // ── AWS event bindings: streams, S3 triggers, schedules, owned resources ─
    const recurringTasks: Array<{ name: string; schedule: string; description?: string }> = []
    if (sls) {
      const seenTask = new Set<string>()
      for (const sched of sls.schedules) {
        const name = sched.name ?? sched.functionName ?? 'scheduled task'
        const schedule = sched.expressions.join(' | ')
        if (seenTask.has(`${name}|${schedule}`)) continue
        seenTask.add(`${name}|${schedule}`)
        recurringTasks.push({ name, schedule, ...(sched.description ? { description: sched.description } : {}) })
      }
    }

    report.serviceFacts[repo] = {
      repoUrl: tsFacts?.repoUrl ?? `https://github.com/skelloapp/${repo}`,
      teamId: pickTeamId(codeowners.wildcardOwners),
      githubTeams: Object.keys(codeowners.counts).sort(),
      ...(recurringTasks.length ? { recurringTasks } : {}),
    }

    if (sls && (sls.streamConsumers.length || sls.s3Triggers.length || sls.schedules.length || sls.ownedResources.length)) {
      const byStream = new Map<string, { stream: string; kind: string; listeners: number }>()
      for (const sc of sls.streamConsumers) {
        const agg = byStream.get(`${sc.stream}:${sc.kind}`)
        if (agg) agg.listeners++
        else byStream.set(`${sc.stream}:${sc.kind}`, { stream: sc.stream, kind: sc.kind, listeners: 1 })
      }
      const streams = [...byStream.values()].map(s => {
        const source = streamSourceService(s.stream, repo, serviceNames)
        const foreign = source && source !== 'self' ? source : null
        const cdcChannelInMap = foreign != null && connectivityMap.connections.some(c =>
          c.from === repo && c.to === foreign && (c.protocol === 'cdc' || c.protocol === 'kinesis'))
        const pairInMap = foreign != null && connectionKeys.has(`${repo}→${foreign}`)
        if (foreign && (cdcChannelInMap || !pairInMap)) {
          // stamp the existing cdc/kinesis channel, or propose a new candidate;
          // a pair mapped under a DIFFERENT protocol only is flagged in the
          // report instead — never silently stamped onto the wrong channel.
          addEvidence(repo, foreign,
            `serverless ${sls.source}: ${s.kind} stream event on ${s.stream} (${s.listeners} listener${s.listeners > 1 ? 's' : ''})`,
            'cdc (stream consumer)')
        }
        return { stream: s.stream, kind: s.kind, source, listeners: s.listeners, cdcChannelInMap, pairInMap }
      })
      // bucket names resolve like stream identities: skello-app.* buckets are
      // the monolith's, own-token buckets are internal staging
      const s3Triggers = sls.s3Triggers.map(t => {
        const source = streamSourceService(t.bucket, repo, serviceNames)
        const foreign = source && source !== 'self' ? source : null
        const s3ChannelInMap = foreign != null && connectivityMap.connections.some(c =>
          c.from === repo && c.to === foreign && c.protocol === 's3')
        const pairInMap = foreign != null && connectionKeys.has(`${repo}→${foreign}`)
        if (foreign && (s3ChannelInMap || !pairInMap)) {
          addEvidence(repo, foreign,
            `serverless ${sls.source}: s3 bucket-notification trigger on ${t.bucket}${t.functionName ? ` (${t.functionName})` : ''}`,
            's3 (bucket notification)')
        }
        return { ...t, source, s3ChannelInMap, pairInMap }
      })

      report.awsBindings.push({
        service: repo,
        streams,
        s3Triggers,
        schedules: recurringTasks,
        ownedResources: sls.ownedResources,
      })
    }

    // ── Application-code AWS client usage vs service.databases (two-way) ─────
    // firehose is deliberately NOT part of the drift check: it is the org-wide
    // export convention to the data-platform delivery streams (AWS-DATA),
    // external to this map — shown as a fact, never a missing-databases flag.
    const awsFacts = extractAwsClients(REPO_BASE, repo)
    if (awsFacts) {
      const KIND_TO_DB_TYPE: Partial<Record<AwsUsageKind, string>> = {
        kinesis: 'kinesis', s3: 's3', dynamodb: 'dynamodb', postgresql: 'postgresql',
      }
      const svcDef = connectivityMap.services.find(s => s.name === repo)
      const codeTypes = new Set(
        awsFacts.map(f => KIND_TO_DB_TYPE[f.kind]).filter((t): t is string => t != null),
      )
      const AWS_DB_TYPES = new Set(['kinesis', 's3', 'dynamodb', 'postgresql'])
      const declaredTypes = new Set(
        (svcDef?.databases ?? []).map(d => d.type as string).filter(t => AWS_DB_TYPES.has(t)),
      )
      report.awsClientUsage.push({
        service: repo,
        facts: awsFacts,
        missingDatabaseEntries: [...codeTypes].filter(t => !declaredTypes.has(t)).sort(),
        unevidencedDatabaseEntries: [...declaredTypes].filter(t => !codeTypes.has(t)).sort(),
      })
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
      addEvidence(repo, target, `package.json: ${pkg} (${usage} import)`, MONGO_CONTRACT_SDKS.has(pkg) ? `mongodb (shared collections, ${usage} import of the DTO contract)` : `rest (SDK client, ${usage} import)`)
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

  // ── Terraform ground truth (sibling <service>-tf checkouts) ────────────────
  let tfRepos: string[] = []
  try {
    tfRepos = fs.readdirSync(REPO_BASE, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.endsWith('-tf'))
      .map(e => e.name)
      .sort()
  } catch {
    // repo base unreadable — skip terraform pass
  }
  for (const tfRepo of tfRepos) {
    const facts = extractTerraform(REPO_BASE, tfRepo)
    if (!facts) continue
    const service = tfRepoToService(tfRepo)
    const inMap = serviceNames.has(service)
    report.terraform.push({ tfRepo, service, inMap, facts })
    if (!inMap) continue

    // DMS task targeting a kinesis endpoint = the provisioned side of the
    // monolith CDC/full-load backbone — authoritative evidence for the
    // service's cdc connection to skello-app.
    const kinesisTarget = facts.dmsEndpoints.find(e => e.engineName === 'kinesis' && e.endpointType === 'target')
    const dmsTask = facts.dmsTasks[0]
    if (kinesisTarget && dmsTask && connectivityMap.connections.some(c =>
      c.from === service && c.to === 'skello-app' && c.protocol === 'cdc')) {
      addEvidence(service, 'skello-app',
        `terraform ${tfRepo}: DMS ${dmsTask.migrationType ?? ''} task ${dmsTask.taskId ?? dmsTask.label} → kinesis endpoint ${kinesisTarget.endpointId ?? kinesisTarget.label}`,
        'cdc (DMS provision)')
    }
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

  if (AWS_SNAPSHOT_DIR) {
    report.awsLive = analyzeAwsLive(loadAwsSnapshot(AWS_SNAPSHOT_DIR), {
      serviceNames: connectivityMap.services.map(s => s.name),
      connections: connectivityMap.connections.map(c => ({ from: c.from, to: c.to, protocol: c.protocol })),
      recurringTasksByService: Object.fromEntries(
        connectivityMap.services.map(s => [s.name, (s.recurringTasks ?? []).map(t => t.name)]),
      ),
    })
  }
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

  console.log(`\n## 🌀 AWS event bindings (serverless config: streams, S3, schedules, owned resources)\n`)
  if (!r.awsBindings.length) {
    console.log('_none_')
  } else {
    for (const b of r.awsBindings) {
      console.log(`- **${b.service}**`)
      for (const s of b.streams) {
        const src = s.source === 'self'
          ? 'own stream (internal wiring)'
          : s.source === null
            ? '**source unmapped — needs a mapping decision**'
            : `source: ${s.source}${s.cdcChannelInMap ? ' ✅'
              : s.pairInMap ? ' — **pair mapped under another protocol only, cdc channel missing**'
                : ' — proposed in 🆕 candidates'}`
        console.log(`  - ${s.kind} stream \`${s.stream}\`${s.listeners > 1 ? ` ×${s.listeners}` : ''} — ${src}`)
      }
      for (const t of b.s3Triggers) {
        const src = t.source === 'self'
          ? 'own bucket (internal staging)'
          : t.source === null
            ? '**bucket owner unmapped — needs a mapping decision**'
            : `source: ${t.source}${t.s3ChannelInMap ? ' ✅'
              : t.pairInMap ? ' — **pair mapped under another protocol only, s3 channel missing**'
                : ' — proposed in 🆕 candidates'}`
        console.log(`  - s3 trigger on \`${t.bucket}\`${t.functionName ? ` (${t.functionName})` : ''} — ${src}`)
      }
      for (const sc of b.schedules) {
        console.log(`  - ⏰ ${sc.name} \`${sc.schedule}\`${sc.description ? ` — ${sc.description}` : ''}`)
      }
      for (const o of b.ownedResources) {
        console.log(`  - owns ${o.cfType.replace('AWS::', '')} \`${o.name}\``)
      }
    }
  }

  console.log(`\n## 🏗 Terraform ground truth (sibling *-tf checkouts)\n`)
  if (!r.terraform.length) {
    console.log('_no terraform checkouts found next to the repos_')
  } else {
    const platform = r.terraform.filter(t => !t.inMap)
    console.log(`${r.terraform.length} terraform repos scanned (${platform.length} platform/non-service).\n`)
    for (const t of r.terraform) {
      const bits: string[] = []
      const byType = new Map<string, number>()
      for (const res of t.facts.resources) byType.set(res.tfType, (byType.get(res.tfType) ?? 0) + 1)
      for (const [ty, n] of byType) bits.push(`${ty.replace('aws_', '')}×${n}`)
      if (t.facts.dmsTasks.length) bits.push(`dms-task×${t.facts.dmsTasks.length}`)
      if (t.facts.iamActions.length) bits.push(`iam[${t.facts.iamActions.slice(0, 4).join(',')}${t.facts.iamActions.length > 4 ? ',…' : ''}]`)
      console.log(`- **${t.tfRepo}**${t.inMap ? ` → ${t.service}` : ' _(platform)_'} — ${bits.join(' ') || 'no data resources'}`)
      for (const task of t.facts.dmsTasks) {
        const target = t.facts.dmsEndpoints.find(e => e.endpointType === 'target')
        console.log(`  - DMS ${task.migrationType ?? '?'} task \`${task.taskId ?? task.label}\`${target?.engineName ? ` → ${target.engineName}` : ''}`)
      }
    }
  }

  const usageDrift = r.awsClientUsage.filter(u => u.missingDatabaseEntries.length || u.unevidencedDatabaseEntries.length)
  console.log(`\n## 🔧 AWS client usage in application code (produce/read-write direction)\n`)
  if (!r.awsClientUsage.length) {
    console.log('_none_')
  } else {
    console.log(`${r.awsClientUsage.length} services scanned; ${usageDrift.length} with databases drift:\n`)
    for (const u of r.awsClientUsage) {
      const kinds = u.facts
        .map(f => `${f.kind}[${f.operations.join(',') || 'import-only'}]×${f.fileCount}`)
        .join(' ')
      console.log(`- **${u.service}** — ${kinds}`)
      for (const t of u.missingDatabaseEntries) {
        const files = u.facts.filter(f => f.kind === t)
          .flatMap(f => f.files).slice(0, 2)
        console.log(`  - 🆕 code uses **${t}** but service.databases has no entry (${files.join(', ')})`)
      }
      for (const t of u.unevidencedDatabaseEntries) {
        console.log(`  - ⚠️ databases declares **${t}** but no client code found`)
      }
    }
  }

  if (r.awsLive) {
    const live = r.awsLive
    console.log(`\n## 🛰 AWS live verification (read-only snapshot diff)\n`)
    const matches = live.streamConsumptions.filter(e => e.verdict === 'match')
    console.log(`${live.streamConsumptions.length} cross-service stream consumptions (${matches.length} match the map):`)
    for (const e of live.streamConsumptions) {
      const mark = e.verdict === 'match' ? '✅' : e.verdict === 'new' ? '🆕' : `⚠ pair in map as [${e.mapProtocols.join(',')}]`
      console.log(`- ${mark} ${e.consumer} → ${e.source} _(${e.via}, ${e.state})_`)
    }
    if (live.mapEdgesWithoutLiveBinding.length) {
      console.log(`\nMap cdc/kinesis edges with no live binding (informational — absence in this account is weak evidence):`)
      for (const e of live.mapEdgesWithoutLiveBinding) console.log(`- ⏭ ${e.from} → ${e.to} (${e.protocol})`)
    }
    if (live.orphanQueues.length) {
      console.log(`\nService-prefixed queues with NO consumer binding (orphan candidates):`)
      for (const q of live.orphanQueues) console.log(`- ❓ ${q}`)
    }
    if (live.bucketCouplings.length) {
      console.log(`\nBucket-notification couplings:`)
      for (const b of live.bucketCouplings) console.log(`- ${b.bucket} → ${b.targets.join(' | ')}`)
    }
    if (live.dmsTasks.length) {
      console.log(`\nDMS replication tasks:`)
      for (const t of live.dmsTasks) console.log(`- ${t.status.padEnd(8)} ${t.id} [${t.type}]`)
    }
    if (live.scheduledRules.length) {
      console.log(`\nScheduled rules:`)
      for (const s of live.scheduledRules) {
        console.log(`- ${s.known ? '✅' : '🆕'} [${s.state}] ${s.rule} \`${s.schedule}\`${s.service ? ` (${s.service})` : ''}`)
      }
    }
    if (live.unresolvedPrefixes.length) {
      console.log(`\nUnresolved function prefixes (noise/POCs/unmodeled): ${live.unresolvedPrefixes.join(', ')}`)
    }
  }

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

  const cl = r.codeLayerCheck
  console.log(`\n## 🫀 Flow code layers (${cl.findings.length} findings)\n`)
  if (cl.flowsWithCodeLayer === 0) {
    console.log('_no flow declares a code layer yet_')
  } else {
    console.log(`${cl.flowsWithCodeLayer} flow(s) with a code layer — ${cl.pathsVerified} unit paths verified on disk, ${cl.edgesVerified} call edges verified by reference.`
      + (cl.skippedRepos.length ? ` Skipped (repo not checked out): ${cl.skippedRepos.join(', ')}.` : ''))
    if (cl.findings.length) {
      console.log(cl.findings.map(f => `- [${f.kind}] **${f.flow}**: ${f.detail}`).join('\n'))
    } else {
      console.log('_every code unit path exists and every call edge is referenced from its caller_')
    }
  }

  const rc = r.ruleCheck
  console.log(`\n## 📐 Domain rules (${rc.findings.length} findings)\n`)
  if (rc.rulesChecked === 0) {
    console.log('_no domain rules declared yet_')
  } else {
    console.log(`${rc.rulesChecked} rule(s) — ${rc.pathsVerified} source paths verified on disk.`
      + (rc.skippedRepos.length ? ` Skipped (repo not checked out): ${rc.skippedRepos.join(', ')}.` : ''))
    if (rc.findings.length) {
      console.log(rc.findings.map(f => `- [${f.kind}] **${f.rule}**: ${f.detail}`).join('\n'))
    } else {
      console.log('_every rule source path exists_')
    }
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
