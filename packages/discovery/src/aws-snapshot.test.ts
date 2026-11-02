import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fetchAwsSnapshot } from './aws-snapshot'

const EXPECTED_FILES = [
  'event-source-mappings.json',
  'sqs-queues.json',
  'sns-topics.json',
  'dms-tasks.json',
  'dynamo-tables.json',
  'kinesis-streams.json',
  's3-buckets.json',
  'sns-sub-attributes.json',
  'eventbridge-targets.json',
  's3-notifications.json',
]

const responses: Record<string, unknown> = {
  'list-subscriptions': {
    Subscriptions: [
      { SubscriptionArn: 'arn:aws:sns:eu-west-3:1:orders:abc', TopicArn: 'arn:aws:sns:eu-west-3:1:orders', Protocol: 'sqs', Endpoint: 'arn:aws:sqs:eu-west-3:1:q' },
      { SubscriptionArn: 'arn:aws:sns:eu-west-3:1:orders:def', TopicArn: 'arn:aws:sns:eu-west-3:1:orders', Protocol: 'sqs', Endpoint: 'arn:aws:sqs:eu-west-3:1:broken' },
      { SubscriptionArn: 'PendingConfirmation', TopicArn: 'arn:aws:sns:eu-west-3:1:orders', Protocol: 'email', Endpoint: 'a@b.c' },
    ],
  },
  'list-rules': { Rules: [{ Name: 'nightly', ScheduleExpression: 'cron(0 1 * * ? *)', State: 'ENABLED' }] },
  'list-targets-by-rule': { Targets: [{ Arn: 'arn:aws:lambda:eu-west-3:1:function:job' }] },
  'list-buckets': ['bucket-a', 'bucket-b'],
  'get-bucket-notification-configuration': {},
}

describe('fetchAwsSnapshot', () => {
  let outDir: string
  let calls: string[][]

  const run = (args: string[]): unknown => {
    calls.push(args)
    const [, subcommand = ''] = args
    if (subcommand === 'get-subscription-attributes' && args.includes('arn:aws:sns:eu-west-3:1:orders:def')) {
      throw new Error('denied')
    }
    if (subcommand === 'get-subscription-attributes') {
      return { Attributes: { FilterPolicy: '{"kind":["a"]}' } }
    }
    if (subcommand === 'get-bucket-notification-configuration' && args.includes('bucket-b')) {
      return { QueueConfigurations: [{ QueueArn: 'arn:aws:sqs:eu-west-3:1:q' }] }
    }
    return responses[subcommand] ?? {}
  }

  beforeEach(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aws-snapshot-'))
    calls = []
  })
  afterEach(() => {
    fs.rmSync(outDir, { recursive: true, force: true })
  })

  it('writes one file per call family under outDir', () => {
    const { files } = fetchAwsSnapshot(run, outDir)

    expect(files).toEqual(EXPECTED_FILES)
    expect(fs.readdirSync(outDir).sort()).toEqual([...EXPECTED_FILES].sort())
  })

  it('only issues list, describe and get subcommands', () => {
    fetchAwsSnapshot(run, outDir)

    expect(calls.length).toBeGreaterThan(10)
    for (const [, subcommand = ''] of calls) {
      expect(subcommand).toMatch(/^(list|describe|get)-/)
    }
  })

  it('shapes subscription attributes, marking unreadable ones and skipping unconfirmed ones', () => {
    fetchAwsSnapshot(run, outDir)

    expect(JSON.parse(fs.readFileSync(path.join(outDir, 'sns-sub-attributes.json'), 'utf8'))).toEqual([
      { topic: 'orders', protocol: 'sqs', endpoint: 'arn:aws:sqs:eu-west-3:1:q', filterPolicy: { kind: ['a'] } },
      { topic: 'orders', protocol: 'sqs', endpoint: 'arn:aws:sqs:eu-west-3:1:broken', error: 'unreadable' },
    ])
  })

  it('keeps rule targets and only the buckets that have a notification configuration', () => {
    fetchAwsSnapshot(run, outDir)

    expect(JSON.parse(fs.readFileSync(path.join(outDir, 'eventbridge-targets.json'), 'utf8'))).toEqual([
      { rule: 'nightly', schedule: 'cron(0 1 * * ? *)', state: 'ENABLED', targets: ['arn:aws:lambda:eu-west-3:1:function:job'] },
    ])
    expect(JSON.parse(fs.readFileSync(path.join(outDir, 's3-notifications.json'), 'utf8'))).toEqual({
      'bucket-b': { QueueConfigurations: [{ QueueArn: 'arn:aws:sqs:eu-west-3:1:q' }] },
    })
  })

  it('records an unreadable rule and a denied bucket without aborting', () => {
    const failing = (args: string[]): unknown => {
      const [, subcommand = ''] = args
      if (subcommand === 'list-targets-by-rule' || subcommand === 'get-bucket-notification-configuration') {
        throw new Error('denied')
      }
      return run(args)
    }

    fetchAwsSnapshot(failing, outDir)

    expect(JSON.parse(fs.readFileSync(path.join(outDir, 'eventbridge-targets.json'), 'utf8'))).toEqual([
      { rule: 'nightly', schedule: 'cron(0 1 * * ? *)', state: 'ENABLED', targets: [], error: 'unreadable' },
    ])
    expect(JSON.parse(fs.readFileSync(path.join(outDir, 's3-notifications.json'), 'utf8'))).toEqual({})
  })

  it('reports each step through onStep', () => {
    const steps: string[] = []

    fetchAwsSnapshot(run, outDir, (label) => steps.push(label))

    expect(steps).toEqual([
      'event source mappings', 'sqs queues', 'sns topics', 'dms tasks', 'dynamo tables', 'kinesis streams', 's3 buckets',
      'sns subscription attributes', 'eventbridge rule targets', 's3 bucket notifications',
    ])
  })
})
