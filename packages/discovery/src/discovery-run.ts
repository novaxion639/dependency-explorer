import * as fs from 'node:fs'
import * as path from 'node:path'
import { flowListenerDrift } from '@dependency-explorer/data'
import type { ConnectivityMap, DatadogOverlay, JiraOverlay, DiscoveredOverlay, Listener, ListenerSurface, Resource, ResourceRelation, ResourceSurface, WriteSite } from '@dependency-explorer/schema'
import { IGNORED_SDKS, MONGO_CONTRACT_SDKS, sdkToServiceName, isStructuralGithubTeam, FRONTEND_HOST_ALIASES, streamSourceService, tfRepoToService } from './mapping'
import { normalizeEndpoint, normalizeEndpointVersionless, isBoilerplateEndpoint } from './endpoints'
import { extractTsRepo, extractRepoOwnership, type TsRepoFacts } from './extractors/typescript'
import { extractRailsMonolith } from './extractors/rails'
import { extractServerless, type ServerlessFacts } from './extractors/serverless'
import { extractAwsClients, type AwsUsageFact, type AwsUsageKind } from './extractors/aws-clients'
import { channelKey, stampKeyOf } from './connection-stamps'
import { loadAwsSnapshot, analyzeAwsLive, type AwsLiveFindings } from './extractors/aws-live'
import { joinDatadog, type DatadogJoin } from './extractors/datadog'
import { readDatadogSnapshot } from './datadog/snapshot'
import { overlayOf } from './datadog/overlay'
import { joinJira, type JiraJoin } from './extractors/jira'
import { buildJiraOverlay } from './jira/overlay'
import { readJiraSnapshot } from './jira/snapshot'
import { buildDeliveryOverlay, type DeliveryReport } from './delivery/overlay'
import { extractTerraform, type TerraformFacts } from './extractors/terraform'
import { extractRailsRoutes, type RailsRoute } from './extractors/rails-routes'
import { extractFrontend } from './extractors/frontend'
import { findQueueSenders, walkFiles } from './extractors/queue-senders'
import { tableRelations, messagingRelations, atlasRelations, dmsRelations, dedupeRelations } from './resource-relations'
import { checkFlows, checkFlowCodeLayers, checkDomainRules, checkFeatureFlags, checkFailureLayer, checkAuthContext, checkPiiRefs, type FlowCheckResult, type CodeLayerCheckResult, type RuleCheckResult, type FlagCheckResult, type FailureCheckResult, type AuthCheckResult, type PiiCheckResult } from './flow-check'
import { extractPiiFacts, type PiiFacts } from './extractors/pii'
import { extractSwagger } from './extractors/swagger'
import type { ContractCheckResult } from './flow-check'
import { checkContractRefs } from './flow-check'
import { extractSdkRegistry } from './extractors/sdk-registry'
import { verifySdkUsage, type SdkUsageFinding } from './sdk-usage'
import { checkAreas, COVERAGE_ROOTS, type AreaCheckResult } from './area-check'
import { pinRepos, buildGraphs, emptyPinError, type PinnedRepo, type PinSkip } from './pinned'
import { checkCodeGrades, loadRepoGraph, type Grade, type GradeFinding } from './code-grades'
import { checkBranches } from './branch-check'
import { checkStateMachines } from './state-machine-check'
import { extractRailsSchema } from './extractors/rails-schema'
import { buildRegistry } from './resource-registry'
import { checkResources, type ResourceFinding } from './resource-check'
import { extractListeners } from './extractors/rails-listeners'
import { cdcRelations } from './cdc'
import { surfaceDrift, type ListenerCheck } from './listener-check'
import { readerFor } from './code-wiring'

