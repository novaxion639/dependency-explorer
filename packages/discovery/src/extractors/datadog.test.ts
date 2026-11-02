import { describe, expect, it } from 'vitest'
import { ConnectivityMapSchema, ResourceSurfaceSchema } from '@dependency-explorer/schema'
import type { DatadogSnapshot } from '../datadog/snapshot'
import type { Dataset } from '../discovery-run'
import { findingKeys } from '../baseline'
import { datadogSection, joinDatadog } from './datadog'

const service = (name: string, type: string, teamId?: string) => ({ name, type, description: name, endpoints: [], ...(teamId ? { teamId } : {}) })
const queue = (id: string, name: string, owner: string) => ({ id, kind: 'queue', store: 'sqs', name, owner, evidence: [] })
const deadLetters = (resource: string, target: string) => ({ resource, relation: 'dead-letters-to', service: 'svc-alpha', target, grade: 'config' })

const dataset: Dataset = {
  map: ConnectivityMapSchema.parse({
    services: [
      service('svc-search', 'typescript-microservice', 'squad-alpha'),
      service('svc-alpha', 'typescript-microservice', 'squad-beta'),
      service('web-app', 'vue-frontend'),
    ],
    connections: [],
    flows: [],
    teams: [
      { id: 'squad-alpha', name: 'Squad Alpha', datadogTeams: ['alpha'] },
      { id: 'squad-beta', name: 'Squad Beta' },
    ],
  }),
  resources: ResourceSurfaceSchema.parse({
    resources: [
      queue('sqs:alphaJobs', 'alphaJobs', 'svc-alpha'),
      queue('sqs:alphaJobsDlq', 'alphaJobsDlq', 'svc-alpha'),
      queue('sqs:searchIndexDlq', 'searchIndexDlq', 'svc-search'),
    ],
    relations: [deadLetters('sqs:alphaJobs', 'sqs:alphaJobsDlq'), deadLetters('sqs:searchIndex', 'sqs:searchIndexDlq')],
  }),
  committedListeners: null,
}

const series = (...tags: string[]) => ({ tag_set: tags, pointlist: [] })
const monitor = (name: string, ...tags: string[]) => ({ id: 1, name, tags, overall_state: 'OK' })

function snapshot(parts: Partial<DatadogSnapshot>): DatadogSnapshot {
  return {
    meta: { fetchedAt: '2026-11-01T00:00:00Z', site: 'datadoghq.eu', from: 0, to: 1 },
    monitors: [],
    teams: [],
    slos: [],
    incidents: [],
    metrics: {
      api_count: null, api_5xx: null, api_4xx: null, api_p95: null, lambda_errors: null,
      fn_invocations: null, fn_errors: null, apm_hits: null, apm_p95: null, apm_status: null, dlq: null,
    },
    events: { items: [], capped: false },
    ...parts,
  }
}

const withMetrics = (metrics: Partial<DatadogSnapshot['metrics']>): DatadogSnapshot => {
  const base = snapshot({})
  return { ...base, metrics: { ...base.metrics, ...metrics } }
}

const kinds = (s: DatadogSnapshot, kind: string) => joinDatadog(s, dataset).findings.filter(f => f.kind === kind)

