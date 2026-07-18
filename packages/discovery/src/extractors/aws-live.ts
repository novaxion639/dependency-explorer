/**
 * AWS live verification (Layer 4) — the deployed estate as ground truth.
 *
 * Consumes a read-only snapshot of one AWS account (event source mappings,
 * queues, topics + subscription attributes, DMS tasks, EventBridge rules,
 * bucket notification configs, table/stream inventories) and diffs it against
 * the map. The snapshot is a directory of `aws` CLI JSON dumps — analysis is
 * pure and replayable without credentials; fetching lives in aws-fetch.ts.
 *
 * Account doctrine (docs research/aws-live-verification-credentials.md):
 * the sandbox account is the verification target. Presence there is strong
 * evidence; absence is weak (a resource may be prod-only), so absence
 * findings stay informational and never mark map edges stale.
 *
 * Direction convention: map `cdc` edges run consumer → source ("X consumes
 * skello-app's bus"), so live source→consumer bindings are compared on the
 * inverted pair.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { streamSourceService } from '../mapping'

// ── Snapshot shape (file names match the `aws` CLI dump layout) ─────────────

export interface AwsSnapshot {
  eventSourceMappings: Array<{ FunctionArn?: string; EventSourceArn?: string; State?: string }>
  sqsQueueUrls: string[]
  snsSubscriptionAttributes: Array<{ topic: string; protocol: string; endpoint: string; filterPolicy?: unknown }>
  dmsTasks: Array<{ ReplicationTaskIdentifier: string; Status: string; MigrationType: string }>
  eventBridgeTargets: Array<{ rule: string; schedule: string | null; state: string; targets: string[] }>
  dynamoTableNames: string[]
  kinesisStreamNames: string[]
  s3Notifications: Record<string, {
    QueueConfigurations?: Array<{ QueueArn: string }>
    LambdaFunctionConfigurations?: Array<{ LambdaFunctionArn: string }>
    TopicConfigurations?: Array<{ TopicArn: string }>
  }>
}

const SNAPSHOT_FILES: Record<string, string> = {
  eventSourceMappings: 'event-source-mappings.json',
  sqsQueues: 'sqs-queues.json',
  snsSubAttributes: 'sns-sub-attributes.json',
  dmsTasks: 'dms-tasks.json',
  eventBridgeTargets: 'eventbridge-targets.json',
  dynamoTables: 'dynamo-tables.json',
  kinesisStreams: 'kinesis-streams.json',
  s3Notifications: 's3-notifications.json',
}

/** Reads a snapshot directory; missing files degrade to empty sections. */
export function loadAwsSnapshot(dir: string): AwsSnapshot {
  const read = (file: string): any => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    } catch {
      return null
    }
  }
  return {
    eventSourceMappings: read(SNAPSHOT_FILES.eventSourceMappings)?.EventSourceMappings ?? [],
    sqsQueueUrls: read(SNAPSHOT_FILES.sqsQueues)?.QueueUrls ?? [],
    snsSubscriptionAttributes: read(SNAPSHOT_FILES.snsSubAttributes) ?? [],
    dmsTasks: read(SNAPSHOT_FILES.dmsTasks)?.ReplicationTasks ?? [],
    eventBridgeTargets: read(SNAPSHOT_FILES.eventBridgeTargets) ?? [],
    dynamoTableNames: read(SNAPSHOT_FILES.dynamoTables)?.TableNames ?? [],
    kinesisStreamNames: read(SNAPSHOT_FILES.kinesisStreams)?.StreamNames ?? [],
    s3Notifications: read(SNAPSHOT_FILES.s3Notifications) ?? {},
  }
}

// ── Name resolution ──────────────────────────────────────────────────────────

/** Deployment-stage suffixes carried by every resource name in an account. */
export function stripEnvSuffix(name: string): string {
  return name.replace(/-(sdbx|sandbox|staging|production|prod)\b/g, '')
}

