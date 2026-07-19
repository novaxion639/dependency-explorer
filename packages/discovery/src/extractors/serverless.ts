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

export interface StreamConsumerFact {
  /** normalized stream identity: kinesis stream name (template parts stripped) or the serverless/SSM parameter name */
  stream: string
  kind: 'kinesis' | 'dynamodb' | 'unknown'
  /** the arn/reference exactly as written in config */
  raw: string
  functionName?: string
}

export interface S3TriggerFact {
  /** bucket name with template parts stripped */
  bucket: string
  functionName?: string
}

export interface ScheduleFact {
  /** rate(...)/cron(...) literals; conditional configs carry every branch */
  expressions: string[]
  name?: string
  description?: string
  functionName?: string
}

export interface OwnedResourceFact {
  cfType: string
  name: string
}

// DLQ/retry wiring, in every literal shape the estate actually uses:
//  'redrive'   — raw CloudFormation RedrivePolicy{deadLetterTargetArn,maxReceiveCount}
//  'helper'    — createSqs({name, dlqToAppend, maxReceiveCount}) factory call sites
//                (dlqToAppend may be `someDlqVar.name` — resolved per file)
//  'onfailure' — stream-event destinations.onFailure (Fn::GetAtt or arn literal)
//                + sibling maximumRetryAttempts
//  'terraform' — <repo>-tf module blocks with dlq_name/redrive_policy (queues
//                managed outside serverless, e.g. svc-intelligence extract queue)
export interface DlqWiringFact {
  /** owning queue/consumer name when identifiable (template parts stripped) */
  queue: string | null
  /** DLQ name/logical id — null = wiring block found but target unresolvable */
  dlq: string | null
  /** "maxReceiveCount 3" | "maximumRetryAttempts 5" */
  retry: string | null
  via: 'redrive' | 'helper' | 'onfailure' | 'terraform'
}

export interface ServerlessFacts {
  /** deploy-state = resolved config from a real deploy; static-scan = literals mined from serverless TS sources */
  source: 'deploy-state' | 'static-scan'
  endpoints: DiscoveredEndpoint[]
  /** SQS queue names this service owns (resources) or consumes (event sources) */
  queueNames: string[]
  /** Kinesis / DynamoDB-stream event sources (inbound: this service listens) */
  streamConsumers: StreamConsumerFact[]
  /** S3 bucket-notification event sources (inbound: this service listens) */
  s3Triggers: S3TriggerFact[]
  /** EventBridge schedule events (recurring tasks) */
  schedules: ScheduleFact[]
  /** CloudFormation resources this service provisions (DynamoDB/S3/Kinesis/Events::Rule) */
  ownedResources: OwnedResourceFact[]
  /** DLQ/retry wiring facts (🧯 failure-layer verification) */
  dlqWirings: DlqWiringFact[]
}

// ── Stream / template identity helpers ────────────────────────────────────────

const OWNED_RESOURCE_TYPES = new Set([
  'AWS::DynamoDB::Table', 'AWS::S3::Bucket', 'AWS::Kinesis::Stream', 'AWS::Events::Rule',
])

