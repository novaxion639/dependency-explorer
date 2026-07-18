/**
 * Fetches an AWS live-verification snapshot into a directory the aws-live
 * extractor can analyze (read-only List/Describe/Get calls, ~215 requests).
 *
 * Usage (an MFA'd session must already be cached — run
 * `aws sts get-caller-identity --profile <profile>` in a terminal first):
 *
 *   pnpm discover:aws:fetch --profile skl-sandbox [--out .aws-snapshots/<date>]
 *
 * Snapshots contain account IDs and resource ARNs — the output directory is
 * gitignored and must stay out of the repository.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const argv = process.argv
const arg = (flag: string): string | null => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : null
}

const profile = arg('--profile')
if (!profile) {
  console.error('usage: pnpm discover:aws:fetch --profile <aws-profile> [--out <dir>]')
  process.exit(1)
}

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = arg('--out') ?? path.join(pkgRoot, '.aws-snapshots', new Date().toISOString().slice(0, 10))
fs.mkdirSync(outDir, { recursive: true })

const aws = (args: string[]): any =>
  JSON.parse(execFileSync('aws', [...args, '--profile', profile], { maxBuffer: 64 * 1024 * 1024 }).toString() || '{}')
const write = (file: string, data: unknown) =>
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(data, null, 1))

console.error(`fetching read-only snapshot with profile ${profile} → ${outDir}`)
let calls = 0
const step = (label: string, fn: () => void) => {
  fn()
  console.error(`  ✓ ${label}`)
}

step('event source mappings', () => { write('event-source-mappings.json', aws(['lambda', 'list-event-source-mappings'])); calls++ })
step('sqs queues', () => { write('sqs-queues.json', aws(['sqs', 'list-queues', '--max-items', '2000'])); calls++ })
step('sns topics', () => { write('sns-topics.json', aws(['sns', 'list-topics'])); calls++ })
step('dms tasks', () => { write('dms-tasks.json', aws(['dms', 'describe-replication-tasks', '--without-settings'])); calls++ })
step('dynamo tables', () => { write('dynamo-tables.json', aws(['dynamodb', 'list-tables', '--max-items', '500'])); calls++ })
step('kinesis streams', () => { write('kinesis-streams.json', aws(['kinesis', 'list-streams'])); calls++ })
step('s3 buckets', () => { write('s3-buckets.json', aws(['s3api', 'list-buckets', '--query', 'Buckets[].Name'])); calls++ })

step('sns subscription attributes', () => {
  const subs = aws(['sns', 'list-subscriptions']).Subscriptions ?? []
  calls++
  const out: unknown[] = []
  for (const s of subs) {
    if (!String(s.SubscriptionArn).startsWith('arn:')) continue
    try {
      const a = aws(['sns', 'get-subscription-attributes', '--subscription-arn', s.SubscriptionArn]).Attributes
      out.push({ topic: s.TopicArn.split(':').pop(), protocol: s.Protocol, endpoint: s.Endpoint, filterPolicy: a.FilterPolicy ? JSON.parse(a.FilterPolicy) : null })
    } catch { out.push({ topic: s.TopicArn.split(':').pop(), protocol: s.Protocol, endpoint: s.Endpoint, error: 'unreadable' }) }
    calls++
  }
  write('sns-sub-attributes.json', out)
})

step('eventbridge rule targets', () => {
  const rules = aws(['events', 'list-rules', '--limit', '100']).Rules ?? []
  calls++
  const out: unknown[] = []
  for (const r of rules) {
    try {
      const targets = aws(['events', 'list-targets-by-rule', '--rule', r.Name]).Targets ?? []
      out.push({ rule: r.Name, schedule: r.ScheduleExpression ?? null, state: r.State, targets: targets.map((t: any) => t.Arn) })
    } catch { out.push({ rule: r.Name, schedule: r.ScheduleExpression ?? null, state: r.State, targets: [], error: 'unreadable' }) }
    calls++
  }
  write('eventbridge-targets.json', out)
})

step('s3 bucket notifications', () => {
  const buckets: string[] = JSON.parse(fs.readFileSync(path.join(outDir, 's3-buckets.json'), 'utf8'))
  const out: Record<string, unknown> = {}
  for (const b of buckets) {
    try {
      const cfg = aws(['s3api', 'get-bucket-notification-configuration', '--bucket', b])
      if (Object.keys(cfg).length) out[b] = cfg
    } catch { /* cross-region or denied — skip */ }
    calls++
  }
  write('s3-notifications.json', out)
})

console.error(`done — ${calls} read-only calls. Analyze with: pnpm discover -- --aws ${outDir}`)