function camelOf(kebab: string): string {
  return kebab.split('-').map((p, i) => (i === 0 ? p : p[0]!.toUpperCase() + p.slice(1))).join('')
}

/**
 * Resolves a resource-name prefix (lambda function, table, queue) to a map
 * service. Exact first-token match, then longest camel token that prefixes
 * the normalized name (handles multi-dash names like svcDocuments-eSignature-V2).
 */
export function buildServiceResolver(serviceNames: string[]): (resourceName: string) => string | null {
  const byCamel = new Map<string, string>()
  for (const n of serviceNames) byCamel.set(camelOf(n).toLowerCase(), n)
  byCamel.set('skelloapp', 'skello-app')
  byCamel.set('websocket', 'svc-websockets') // legacy queue family naming

  return (resourceName: string) => {
    const direct = byCamel.get(resourceName.split('-')[0]!.toLowerCase())
    if (direct) return direct
    const norm = resourceName.replace(/[^a-z0-9]/gi, '').toLowerCase()
    let best: string | null = null
    let bestLen = 0
    for (const [camel, svc] of byCamel) {
      if (norm.startsWith(camel) && camel.length > bestLen) {
        best = svc
        bestLen = camel.length
      }
    }
    return best
  }
}

// ── Analysis ─────────────────────────────────────────────────────────────────

export type LiveVerdict = 'match' | 'new' | 'pair-other-protocol'

export interface AwsLiveFindings {
  /** Cross-service stream consumption derived from event source mappings (deduped). */
  streamConsumptions: Array<{ consumer: string; source: string; via: string; state: string; verdict: LiveVerdict; mapProtocols: string[] }>
  /** Map cdc/kinesis edges with no live binding — informational (absence is weak evidence). */
  mapEdgesWithoutLiveBinding: Array<{ from: string; to: string; protocol: string }>
  /** Service-prefixed queues with no consumer binding (DLQs excluded). */
  orphanQueues: string[]
  /** Live bucket → notification-target couplings. */
  bucketCouplings: Array<{ bucket: string; targets: string[] }>
  dmsTasks: Array<{ id: string; status: string; type: string }>
  /** Scheduled rules resolved to a service; known = matches a map recurringTask. */
  scheduledRules: Array<{ rule: string; schedule: string; state: string; service: string | null; known: boolean }>
  /** Function-name prefixes the resolver could not map (sandbox noise, POCs, unmodeled services). */
  unresolvedPrefixes: string[]
}

export interface AwsLiveInputs {
  serviceNames: string[]
  connections: Array<{ from: string; to: string; protocol: string }>
  recurringTasksByService: Record<string, string[]>
}