/** Strip ${...} template parts and collapse leftover separators. */
export function stripTemplate(value: string): string {
  return value
    .replace(/\$\{[^}]*\}/g, '')
    .replace(/[-_.]{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
}

/**
 * Classify a stream event-source reference. Raw ARNs classify by service
 * segment (`:kinesis:` / `:dynamodb:`); `${self:custom.parameters.X}` and
 * `${ssm:/.../X}` references classify by the parameter NAME, which Skello
 * configs consistently spell with the engine in it (streamDynamodb…,
 * …KINESIS_FULL_LOAD_AND_CDC_ARN). explicitType (event's `type:`) wins.
 */
export function classifyStreamRef(raw: string, explicitType?: string): Omit<StreamConsumerFact, 'functionName'> {
  let kind: StreamConsumerFact['kind'] = 'unknown'
  let stream = raw

  if (raw.includes(':kinesis:')) {
    kind = 'kinesis'
    const name = raw.split('stream/').pop() ?? raw
    stream = stripTemplate(name) || name
  } else if (raw.includes(':dynamodb:')) {
    kind = 'dynamodb'
    const name = raw.split('table/').pop()?.split('/stream')[0] ?? raw
    stream = stripTemplate(name) || name
  } else {
    const ref = raw.match(/\$\{(?:self:|ssm:)?([^}]+)\}/)
    if (ref) {
      const segments = ref[1]!.split(/[./:]/).filter(Boolean)
      const param = segments[segments.length - 1] ?? raw
      stream = param
      if (/dynamo/i.test(param)) kind = 'dynamodb'
      else if (/kinesis/i.test(param)) kind = 'kinesis'
    }
  }

  if (explicitType === 'dynamodb') kind = 'dynamodb'
  else if (explicitType === 'kinesis') kind = 'kinesis'
  return { stream, kind, raw }
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
  const streamConsumers: StreamConsumerFact[] = []
  const s3Triggers: S3TriggerFact[] = []
  const schedules: ScheduleFact[] = []
  const ownedResources: OwnedResourceFact[] = []
  const dlqWirings: DlqWiringFact[] = []
  const resources: Record<string, any> = state?.service?.resources?.Resources ?? {}

  for (const [logical, res] of Object.entries<any>(resources)) {
    if (res?.Type === 'AWS::SQS::Queue') {
      const name = res.Properties?.QueueName
      queueNames.add(typeof name === 'string' ? name : logical)
      const redrive = res.Properties?.RedrivePolicy
      if (redrive) {
        const target = queueNameFromArn(redrive.deadLetterTargetArn, resources)
        dlqWirings.push({
          queue: typeof name === 'string' ? stripTemplate(name) || name : logical,
          dlq: target ? stripTemplate(target) || target : null,
          retry: redrive.maxReceiveCount != null ? `maxReceiveCount ${redrive.maxReceiveCount}` : null,
          via: 'redrive',
        })
      }
    }
    if (OWNED_RESOURCE_TYPES.has(res?.Type)) {
      const p = res.Properties ?? {}
      const name = p.TableName ?? p.BucketName ?? p.StreamName ?? p.Name
      ownedResources.push({ cfType: res.Type, name: typeof name === 'string' ? stripTemplate(name) || name : logical })
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
        continue
      }
      const streamArn = typeof event?.stream === 'string' ? event.stream : event?.stream?.arn
      if (event?.stream) {
        const raw = typeof streamArn === 'string'
          ? streamArn
          : typeof streamArn?.['Fn::ImportValue'] === 'string' ? streamArn['Fn::ImportValue'] : '(non-literal arn)'
        streamConsumers.push({ ...classifyStreamRef(raw, event.stream?.type), functionName: fnKey })
        const onFailure = event.stream?.destinations?.onFailure
        if (onFailure) {
          const target = queueNameFromArn(onFailure?.arn ?? onFailure, resources)
          const retries = event.stream?.maximumRetryAttempts
          dlqWirings.push({
            queue: fnKey,
            dlq: target ? stripTemplate(target) || target : null,
            retry: retries != null ? `maximumRetryAttempts ${retries}` : null,
            via: 'onfailure',
          })
        }
        continue
      }
      const bucket = typeof event?.s3 === 'string' ? event.s3 : event?.s3?.bucket
      if (typeof bucket === 'string') {
        s3Triggers.push({ bucket: stripTemplate(bucket) || bucket, functionName: fnKey })
        continue
      }
      if (event?.schedule) {
        const sched = event.schedule
        const rates = typeof sched === 'string' ? [sched] : [sched?.rate ?? []].flat()
        const expressions = rates.filter((r: unknown): r is string => typeof r === 'string')
        if (expressions.length) {
          schedules.push({
            expressions,
            name: typeof sched?.name === 'string' ? sched.name : undefined,
            description: typeof sched?.description === 'string' ? sched.description : undefined,
            functionName: fnKey,
          })
        }
      }
    }
  }

  return {
    endpoints,
    queueNames: [...queueNames].sort(),
    streamConsumers,
    s3Triggers,
    schedules,
    ownedResources,
    dlqWirings,
  }
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

/**
 * DLQ/retry wiring from serverless TS source — the three static shapes.
 * Exported for tests.
 */