describe('joinDatadog', () => {
  it('folds two spellings into one service', () => {
    const join = joinDatadog({
      ...withMetrics({ api_count: [series('name:svcsearch-prod')], lambda_errors: [series('service:svc-alpha')] }),
      monitors: [monitor('Search errors', 'service:svc-search', 'env:prod')],
    }, dataset)

    expect(join.serviceOfDatadog).toEqual(new Map([['svc-alpha', 'svc-alpha'], ['svc-search', 'svc-search'], ['svcsearch', 'svc-search']]))
    expect(join.findings.filter(f => f.kind === 'unknown-service')).toEqual([])
  })

  it('reads the service from the [svcX] name pattern', () => {
    const join = joinDatadog(snapshot({ monitors: [monitor('[svcSearch] latency', 'environment:prod')] }), dataset)

    expect(join.serviceOfDatadog.get('svcsearch')).toBe('svc-search')
  })

  it('ignores monitors without a prod tag', () => {
    const join = joinDatadog(snapshot({ monitors: [monitor('Ghost errors', 'service:svc-ghost', 'env:staging')] }), dataset)

    expect(join.serviceOfDatadog.size).toBe(0)
    expect(join.findings.filter(f => f.kind === 'unknown-service')).toEqual([])
  })

  it('reports a Datadog service matching no map service', () => {
    expect(kinds(snapshot({ slos: [{ id: 's1', name: 'Ghost SLO', tags: ['service:svc-ghost', 'env:prod'] }] }), 'unknown-service')).toEqual([
      { kind: 'unknown-service', datadog: 'svc-ghost', fix: 'Tag its monitors `service:<map service name>`, or add svc-ghost to the map' },
    ])
  })

  it('matches a deployed DLQ name to its registry resource', () => {
    const join = joinDatadog(withMetrics({ dlq: [series('queuename:svc-alpha-prod-alphaJobsDlq')] }), dataset)

    expect(join.queueOfDatadog).toEqual(new Map([['svc-alpha-prod-alphajobsdlq', 'sqs:alphaJobsDlq']]))
    expect(join.findings.filter(f => f.kind === 'unknown-dlq')).toEqual([])
  })

  it('reports an unknown DLQ with its longest-prefix service', () => {
    expect(kinds(withMetrics({ dlq: [series('queuename:svc-alpha-prod-ghostDlq')] }), 'unknown-dlq')).toEqual([
      { kind: 'unknown-dlq', queuename: 'svc-alpha-prod-ghostdlq', fallbackService: 'svc-alpha', fix: 'Declare svc-alpha-prod-ghostdlq as the DLQ of its source queue in svc-alpha so the registry derives it' },
    ])
  })

  it('reports registry DLQs Datadog never reports', () => {
    expect(kinds(withMetrics({ dlq: [series('queuename:svc-alpha-prod-alphaJobsDlq')] }), 'silent-dlq')).toEqual([
      { kind: 'silent-dlq', resource: 'sqs:searchIndexDlq', fix: 'Tag the deployed queue `sqsdlq:true` so Datadog reports its depth' },
    ])
  })

  it('reports no silent DLQ when the depth query returned nothing', () => {
    expect(kinds(snapshot({}), 'silent-dlq')).toEqual([])
  })

  it('reports a team mismatch', () => {
    const mismatches = kinds(snapshot({
      monitors: [
        monitor('Alpha errors', 'service:svc-alpha', 'env:prod', 'team:alpha'),
        monitor('Alpha latency', 'service:svc-alpha', 'env:prod', 'team:ghost'),
        monitor('Search errors', 'service:svc-search', 'env:prod', 'team:alpha'),
      ],
    }), 'team-mismatch')

    expect(mismatches).toEqual([
      { kind: 'team-mismatch', service: 'svc-alpha', datadogTeam: 'alpha', codeownersTeam: 'squad-beta', fix: 'Tag the monitors of svc-alpha with the Datadog team of squad-beta, or fix its CODEOWNERS' },
      { kind: 'team-mismatch', service: 'svc-alpha', datadogTeam: 'ghost', codeownersTeam: 'squad-beta', fix: 'Add `ghost` to the datadogTeams of its team in packages/data/src/teams.ts' },
    ])
  })

  it('excludes client apps from unmonitored-service', () => {
    const unmonitored = kinds(snapshot({ monitors: [monitor('Search errors', 'service:svc-search', 'env:prod')] }), 'unmonitored-service')

    expect(unmonitored).toEqual([
      { kind: 'unmonitored-service', service: 'svc-alpha', fix: 'Add a prod monitor or SLO tagged `service:svc-alpha`' },
    ])
  })

  it('keeps 🐶 findings out of the baseline keys', () => {
    const join = joinDatadog(snapshot({}), dataset)

    expect(join.findings.length).toBeGreaterThan(0)
    expect(findingKeys({ scannedRepos: [], datadog: join })).toEqual(findingKeys({ scannedRepos: [], datadog: null }))
  })
})

describe('datadogSection', () => {
  it('discover without --datadog prints no 🐶 section', () => {
    expect(datadogSection(null)).toBeNull()
  })

  it('prints one line per finding with its fix', () => {
    const join = joinDatadog({
      ...withMetrics({ dlq: [series('queuename:svc-alpha-prod-ghostDlq'), series('queuename:orphanDlq')] }),
      monitors: [monitor('Ghost', 'service:svc-ghost', 'env:prod', 'team:ghost'), monitor('Alpha', 'service:svc-alpha', 'env:prod', 'team:ghost')],
    }, dataset)

    expect(datadogSection(join)).toBe([
      '\n## 🐶 Datadog drift (advisory, not in the baseline)\n',
      '- **svc-ghost** names no map service — Tag its monitors `service:<map service name>`, or add svc-ghost to the map',
      '- **svc-search** has no prod monitor and no SLO — Add a prod monitor or SLO tagged `service:svc-search`',
      '- **orphandlq** matches no registry DLQ (nearest service: none) — Declare orphandlq as the DLQ of its source queue in its service so the registry derives it',
      '- **svc-alpha-prod-ghostdlq** matches no registry DLQ (nearest service: svc-alpha) — Declare svc-alpha-prod-ghostdlq as the DLQ of its source queue in svc-alpha so the registry derives it',
      '- **sqs:alphaJobsDlq** has no depth series in Datadog — Tag the deployed queue `sqsdlq:true` so Datadog reports its depth',
      '- **sqs:searchIndexDlq** has no depth series in Datadog — Tag the deployed queue `sqsdlq:true` so Datadog reports its depth',
      '- **svc-alpha** is team ghost in Datadog, squad-beta in CODEOWNERS — Add `ghost` to the datadogTeams of its team in packages/data/src/teams.ts',
    ].join('\n'))
  })

  it('says when there is no drift', () => {
    expect(datadogSection({ serviceOfDatadog: new Map(), queueOfDatadog: new Map(), findings: [] })).toContain('_none_')
  })
})