export function analyzeAwsLive(snapshot: AwsSnapshot, inputs: AwsLiveInputs): AwsLiveFindings {
  const resolve = buildServiceResolver(inputs.serviceNames)
  const pairProtocols = new Map<string, Set<string>>()
  for (const c of inputs.connections) {
    const k = `${c.from}→${c.to}`
    if (!pairProtocols.has(k)) pairProtocols.set(k, new Set())
    pairProtocols.get(k)!.add(c.protocol)
  }

  // event source mappings → stream consumption + sqs bindings
  const consumptions = new Map<string, AwsLiveFindings['streamConsumptions'][number]>()
  const boundQueues = new Set<string>()
  const unresolved = new Set<string>()

  for (const m of snapshot.eventSourceMappings) {
    const fnName = (m.FunctionArn ?? '').split(':function:')[1] ?? ''
    const src = m.EventSourceArn ?? ''
    const kind = src.split(':')[2]
    const consumer = resolve(fnName)
    if (!consumer) {
      if (fnName) unresolved.add(fnName.split('-')[0]!)
      continue
    }

    let source: string | null = null
    let via = ''
    if (kind === 'kinesis') {
      const stream = stripEnvSuffix((src.split(':stream/')[1] ?? '').split('/')[0]!)
      const resolved = streamSourceService(stream, consumer, inputs.serviceNames)
      source = resolved === 'self' ? consumer : resolved
      via = `kinesis ${stream}`
    } else if (kind === 'dynamodb') {
      const table = stripEnvSuffix((src.split(':table/')[1] ?? '').split('/stream/')[0]!)
      source = resolve(table)
      via = `dynamo-stream ${table}`
    } else if (kind === 'sqs') {
      boundQueues.add(stripEnvSuffix(src.split(':').pop()!).toLowerCase())
      continue
    } else {
      continue
    }

    if (!source || source === consumer) continue // own stream or unresolvable = internal wiring
    const key = `${consumer}→${source} ${via}`
    if (consumptions.has(key)) continue
    const protocols = [...(pairProtocols.get(`${consumer}→${source}`) ?? [])]
    const verdict: LiveVerdict = protocols.length === 0 ? 'new'
      : (protocols.includes('cdc') || protocols.includes('kinesis')) ? 'match'
      : 'pair-other-protocol'
    consumptions.set(key, { consumer, source, via, state: m.State ?? '?', verdict, mapProtocols: protocols })
  }

  const streamConsumptions = [...consumptions.values()]
  const livePairs = new Set(streamConsumptions.map(e => `${e.consumer}→${e.source}`))
  const mapEdgesWithoutLiveBinding = inputs.connections
    .filter(c => (c.protocol === 'cdc' || c.protocol === 'kinesis') && !livePairs.has(`${c.from}→${c.to}`))
    .map(({ from, to, protocol }) => ({ from, to, protocol }))

  // orphan queues: service-prefixed, no consumer binding, not a DLQ
  const orphanQueues = snapshot.sqsQueueUrls
    .map(u => stripEnvSuffix(u.split('/').pop()!))
    .filter(q => resolve(q) !== null)
    .filter(q => !boundQueues.has(q.toLowerCase()) && !/dlq|dead-?letter|-dl$/i.test(q))
    .sort()

  // bucket notification couplings
  const bucketCouplings: AwsLiveFindings['bucketCouplings'] = []
  for (const [bucket, cfg] of Object.entries(snapshot.s3Notifications)) {
    const targets = [
      ...(cfg.QueueConfigurations ?? []).map(q => `sqs:${q.QueueArn.split(':').pop()}`),
      ...(cfg.LambdaFunctionConfigurations ?? []).map(l => `lambda:${l.LambdaFunctionArn.split(':function:').pop()}`),
      ...(cfg.TopicConfigurations ?? []).map(t => `sns:${t.TopicArn.split(':').pop()}`),
    ]
    if (targets.length) bucketCouplings.push({ bucket, targets })
  }

  // scheduled rules vs map recurring tasks
  const scheduledRules: AwsLiveFindings['scheduledRules'] = []
  for (const r of snapshot.eventBridgeTargets) {
    if (!r.schedule) continue
    const targetNames = (r.targets ?? []).map(a => a.split(':').pop() ?? '')
    const service = resolve(stripEnvSuffix(r.rule)) ?? targetNames.map(t => resolve(stripEnvSuffix(t))).find(Boolean) ?? null
    const taskNames = service ? inputs.recurringTasksByService[service] ?? [] : []
    const haystack = `${stripEnvSuffix(r.rule)} ${targetNames.join(' ')}`.toLowerCase()
    const known = taskNames.some(n => haystack.includes(n.toLowerCase()))
    scheduledRules.push({ rule: r.rule, schedule: r.schedule, state: r.state, service, known })
  }

  return {
    streamConsumptions,
    mapEdgesWithoutLiveBinding,
    orphanQueues,
    bucketCouplings,
    dmsTasks: snapshot.dmsTasks.map(t => ({ id: t.ReplicationTaskIdentifier, status: t.Status, type: t.MigrationType })),
    scheduledRules,
    unresolvedPrefixes: [...unresolved].sort(),
  }
}