export function parseDlqStatic(content: string): DlqWiringFact[] {
  const facts: DlqWiringFact[] = []
  const lines = content.split('\n')

  // Pass 1 — createSqs-style factory vars: const x = createSqs({ name: 'y', … })
  // so `dlqToAppend: x.name` / Fn::GetAtt [x.name] resolve to the literal.
  const varToName = new Map<string, string>()
  const varRe = /(?:const|export const)\s+([A-Za-z_$][\w$]*)\s*=\s*create\w*Sqs\w*\(\{/g
  for (let m = varRe.exec(content); m; m = varRe.exec(content)) {
    const block = content.slice(m.index, Math.min(content.length, m.index + 400))
    const name = block.match(/\bname:\s*['"`]([^'"`]+)['"`]/)
    if (name) varToName.set(m[1]!, stripTemplate(name[1]!) || name[1]!)
  }
  const resolveRef = (ref: string): string => {
    const viaVar = ref.match(/^([A-Za-z_$][\w$]*)\.name$/)
    if (viaVar) return varToName.get(viaVar[1]!) ?? viaVar[1]!
    return stripTemplate(ref.replace(/['"`]/g, '')) || ref
  }

  // Pass 2a — helper call sites carrying dlqToAppend
  const helperRe = /create\w*Sqs\w*\(\{([^)]*?)\}\)/gs
  for (let m = helperRe.exec(content); m; m = helperRe.exec(content)) {
    const body = m[1]!
    const dlqRef = body.match(/\bdlqToAppend:\s*([^,\n]+)/)
    if (!dlqRef) continue
    const name = body.match(/\bname:\s*['"`]([^'"`]+)['"`]/)
    const count = body.match(/\bmaxReceiveCount:\s*(\d+)/)
    facts.push({
      queue: name ? stripTemplate(name[1]!) || name[1]! : null,
      dlq: resolveRef(dlqRef[1]!.trim()),
      retry: count ? `maxReceiveCount ${count[1]}` : null,
      via: 'helper',
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // Pass 2b — raw RedrivePolicy blocks: owning QueueName above, target/count within
    if (/\bRedrivePolicy:\s*\{/.test(line)) {
      let queue: string | null = null
      for (let j = i - 1; j >= Math.max(0, i - 12); j--) {
        const q = lines[j]!.match(/\bQueueName:\s*['"`]([^'"`]+)['"`]/)
        if (q) { queue = stripTemplate(q[1]!) || q[1]!; break }
      }
      let dlq: string | null = null
      let retry: string | null = null
      for (let j = i; j < Math.min(lines.length, i + 8); j++) {
        const inner = lines[j]!
        const getAtt = inner.match(/Fn::GetAtt['"`]?\]?\s*:\s*\[\s*['"`]?([\w$.]+)['"`]?/)
          ?? inner.match(/\[['"`]Fn::GetAtt['"`],?\s*['"`]?([\w$.]+)/)
        if (getAtt && !dlq) dlq = resolveRef(getAtt[1]!)
        const arnLit = inner.match(/deadLetterTargetArn['"`]?:\s*['"`]([^'"`]+)['"`]/)
        if (arnLit && !dlq) {
          const last = arnLit[1]!.split(':').pop()!
          dlq = stripTemplate(last) || last
        }
        const count = inner.match(/maxReceiveCount['"`]?:\s*(\d+)/)
        if (count) retry = `maxReceiveCount ${count[1]}`
        if (/^\s*\},?\s*$/.test(inner) && j > i) break
      }
      facts.push({ queue, dlq, retry, via: 'redrive' })
      continue
    }

    // Pass 2c — stream destinations.onFailure + sibling maximumRetryAttempts
    if (/\bonFailure:\s*\{/.test(line)) {
      let dlq: string | null = null
      for (let j = i; j < Math.min(lines.length, i + 6); j++) {
        const inner = lines[j]!
        const getAtt = inner.match(/Fn::GetAtt['"`]?\]?\s*:\s*\[\s*([\w$.]+|['"`][^'"`]+['"`])/)
        if (getAtt) { dlq = resolveRef(getAtt[1]!.trim()); break }
        const arnLit = inner.match(/\barn:\s*['"`]([^'"`]+)['"`]/)
        if (arnLit) {
          const last = arnLit[1]!.split(':').pop()!
          dlq = stripTemplate(last) || last
          break
        }
      }
      let retry: string | null = null
      let queue: string | null = null
      for (let j = Math.max(0, i - 14); j < Math.min(lines.length, i + 14); j++) {
        const count = lines[j]!.match(/\bmaximumRetryAttempts:\s*(\d+)/)
        if (count) retry = `maximumRetryAttempts ${count[1]}`
      }
      const fn = findFunctionIdentity(lines, i).functionName
      if (fn) queue = fn
      facts.push({ queue, dlq, retry, via: 'onfailure' })
      continue
    }
  }

  return facts
}

/**
 * DLQ wiring from Terraform module blocks (<repo>-tf) — queues managed
 * outside serverless: `name = "…"` + `dlq_name = "…"` (+ maxReceiveCount).
 */
export function parseTerraformDlq(content: string): DlqWiringFact[] {
  const facts: DlqWiringFact[] = []
  const dlqRe = /\bdlq_name\s*=\s*"([^"]+)"/g
  for (let m = dlqRe.exec(content); m; m = dlqRe.exec(content)) {
    const before = content.slice(Math.max(0, m.index - 600), m.index)
    const after = content.slice(m.index, Math.min(content.length, m.index + 300))
    const name = [...before.matchAll(/\bname\s*=\s*"([^"]+)"/g)].pop()
    const count = after.match(/maxReceiveCount\s*=\s*(\d+)/)
    facts.push({
      queue: name ? stripTemplate(name[1]!) || name[1]! : null,
      dlq: stripTemplate(m[1]!) || m[1]!,
      retry: count ? `maxReceiveCount ${count[1]}` : null,
      via: 'terraform',
    })
  }
  return facts
}

/** Mine method/path literals from serverless TypeScript source. Exported for tests. */
export function parseServerlessStatic(content: string): Omit<ServerlessFacts, 'source'> {
  const endpoints: DiscoveredEndpoint[] = []
  const queueNames = new Set<string>()
  const streamConsumers: StreamConsumerFact[] = []
  const s3Triggers: S3TriggerFact[] = []
  const schedules: ScheduleFact[] = []
  const ownedResources: OwnedResourceFact[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // Stream event source — shorthand: stream: 'arn:aws:kinesis:…'
    const streamShort = line.match(/\bstream:\s*['"`]([^'"`]+)['"`]/)
    if (streamShort) {
      streamConsumers.push({ ...classifyStreamRef(streamShort[1]!), functionName: findFunctionIdentity(lines, i).functionName })
      continue
    }

    // Stream event source — block form: arn/type literals before nested objects
    if (/\bstream:\s*\{\s*$/.test(line)) {
      const indent = line.match(/^\s*/)![0].length
      let arn: string | null = null
      let explicitType: string | undefined
      for (let j = i + 1; j < Math.min(i + 14, lines.length); j++) {
        const inner = lines[j]!
        if (/^\s*destinations:/.test(inner)) break
        const innerIndent = inner.match(/^\s*/)![0].length
        if (/^\s*\}/.test(inner) && innerIndent <= indent) break
        const a = inner.match(/\barn:\s*['"`]([^'"`]+)['"`]/)
        if (a && !arn) arn = a[1]!
        const t = inner.match(/\btype:\s*['"`](\w+)['"`]/)
        if (t) explicitType = t[1]!
      }
      streamConsumers.push({
        ...classifyStreamRef(arn ?? '(non-literal arn)', explicitType),
        functionName: findFunctionIdentity(lines, i).functionName,
      })
      continue
    }

    // S3 bucket-notification event — shorthand or block with a bucket literal
    const s3Short = line.match(/^\s*s3:\s*['"`]([^'"`]+)['"`]/)
    if (s3Short) {
      s3Triggers.push({ bucket: stripTemplate(s3Short[1]!) || s3Short[1]!, functionName: findFunctionIdentity(lines, i).functionName })
      continue
    }
    if (/^\s*s3:\s*\{\s*$/.test(line)) {
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const b = lines[j]!.match(/\bbucket:\s*['"`]([^'"`]+)['"`]/)
        if (b) {
          s3Triggers.push({ bucket: stripTemplate(b[1]!) || b[1]!, functionName: findFunctionIdentity(lines, i).functionName })
          break
        }
        if (/^\s*\}/.test(lines[j]!)) break
      }
      continue
    }

    // Schedule event — shorthand: schedule: 'cron(…)' / schedule: ['rate(…)'] / template crons
    const schedShort = line.match(/\bschedule:\s*\[?\s*['"`]((?:rate|cron)\([^)]*\))['"`]/)
    if (schedShort) {
      schedules.push({ expressions: [schedShort[1]!], functionName: findFunctionIdentity(lines, i).functionName })
      continue
    }

    // Schedule event — block form: collect name/description + every rate/cron
    // literal in the block (conditional configs carry one literal per branch).
    // Blocks with zero literal expressions are ignored — that shape is almost
    // always a TS type declaration, not an event.
    if (/\bschedule:\s*\{\s*$/.test(line)) {
      const indent = line.match(/^\s*/)![0].length
      let name: string | undefined
      let description: string | undefined
      const expressions: string[] = []
      for (let j = i + 1; j < Math.min(i + 22, lines.length); j++) {
        const inner = lines[j]!
        const innerIndent = inner.match(/^\s*/)![0].length
        if (/^\s*\}/.test(inner) && innerIndent <= indent) break
        const n = inner.match(/\bname:\s*['"`]([^'"`]+)['"`]/)
        if (n && !name) name = stripTemplate(n[1]!) || n[1]!
        const d = inner.match(/\bdescription:\s*['"`]([^'"`]+)['"`]/)
        if (d && !description) description = d[1]!
        for (const expr of inner.match(/(?:rate|cron)\([^)]*\)/g) ?? []) expressions.push(expr)
      }
      if (expressions.length) {
        schedules.push({ expressions, name, description, functionName: findFunctionIdentity(lines, i).functionName })
      }
      continue
    }

    // Owned CloudFormation resources: Type: 'AWS::DynamoDB::Table' etc.
    const cfType = line.match(/\bType:\s*['"`](AWS::[A-Za-z0-9:]+)['"`]/)
    if (cfType && OWNED_RESOURCE_TYPES.has(cfType[1]!)) {
      let name: string | undefined
      for (let j = i + 1; j < Math.min(i + 14, lines.length); j++) {
        const n = lines[j]!.match(/\b(?:TableName|BucketName|StreamName|Name):\s*['"`]([^'"`]+)['"`]/)
        if (n) {
          name = stripTemplate(n[1]!) || n[1]!
          break
        }
      }
      ownedResources.push({ cfType: cfType[1]!, name: name ?? findFunctionIdentity(lines, i).functionName ?? '(unnamed)' })
      continue
    }

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

  return { endpoints, queueNames: [...queueNames].sort(), streamConsumers, s3Triggers, schedules, ownedResources, dlqWirings: parseDlqStatic(content) }
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

  // Queues managed outside serverless live in the sibling <repo>-tf estate —
  // appended whichever parse path wins below.
  const tfWirings: DlqWiringFact[] = []
  const tfDir = path.join(repoBase, `${repo}-tf`)
  if (fs.existsSync(tfDir)) {
    for (const entry of fs.readdirSync(tfDir)) {
      if (!entry.endsWith('.tf')) continue
      try {
        tfWirings.push(...parseTerraformDlq(fs.readFileSync(path.join(tfDir, entry), 'utf-8')))
      } catch {
        // unreadable file — skip
      }
    }
  }

  const statePath = path.join(repoPath, '.serverless', 'serverless-state.json')
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
      const parsed = parseServerlessState(state)
      if (parsed.endpoints.length || parsed.queueNames.length) {
        parsed.dlqWirings.push(...tfWirings)
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

  const merged: Omit<ServerlessFacts, 'source'> = {
    endpoints: [], queueNames: [], streamConsumers: [], s3Triggers: [], schedules: [], ownedResources: [], dlqWirings: [],
  }
  const queueNames = new Set<string>()
  for (const file of sources) {
    try {
      const parsed = parseServerlessStatic(fs.readFileSync(file, 'utf-8'))
      merged.endpoints.push(...parsed.endpoints)
      parsed.queueNames.forEach(q => queueNames.add(q))
      merged.streamConsumers.push(...parsed.streamConsumers)
      merged.s3Triggers.push(...parsed.s3Triggers)
      merged.schedules.push(...parsed.schedules)
      merged.ownedResources.push(...parsed.ownedResources)
      merged.dlqWirings.push(...parsed.dlqWirings)
    } catch {
      // unreadable file — skip
    }
  }
  merged.queueNames = [...queueNames].sort()
  merged.dlqWirings.push(...tfWirings)

  if (!merged.endpoints.length && !merged.queueNames.length
    && !merged.streamConsumers.length && !merged.s3Triggers.length
    && !merged.schedules.length && !merged.ownedResources.length
    && !merged.dlqWirings.length) return null
  return { source: 'static-scan', ...merged }
}
