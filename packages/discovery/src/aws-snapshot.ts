import { z } from 'zod'
import { snapshotFolder } from './snapshot-dir'

export const awsSnapshotFolder = snapshotFolder({
  schema: z.object({
    'event-source-mappings': z.unknown(),
    'sqs-queues': z.unknown(),
    'sns-topics': z.unknown(),
    'dms-tasks': z.unknown(),
    'dynamo-tables': z.unknown(),
    'kinesis-streams': z.unknown(),
    's3-buckets': z.unknown(),
    'sns-sub-attributes': z.unknown(),
    'eventbridge-targets': z.unknown(),
    's3-notifications': z.unknown(),
  }),
  label: 'AWS',
  fetchScript: 'discover:aws:fetch --profile <profile>',
})

export type AwsRunner = (args: string[]) => unknown

type Json = Record<string, unknown>

const asRecord = (value: unknown): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('expected an object')
  }
  return Object.fromEntries(Object.entries(value))
}

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const lastSegment = (arn: unknown): string => String(arn).split(':').pop() ?? ''

export function fetchAwsSnapshot(run: AwsRunner, outDir: string, onStep: (label: string) => void = () => {}): { files: string[] } {
  const files: string[] = []
  const snapshot: Record<string, unknown> = {}
  const write = (file: string, data: unknown): void => {
    snapshot[file.replace(/\.json$/, '')] = data
    files.push(file)
  }
  const step = (label: string, fn: () => void): void => {
    fn()
    onStep(label)
  }
  const listing = (label: string, file: string, args: string[]): void => {
    step(label, () => write(file, run(args)))
  }

  listing('event source mappings', 'event-source-mappings.json', ['lambda', 'list-event-source-mappings'])
  listing('sqs queues', 'sqs-queues.json', ['sqs', 'list-queues', '--max-items', '2000'])
  listing('sns topics', 'sns-topics.json', ['sns', 'list-topics'])
  listing('dms tasks', 'dms-tasks.json', ['dms', 'describe-replication-tasks', '--without-settings'])
  listing('dynamo tables', 'dynamo-tables.json', ['dynamodb', 'list-tables', '--max-items', '500'])
  listing('kinesis streams', 'kinesis-streams.json', ['kinesis', 'list-streams'])
  listing('s3 buckets', 's3-buckets.json', ['s3api', 'list-buckets', '--query', 'Buckets[].Name'])

  step('sns subscription attributes', () => {
    const out: unknown[] = []
    for (const sub of asList(asRecord(run(['sns', 'list-subscriptions'])).Subscriptions).map(asRecord)) {
      if (!String(sub.SubscriptionArn).startsWith('arn:')) {
        continue
      }
      const base = { topic: lastSegment(sub.TopicArn), protocol: sub.Protocol, endpoint: sub.Endpoint }
      try {
        const attributes = asRecord(asRecord(run(['sns', 'get-subscription-attributes', '--subscription-arn', String(sub.SubscriptionArn)])).Attributes)
        out.push({ ...base, filterPolicy: attributes.FilterPolicy ? JSON.parse(String(attributes.FilterPolicy)) : null })
      } catch {
        out.push({ ...base, error: 'unreadable' })
      }
    }
    write('sns-sub-attributes.json', out)
  })

  step('eventbridge rule targets', () => {
    const out: unknown[] = []
    for (const rule of asList(asRecord(run(['events', 'list-rules', '--limit', '100'])).Rules).map(asRecord)) {
      const base = { rule: rule.Name, schedule: rule.ScheduleExpression ?? null, state: rule.State }
      try {
        const targets = asList(asRecord(run(['events', 'list-targets-by-rule', '--rule', String(rule.Name)])).Targets).map(asRecord)
        out.push({ ...base, targets: targets.map((target) => target.Arn) })
      } catch {
        out.push({ ...base, targets: [], error: 'unreadable' })
      }
    }
    write('eventbridge-targets.json', out)
  })

  step('s3 bucket notifications', () => {
    const buckets = asList(snapshot['s3-buckets'])
    const out: Json = {}
    for (const bucket of buckets) {
      try {
        const config = asRecord(run(['s3api', 'get-bucket-notification-configuration', '--bucket', String(bucket)]))
        if (Object.keys(config).length) {
          out[String(bucket)] = config
        }
      } catch {
        continue
      }
    }
    write('s3-notifications.json', out)
  })

  awsSnapshotFolder.write(outDir, snapshot)
  return { files }
}
