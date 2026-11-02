import { CLIENT_TYPES } from '@dependency-explorer/data'
import type { ConnectivityMap, ResourceSurface } from '@dependency-explorer/schema'
import type { DatadogSnapshot } from '../datadog/snapshot'
import { isProd, normaliseName, rawServiceOf, rawTagValues, type MetricKey } from '../datadog/scope'
import { buildServiceResolver, stripEnvSuffix } from './aws-live'

export interface DatadogJoin {
  serviceOfDatadog: Map<string, string>
  queueOfDatadog: Map<string, string>
  findings: DatadogFinding[]
}

type DatadogFinding =
  | { kind: 'unknown-service'; datadog: string; fix: string }
  | { kind: 'unmonitored-service'; service: string; fix: string }
  | { kind: 'unknown-dlq'; queuename: string; fallbackService: string | null; fix: string }
  | { kind: 'silent-dlq'; resource: string; fix: string }
  | { kind: 'team-mismatch'; service: string; datadogTeam: string; codeownersTeam: string | null; fix: string }

const API_GATEWAY_METRICS: MetricKey[] = ['api_count', 'api_5xx', 'api_4xx', 'api_p95']
const SERVICE_METRICS: MetricKey[] = ['lambda_errors', 'fn_invocations', 'fn_errors', 'apm_hits', 'apm_p95', 'apm_status']

const sortedUnique = (values: string[]): string[] => [...new Set(values)].sort()

export function joinDatadog(snapshot: DatadogSnapshot, dataset: { map: ConnectivityMap; resources: ResourceSurface }): DatadogJoin {
  const { map, resources } = dataset
  const findings: DatadogFinding[] = []
  const seriesTags = (keys: MetricKey[], tag: string) =>
    keys.flatMap(key => snapshot.metrics[key] ?? []).flatMap(s => rawTagValues(s.tag_set, tag))
  const prodMonitors = snapshot.monitors.filter(m => isProd(m.tags))
  const prodItems = [...prodMonitors, ...snapshot.slos.filter(s => isProd(s.tags))]

  const mapServiceByKey = new Map(map.services.map(s => [normaliseName(s.name), s.name]))
  const serviceOfDatadog = new Map<string, string>()
  const taggedNames = new Set(prodItems.flatMap(item => rawServiceOf(item) ?? []))
  const datadogNames = sortedUnique([
    ...taggedNames,
    ...seriesTags(API_GATEWAY_METRICS, 'name').map(stripEnvSuffix),
    ...seriesTags(SERVICE_METRICS, 'service'),
  ])
  for (const name of datadogNames) {
    const service = mapServiceByKey.get(normaliseName(name))
    if (service) {
      serviceOfDatadog.set(name, service)
    } else {
      const fix = taggedNames.has(name)
        ? `Tag its monitors and SLOs \`service:<map service name>\`, or add ${name} to the map`
        : `Rename the API Gateway or Lambda service ${name} after its map service, or add ${name} to the map`
      findings.push({ kind: 'unknown-service', datadog: name, fix })
    }
  }
  const mapServiceOf = (item: { tags: string[]; name: string }) => serviceOfDatadog.get(rawServiceOf(item) ?? '')

  const monitored = new Set(prodItems.map(mapServiceOf))
  for (const s of map.services) {
    if (!CLIENT_TYPES.has(s.type) && !monitored.has(s.name)) {
      findings.push({ kind: 'unmonitored-service', service: s.name, fix: `Add a prod monitor or SLO tagged \`service:${s.name}\`` })
    }
  }

  const deadLetterIds = new Set(resources.relations.filter(r => r.relation === 'dead-letters-to').flatMap(r => r.target ?? []))
  const registryDlqs = resources.resources.filter(r => deadLetterIds.has(r.id))
  const resolve = buildServiceResolver(map.services.map(s => s.name))
  const queueOfDatadog = new Map<string, string>()
  for (const queuename of sortedUnique(seriesTags(['dlq'], 'queuename'))) {
    const stripped = stripEnvSuffix(queuename)
    const deployed = normaliseName(stripped)
    const owner = resolve(stripped)
    const resource = registryDlqs.find(r =>
      normaliseName(r.name) === deployed || (r.owner === owner && normaliseName(`${r.owner}${r.name}`) === deployed))
    if (resource) {
      queueOfDatadog.set(queuename, resource.id)
    } else {
      findings.push({ kind: 'unknown-dlq', queuename, fallbackService: owner, fix: `Declare ${queuename} as the DLQ of its source queue in ${owner ?? 'its service'} so the registry derives it` })
    }
  }
  const reported = new Set(queueOfDatadog.values())
  if (snapshot.metrics.dlq) {
    for (const r of registryDlqs.filter(dlq => !reported.has(dlq.id))) {
      findings.push({ kind: 'silent-dlq', resource: r.id, fix: 'Tag the deployed queue `sqsdlq:true` so Datadog reports its depth' })
    }
  }

  const teamOfHandle = new Map((map.teams ?? []).flatMap(t => (t.datadogTeams ?? []).map(handle => [handle.toLowerCase(), t.id] as const)))
  const handlesOf = new Map<string, Set<string>>()
  for (const m of prodMonitors) {
    const service = mapServiceOf(m)
    if (!service) {
      continue
    }
    const handles = handlesOf.get(service) ?? new Set<string>()
    for (const handle of rawTagValues(m.tags, 'team')) {
      handles.add(handle)
    }
    handlesOf.set(service, handles)
  }
  for (const s of map.services) {
    for (const handle of sortedUnique([...(handlesOf.get(s.name) ?? [])])) {
      const teamId = teamOfHandle.get(handle.toLowerCase())
      const codeownersTeam = s.teamId ?? null
      if (teamId === undefined) {
        findings.push({ kind: 'team-mismatch', service: s.name, datadogTeam: handle, codeownersTeam, fix: `Add \`${handle}\` to the datadogTeams of its team in packages/data/src/teams.ts` })
      } else if (teamId !== s.teamId) {
        findings.push({ kind: 'team-mismatch', service: s.name, datadogTeam: handle, codeownersTeam, fix: `Tag the monitors of ${s.name} with the Datadog team of ${codeownersTeam ?? 'its owner'}, or fix its CODEOWNERS` })
      }
    }
  }

  return { serviceOfDatadog, queueOfDatadog, findings }
}

function findingLine(f: DatadogFinding): string {
  switch (f.kind) {
    case 'unknown-service':
      return `**${f.datadog}** names no map service`
    case 'unmonitored-service':
      return `**${f.service}** has no prod monitor and no SLO`
    case 'unknown-dlq':
      return `**${f.queuename}** matches no registry DLQ (nearest service: ${f.fallbackService ?? 'none'})`
    case 'silent-dlq':
      return `**${f.resource}** has no depth series in Datadog`
    case 'team-mismatch':
      return `**${f.service}** is team ${f.datadogTeam} in Datadog, ${f.codeownersTeam ?? 'unowned'} in CODEOWNERS`
  }
}

export function datadogSection(join: DatadogJoin | null): string | null {
  if (!join) {
    return null
  }
  const lines = join.findings.map(f => `- ${findingLine(f)} — ${f.fix}`)
  return ['\n## 🐶 Datadog drift (advisory, not in the baseline)\n', ...(lines.length ? lines : ['_none_'])].join('\n')
}