function scanTargets(base: string): string[] {
  return fs.readdirSync(base, { withFileTypes: true })
    .filter(e => e.isDirectory() && (e.name.startsWith('svc-') || e.name.endsWith('-tf') || ['skello-app', 'skello-app-front', 'superadmin', 'skello-mobile', 'skello-punchclock', 'skello-libs-ts'].includes(e.name)))
    .map(e => e.name)
    .sort()
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

export interface Report {
  pinned: { repos: PinnedRepo[]; skipped: PinSkip[] } | null
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
  monolithSurface: { totalRoutes: number; unparsed: string[]; topSegments: Array<[string, number]> } | null
  /** SDK dependencies whose imports are type-only or absent — weak evidence, likely not runtime calls */
  weakSdkEvidence: Array<{ from: string; to: string; pkg: string; usage: string }>
  /** call-site verification of SDK connections against the skello-libs-ts registry */
  sdkUsage: SdkUsageFinding[]
  sdkRegistryStats: { packages: number; methods: number } | null
  flowCheck: FlowCheckResult
  codeLayerCheck: CodeLayerCheckResult
  branchCheck: ReturnType<typeof checkBranches>
  machineCheck: ReturnType<typeof checkStateMachines>
  resourceCheck: { findings: ResourceFinding[]; modelLess: string[]; total: number; byKind: Record<string, number> } | null
  liveResources: Resource[]
  liveRelations: ResourceRelation[]
  listenerCheck: ListenerCheck | null
  liveListeners: { listeners: Listener[]; writeSites: WriteSite[] } | null
  codeGrades: { findings: GradeFinding[]; grades: Record<string, Grade>; distribution: Record<Grade, number>; backlog: string[] } | null
  ruleCheck: RuleCheckResult
  areaCheck: AreaCheckResult
  flagCheck: FlagCheckResult
  failureCheck: FailureCheckResult
  authCheck: AuthCheckResult
  piiFacts: PiiFacts | null
  piiCheck: PiiCheckResult
  contractCheck: ContractCheckResult
  ignoredSdks: Record<string, string[]>
  reposWithoutServiceDefinition: Array<{ repo: string; httpEndpoints: number; queues: number }>
  railsUnmapped: string[]
  unmappedGithubTeams: string[]
  serviceFacts: DiscoveredOverlay['services']
  /** Layer 4: read-only AWS snapshot diff (only with --aws <dir>) */
  awsLive: AwsLiveFindings | null
  datadog: { join: DatadogJoin; overlay: DatadogOverlay } | null
  jira: { join: JiraJoin; overlay: JiraOverlay } | null
  delivery: DeliveryReport | null
}

export interface Dataset {
  map: ConnectivityMap
  resources: ResourceSurface
  committedListeners: ListenerSurface | null
}

export interface DiscoveryOptions {
  sourceBase: string
  dataset: Dataset
  pinnedBase?: string
  fetchOrigin?: boolean
  buildGraph?: (cwd: string) => void
  now?: Date
  awsSnapshotDir?: string
  datadogSnapshotDir?: string
  jiraSnapshotDir?: string
  delivery?: boolean
}

export const OUTPUT_FILES = ['discovered.json', 'monolith-routes.json', 'resources.json', 'listeners.json'] as const

export class PinError extends Error {}

function findRepos(repoBase: string): string[] {
  try {
    return fs.readdirSync(repoBase, { withFileTypes: true })
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
function pickTeamId(slugToTeamId: Map<string, string>, wildcardOwners: string[]): string | undefined {
  const mapped = [...new Set(wildcardOwners.filter(slug => slugToTeamId.has(slug)))]
  return mapped.length === 1 ? slugToTeamId.get(mapped[0]!) : undefined
}


function datadogOf(dir: string, dataset: Dataset, repoBase: string, pinned: boolean): Report['datadog'] {
  const snapshot = readDatadogSnapshot(dir)
  const join = joinDatadog(snapshot, dataset)
  return { join, overlay: overlayOf(snapshot, join, repoBase, pinned) }
}

function jiraOf(dir: string, map: ConnectivityMap): Report['jira'] {
  const snapshot = readJiraSnapshot(dir)
  const join = joinJira(snapshot, map)
  return { join, overlay: buildJiraOverlay(snapshot, join, map, new Date(snapshot.meta.fetchedAt)) }
}

// ── Scan ──────────────────────────────────────────────────────────────────────

export function runDiscovery(options: DiscoveryOptions): Report {
  const { sourceBase, pinnedBase, dataset } = options
  const pin = pinnedBase ? pinRepos(scanTargets(sourceBase), sourceBase, pinnedBase, undefined, options.fetchOrigin) : null
  const pinError = pin ? emptyPinError(pin.pinned.length, sourceBase) : null
  if (pinError) {
    throw new PinError(pinError)
  }
  const connectivityMap = dataset.map
  const resourceSurface = dataset.resources
  const codeRepos = new Set(connectivityMap.flows.flatMap(f => (f.codeUnits ?? []).map(u => u.service)))
  if (pin) {
    pin.skipped.push(...buildGraphs(pin.pinned.filter(p => codeRepos.has(p.repo)), options.buildGraph))
  }
  const repoBase = pinnedBase || sourceBase
  const today = (options.now ?? new Date()).toISOString().slice(0, 10)
  const awsSnapshotDir = options.awsSnapshotDir

  const serviceNames = new Set(connectivityMap.services.map(s => s.name))
  const connectionKeys = new Set(connectivityMap.connections.map(c => `${c.from}→${c.to}`))
  const connectionsByKey = new Map(connectivityMap.connections.map(c => [`${c.from}→${c.to}`, c]))
  const slugToTeamId = new Map<string, string>()
  for (const team of connectivityMap.teams ?? []) {
    for (const slug of team.githubTeams ?? []) slugToTeamId.set(slug, team.id)
  }

  const repos = findRepos(repoBase)
  const railsRoutes = extractRailsRoutes(repoBase)
  const report: Report = {
    pinned: pin ? { repos: pin.pinned, skipped: pin.skipped } : null,
    resourceCheck: null,
    liveResources: [],
    liveRelations: [],
    listenerCheck: null,
    liveListeners: null,
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
    codeGrades: pin ? checkCodeGrades(connectivityMap, repoBase, repo => pin.pinned.find(p => p.repo === repo)?.sha ?? null, railsRoutes ? railsRoutes.routes : []) : null,
    branchCheck: checkBranches(connectivityMap, repoBase),
    machineCheck: checkStateMachines(connectivityMap, repoBase),
    codeLayerCheck: checkFlowCodeLayers(connectivityMap, repoBase, railsRoutes ? new Set(railsRoutes.routes.map(r => r.controllerFile)) : undefined),
    ruleCheck: checkDomainRules(connectivityMap, repoBase),
    areaCheck: checkAreas({
      areas: connectivityMap.areas ?? [],
      externals: connectivityMap.externals ?? [],
      repoBase,
      coverageRoots: COVERAGE_ROOTS,
    }),
    flagCheck: checkFeatureFlags(connectivityMap, repoBase),
    // filled after the repo loop — needs the extracted serverless/tf DLQ facts
    failureCheck: { findings: [], inScopeEdges: 0, verifiedDlqs: 0, waivers: 0, skippedServices: [] },
    // filled after the repo loop — needs the extracted authorizer declarations
    authCheck: { findings: [], gatesChecked: 0, gatesVerified: 0, authorizersChecked: 0, authorizersVerified: 0, skippedRepos: [] },
    piiFacts: null,
    piiCheck: { findings: [], refsChecked: 0, refsVerified: 0, skippedServices: [] },
    contractCheck: { findings: [], refsChecked: 0, refsVerified: 0, skippedServices: [] },
    ignoredSdks: {},
    reposWithoutServiceDefinition: [],
    railsUnmapped: [],
    unmappedGithubTeams: [],
    serviceFacts: {},
    awsLive: null,
    datadog: options.datadogSnapshotDir ? datadogOf(options.datadogSnapshotDir, dataset, repoBase, pin !== null) : null,
    jira: options.jiraSnapshotDir ? jiraOf(options.jiraSnapshotDir, dataset.map) : null,
    delivery: options.delivery
      ? buildDeliveryOverlay(
        repos.filter(repo => serviceNames.has(repo)).map(repo => ({ service: repo, dir: path.join(sourceBase, repo) })),
        options.now ?? new Date(),
        pin !== null && options.fetchOrigin !== false,
      )
      : null,
  }

  const allSlugs = new Set<string>()
  const candidatesByKey = new Map<string, Candidate>()

  const addEvidence = (from: string, to: string, evidence: string, transport: string) => {
    const key = `${from}→${to}`
    if (connectionKeys.has(key)) {
      const stamp = stampKeyOf(connectivityMap.connections, from, to, transport)
      if (stamp) {
        ;(report.connectionEvidence[stamp] ??= []).push(evidence)
      }
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
    const tsFacts: TsRepoFacts | null = extractTsRepo(repoBase, repo)
    const codeowners = tsFacts?.codeowners ?? extractRepoOwnership(repoBase, repo)
    Object.keys(codeowners.counts).forEach(s => allSlugs.add(s))

    const sls = extractServerless(repoBase, repo)
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
      teamId: pickTeamId(slugToTeamId, codeowners.wildcardOwners),
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
    const awsFacts = extractAwsClients(repoBase, repo)
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
  const rails = extractRailsMonolith(repoBase)
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
  const front = extractFrontend(repoBase)
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

  // ── Failure layer (🧯): async edges vs extracted DLQ wiring ────────────────
  const dlqByService = new Map<string, ServerlessFacts['dlqWirings']>()
  for (const [repo, sls] of serverlessByRepo) {
    if (serviceNames.has(repo) && sls.dlqWirings.length) dlqByService.set(repo, sls.dlqWirings)
  }
  report.failureCheck = checkFailureLayer(connectivityMap, dlqByService)

  // ── Auth context (🔐): gates in source + authorizers vs extracted facts ────
  const authorizersByService = new Map<string, string[]>()
  for (const [repo, sls] of serverlessByRepo) {
    if (serviceNames.has(repo) && sls.authorizerNames.length) authorizersByService.set(repo, sls.authorizerNames)
  }
  report.authCheck = checkAuthContext(connectivityMap, repoBase, authorizersByService)

  // ── Contract refs (📜): edge refs vs generated TSOA specs ──────────────────
  const operationsByService = new Map<string, Map<string, string>>()
  for (const repo of repos) {
    if (!serviceNames.has(repo)) continue
    const sw = extractSwagger(repoBase, repo)
    if (sw) operationsByService.set(repo, sw.operations)
  }
  report.contractCheck = checkContractRefs(connectivityMap, operationsByService)

  // ── PII surface (🧬): lib-anonymizer decorator scan + edge-ref verification ─
  report.piiFacts = extractPiiFacts(repoBase)
  if (report.piiFacts) {
    const piiTypedByService = new Map<string, Set<string>>()
    for (const fact of report.piiFacts.piiTyped) {
      const service = fact.pkg.replace(/-sdk$/, '').replace(/-js$/, '')
      const target = service.startsWith('svc-') ? service : `svc-${service}`
      if (!serviceNames.has(target)) continue
      if (!piiTypedByService.has(target)) piiTypedByService.set(target, new Set())
      piiTypedByService.get(target)!.add(fact.field)
    }
    report.piiCheck = checkPiiRefs(connectivityMap, piiTypedByService)
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
  const senders = findQueueSenders(repoBase, senderRepos, queueOwners)
  for (const s of senders) {
    report.asyncSenders.push(s)
    addEvidence(s.from, s.to, `queue literal ${s.queues.join(', ')} in ${s.files.join(', ')}`, 'sqs (queue literal)')
  }

  // ── Terraform ground truth (sibling <service>-tf checkouts) ────────────────
  let tfRepos: string[] = []
  try {
    tfRepos = fs.readdirSync(repoBase, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.endsWith('-tf'))
      .map(e => e.name)
      .sort()
  } catch {
    // repo base unreadable — skip terraform pass
  }
  for (const tfRepo of tfRepos) {
    const facts = extractTerraform(repoBase, tfRepo)
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
          lastVerified: today,
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
  const registry = extractSdkRegistry(repoBase)
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
      repoBase,
      sdkValueEdges.map(e => ({ ...e, usedEndpoints: connectionsByKey.get(`${e.from}→${e.to}`)?.usedEndpoints ?? [] })),
      registry,
      endpointIdsByService,
    )
  }

  // ── Monolith inbound surface (informational) ───────────────────────────────
  const routes = railsRoutes
  if (routes) {
    const bySegment = new Map<string, number>()
    for (const route of routes.routes) {
      const seg = route.path.split('/')[1] ?? ''
      bySegment.set(seg, (bySegment.get(seg) ?? 0) + 1)
    }
    report.monolithSurface = {
      totalRoutes: routes.routes.length,
      unparsed: routes.unparsed,
      topSegments: [...bySegment].sort((a, b) => b[1] - a[1]).slice(0, 12),
    }
  }

  // ── Reverse pass: every dataset connection needs evidence or an explanation ─
  for (const conn of connectivityMap.connections) {
    if (report.connectionEvidence[channelKey(conn)]?.length) continue

    if (!fs.existsSync(path.join(repoBase, conn.from))) {
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

  if (awsSnapshotDir) {
    report.awsLive = analyzeAwsLive(loadAwsSnapshot(awsSnapshotDir), {
      serviceNames: connectivityMap.services.map(s => s.name),
      connections: connectivityMap.connections.map(c => ({ from: c.from, to: c.to, protocol: c.protocol })),
      recurringTasksByService: Object.fromEntries(
        connectivityMap.services.map(s => [s.name, (s.recurringTasks ?? []).map(t => t.name)]),
      ),
    })
  }

  // ── Resource registry (🗄) ─────────────────────────────────────────────────
  const railsSchema = extractRailsSchema(repoBase)
  const live = buildRegistry({
    monolith: railsSchema,
    serverless: serverlessByRepo,
    terraform: report.terraform.filter(t => t.inMap).map(t => ({ service: t.service, tfRepo: t.tfRepo, facts: t.facts })),
    services: connectivityMap.services,
  })
  report.liveResources = live
  const readSources = (repo: string, files: string[]) =>
    files.map(f => ({ file: path.relative(path.join(repoBase, repo), f), source: fs.readFileSync(f, 'utf-8') }))
  const monolithFiles = railsSchema
    ? readSources('skello-app', ['app', 'lib', 'config'].flatMap(dir => walkFiles(path.join(repoBase, 'skello-app', dir))).filter(f => f.endsWith('.rb')))
    : []
  const graphFile = path.join(repoBase, 'skello-app', 'graphify-out', 'graph.json')
  const monolithPin = pin?.pinned.find(p => p.repo === 'skello-app')
  const parsedGraph = monolithPin && fs.existsSync(graphFile) ? loadRepoGraph(JSON.parse(fs.readFileSync(graphFile, 'utf-8'))) : null
  const monolithGraph = parsedGraph && parsedGraph.builtAt === monolithPin?.sha ? parsedGraph : null
  const sourcesByRepo = new Map(repos.filter(repo => repo !== 'skello-app-front').map(repo => [repo, readSources(repo, [
    ...['src', 'app', 'lib', 'serverless', 'config'].flatMap(d => walkFiles(path.join(repoBase, repo, d))),
    ...['serverless.ts', 'serverless.yml'].map(f => path.join(repoBase, repo, f)).filter(f => fs.existsSync(f)),
  ])]))
  report.liveRelations = dedupeRelations([
    ...tableRelations(live, railsSchema?.models ?? [], monolithFiles, monolithGraph),
    ...messagingRelations(live, serverlessByRepo, sourcesByRepo),
    ...atlasRelations(report.terraform.filter(t => t.inMap), live),
    ...dmsRelations(report.terraform.filter(t => t.inMap), live),
  ])
  const cdc = railsSchema
    ? cdcRelations({ terraform: report.terraform.filter(t => t.inMap), resources: live, serverless: serverlessByRepo, schemaTables: railsSchema.tables, repoBase })
    : { relations: [], findings: [] }
  report.liveRelations = dedupeRelations([...report.liveRelations, ...cdc.relations])
  const extraction = railsSchema && monolithPin
    ? extractListeners({ models: railsSchema.models, tables: railsSchema.tables, files: monolithFiles, read: readerFor(path.join(repoBase, 'skello-app')), graph: monolithGraph })
    : null
  report.liveListeners = extraction ? { listeners: extraction.listeners, writeSites: extraction.writeSites } : null
  report.listenerCheck = extraction
    ? {
        findings: [
          ...extraction.findings,
          ...cdc.findings,
          ...connectivityMap.flows.flatMap(f => flowListenerDrift(f, extraction)),
          ...surfaceDrift({ listeners: extraction.listeners, writeSites: extraction.writeSites, cdc: cdc.relations }, { surface: dataset.committedListeners, relations: resourceSurface.relations }),
        ],
        listeners: extraction.listeners.length,
        writeSites: extraction.writeSites.length,
        feeds: cdc.relations.filter(r => r.relation === 'feeds').length,
        skipped: false,
      }
    : { findings: [], listeners: 0, writeSites: 0, feeds: 0, skipped: true }
  const resourceFacts = checkResources(resourceSurface.resources, live, railsSchema?.models ?? [], railsSchema?.tables ?? [], monolithGraph !== null)
  const byKind: Record<string, number> = {}
  for (const x of live) {
    byKind[x.kind] = (byKind[x.kind] ?? 0) + 1
  }
  report.resourceCheck = { ...resourceFacts, total: live.length, byKind }
  return report
}

// ── Apply ─────────────────────────────────────────────────────────────────────

export function writeOutputs(report: Report, target: { outDir: string; repoBase: string; now: Date }): void {
  const [overlayFile, monolithRoutesFile, resourcesFile, listenersFile] = OUTPUT_FILES
  const overlayPath = path.resolve(target.outDir, overlayFile)
  const monolithRoutesPath = path.resolve(target.outDir, monolithRoutesFile)
  const resourcesPath = path.resolve(target.outDir, resourcesFile)
  const listenersPath = path.resolve(target.outDir, listenersFile)
  const today = target.now.toISOString().slice(0, 10)
  const overlay: DiscoveredOverlay = {
    generatedAt: target.now.toISOString(),
    scannedRepos: report.scannedRepos,
    services: report.serviceFacts,
    connections: Object.fromEntries(
      Object.entries(report.connectionEvidence).map(([key, evidences]) => [
        key,
        { lastVerified: today, evidence: evidences.join('; ') },
      ]),
    ),
    endpoints: report.endpointStamps,
    areaFiles: report.areaCheck.areaFiles,
    areaCoverage: Object.fromEntries(
      Object.entries(report.areaCheck.coverage).map(([repo, c]) => [repo, { mapped: c.mapped, total: c.total }]),
    ),
    codeEdgeGrades: report.codeGrades?.grades,
  }
  fs.mkdirSync(path.dirname(overlayPath), { recursive: true })
  fs.writeFileSync(overlayPath, JSON.stringify(overlay, null, 2) + '\n')
  console.log(`\nOverlay written: ${path.relative(process.cwd(), overlayPath)}`)
  console.log(`  ${Object.keys(overlay.services).length} services enriched, ${Object.keys(overlay.connections).length} connections verified, ${Object.keys(overlay.endpoints ?? {}).length} endpoints verified`)

  const routes = extractRailsRoutes(target.repoBase)?.routes
  if (routes) {
    const byId = new Map<string, RailsRoute>()
    for (const r of routes) {
      if (!byId.has(`${r.verb} ${r.path}`)) {
        byId.set(`${r.verb} ${r.path}`, r)
      }
    }
    const surface = [...byId.values()].sort((a, b) => a.path.localeCompare(b.path) || a.verb.localeCompare(b.verb))
    fs.writeFileSync(monolithRoutesPath, JSON.stringify(surface, null, 2) + '\n')
    console.log(`  ${surface.length} monolith routes written: ${path.relative(process.cwd(), monolithRoutesPath)}`)
  }
  if (report.resourceCheck?.findings.some(f => f.kind === 'readers-unavailable')) {
    console.error('  resources.json not written: no skello-app graph at the pinned commit (🗄 readers-unavailable)')
    return
  }
  fs.writeFileSync(resourcesPath, JSON.stringify({ resources: report.liveResources, relations: report.liveRelations, pins: Object.fromEntries((report.pinned?.repos ?? []).map(p => [p.repo, p.sha]).sort()) }, null, 2) + '\n')
  console.log(`  ${report.liveResources.length} resources written: ${path.relative(process.cwd(), resourcesPath)}`)
  if (report.liveListeners) {
    const pin = report.pinned?.repos.find(p => p.repo === 'skello-app')
    fs.writeFileSync(listenersPath, JSON.stringify({ ...report.liveListeners, pins: pin ? { 'skello-app': pin.sha } : {} }, null, 2) + '\n')
    console.log(`  ${report.liveListeners.listeners.length} listeners written: ${path.relative(process.cwd(), listenersPath)}`)
  }
}
