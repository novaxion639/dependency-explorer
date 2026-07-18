import { describe, it, expect } from 'vitest'
import { analyzeAwsLive, buildServiceResolver, stripEnvSuffix, type AwsSnapshot } from './aws-live'

const SERVICES = ['skello-app', 'svc-alpha', 'svc-beta', 'svc-documents-esignature', 'svc-kpis', 'svc-kpis-v2']

const esm = (fn: string, src: string, state = 'Enabled') => ({
  FunctionArn: `arn:aws:lambda:eu-west-1:1:function:${fn}`,
  EventSourceArn: src,
  State: state,
})
const kinesisArn = (stream: string) => `arn:aws:kinesis:eu-west-1:1:stream/${stream}`
const dynamoArn = (table: string) => `arn:aws:dynamodb:eu-west-1:1:table/${table}/stream/2026-01-01`
const sqsArn = (queue: string) => `arn:aws:sqs:eu-west-1:1:${queue}`

const emptySnapshot: AwsSnapshot = {
  eventSourceMappings: [],
  sqsQueueUrls: [],
  snsSubscriptionAttributes: [],
  dmsTasks: [],
  eventBridgeTargets: [],
  dynamoTableNames: [],
  kinesisStreamNames: [],
  s3Notifications: {},
}

const inputs = (over: Partial<Parameters<typeof analyzeAwsLive>[1]> = {}) => ({
  serviceNames: SERVICES,
  connections: [
    { from: 'svc-alpha', to: 'skello-app', protocol: 'cdc' },
    { from: 'svc-beta', to: 'skello-app', protocol: 'rest' },
    { from: 'svc-kpis-v2', to: 'skello-app', protocol: 'cdc' },
  ],
  recurringTasksByService: {},
  ...over,
})

describe('stripEnvSuffix', () => {
  it('removes stage suffixes anywhere in the name', () => {
    expect(stripEnvSuffix('skelloapp-bus-sdbx')).toBe('skelloapp-bus')
    expect(stripEnvSuffix('svcAlpha-doThing-production')).toBe('svcAlpha-doThing')
    expect(stripEnvSuffix('svcAlpha-staging-fullload-staging')).toBe('svcAlpha-fullload')
  })
})

describe('buildServiceResolver', () => {
  const resolve = buildServiceResolver(SERVICES)
  it('resolves exact camel first tokens', () => {
    expect(resolve('svcAlpha-someJob')).toBe('svc-alpha')
    expect(resolve('skelloApp-kpis-test')).toBe('skello-app')
  })
  it('resolves multi-dash names by longest camel prefix', () => {
    expect(resolve('svcDocuments-eSignature-V2')).toBe('svc-documents-esignature')
  })
  it('prefers the longer service token (kpis-v2 over kpis)', () => {
    expect(resolve('svcKpisV2-someTable')).toBe('svc-kpis-v2')
  })
  it('returns null for unknown prefixes', () => {
    expect(resolve('pocMsk-consumer')).toBeNull()
  })
})

describe('analyzeAwsLive — stream consumption', () => {
  it('matches a live bus consumer against the map cdc edge (consumer → source)', () => {
    const findings = analyzeAwsLive({
      ...emptySnapshot,
      eventSourceMappings: [esm('svcAlpha-processBusJob-sdbx', kinesisArn('skelloapp-bus-sdbx'))],
    }, inputs())
    expect(findings.streamConsumptions).toEqual([
      expect.objectContaining({ consumer: 'svc-alpha', source: 'skello-app', verdict: 'match' }),
    ])
    expect(findings.mapEdgesWithoutLiveBinding).toEqual([
      { from: 'svc-kpis-v2', to: 'skello-app', protocol: 'cdc' },
    ])
  })

  it('flags a consumer whose pair exists only under another protocol', () => {
    const findings = analyzeAwsLive({
      ...emptySnapshot,
      eventSourceMappings: [esm('svcBeta-processBusJob', kinesisArn('skelloapp-bus-sdbx'))],
    }, inputs())
    expect(findings.streamConsumptions[0]).toMatchObject({ consumer: 'svc-beta', verdict: 'pair-other-protocol', mapProtocols: ['rest'] })
  })

  it('reports an unmapped cross-service dynamo-stream consumer as new', () => {
    const findings = analyzeAwsLive({
      ...emptySnapshot,
      eventSourceMappings: [esm('svcBeta-syncJob', dynamoArn('svcDocuments-eSignature-V2-sdbx'))],
    }, inputs({ connections: [] }))
    expect(findings.streamConsumptions[0]).toMatchObject({
      consumer: 'svc-beta',
      source: 'svc-documents-esignature',
      verdict: 'new',
    })
  })

  it('filters own-table streams and dedupes repeated bindings', () => {
    const findings = analyzeAwsLive({
      ...emptySnapshot,
      eventSourceMappings: [
        esm('svcAlpha-ownStreamJob', dynamoArn('svcAlpha-sdbx')),
        esm('svcAlpha-processBusJob', kinesisArn('skelloapp-bus-sdbx')),
        esm('svcAlpha-otherBusJob', kinesisArn('skelloapp-bus-sdbx')),
      ],
    }, inputs())
    expect(findings.streamConsumptions).toHaveLength(1)
  })

  it('collects unresolved function prefixes instead of guessing', () => {
    const findings = analyzeAwsLive({
      ...emptySnapshot,
      eventSourceMappings: [esm('pocMsk-consumer', kinesisArn('skelloapp-bus-sdbx'))],
    }, inputs())
    expect(findings.streamConsumptions).toHaveLength(0)
    expect(findings.unresolvedPrefixes).toEqual(['pocMsk'])
  })
})

describe('analyzeAwsLive — queues, buckets, schedules', () => {
  it('reports service-prefixed queues without a consumer binding, excluding DLQs', () => {
    const findings = analyzeAwsLive({
      ...emptySnapshot,
      eventSourceMappings: [esm('svcAlpha-consumeJob', sqsArn('svcAlpha-consumed-sdbx'))],
      sqsQueueUrls: [
        'https://sqs.eu-west-1.amazonaws.com/1/svcAlpha-consumed-sdbx',
        'https://sqs.eu-west-1.amazonaws.com/1/svcAlpha-orphan-sdbx',
        'https://sqs.eu-west-1.amazonaws.com/1/svcAlpha-orphanDlq-sdbx',
        'https://sqs.eu-west-1.amazonaws.com/1/unrelated-tool-queue',
      ],
    }, inputs())
    expect(findings.orphanQueues).toEqual(['svcAlpha-orphan'])
  })

  it('extracts bucket-notification couplings across target kinds', () => {
    const findings = analyzeAwsLive({
      ...emptySnapshot,
      s3Notifications: {
        'skello-app.assets.sdbx': {
          LambdaFunctionConfigurations: [{ LambdaFunctionArn: 'arn:aws:lambda:eu-west-1:1:function:svcBeta-listener' }],
          QueueConfigurations: [{ QueueArn: sqsArn('svcAlpha-ingest') }],
        },
        'silent-bucket': {},
      },
    }, inputs())
    expect(findings.bucketCouplings).toEqual([
      { bucket: 'skello-app.assets.sdbx', targets: ['sqs:svcAlpha-ingest', 'lambda:svcBeta-listener'] },
    ])
  })

  it('marks scheduled rules known when they match a map recurring task', () => {
    const findings = analyzeAwsLive({
      ...emptySnapshot,
      eventBridgeTargets: [
        { rule: 'svcAlpha-nightlyRefresh-sdbx', schedule: 'cron(0 3 * * ? *)', state: 'ENABLED', targets: ['arn:aws:lambda:eu-west-1:1:function:svcAlpha-nightlyRefresh-sdbx'] },
        { rule: 'svcAlpha-mysteryRule-sdbx', schedule: 'rate(5 minutes)', state: 'ENABLED', targets: [] },
        { rule: 'not-scheduled', schedule: null, state: 'ENABLED', targets: [] },
      ],
    }, inputs({ recurringTasksByService: { 'svc-alpha': ['nightlyRefresh'] } }))
    expect(findings.scheduledRules).toEqual([
      expect.objectContaining({ rule: 'svcAlpha-nightlyRefresh-sdbx', service: 'svc-alpha', known: true }),
      expect.objectContaining({ rule: 'svcAlpha-mysteryRule-sdbx', service: 'svc-alpha', known: false }),
    ])
  })
})
