import type { DatadogSnapshot } from '../../snapshot'
import type { MetricKey } from '../../scope'
import type { EngineInput } from '../rules'
import { DAY, HOUR as H } from '../series'

export { DAY, H }

export const NOW = 1773304200
export const MIDNIGHT = NOW - (NOW % DAY)
export const FROM = NOW - 1800 - 21 * DAY

type Points = [number, number][]
type Series = NonNullable<DatadogSnapshot['metrics'][MetricKey]>[number]
export type KeyedMetrics = Partial<Record<MetricKey, Record<string, Points> | null>>

export function hourly(value: (t: number) => number | null): Points {
  const out: Points = []
  for (let t = FROM; t < NOW; t += H) {
    const v = value(t)
    if (v !== null) {
      out.push([t, v])
    }
  }
  return out
}

export function daily(value: (day: number) => number | null): Points {
  const out: Points = []
  for (let d = FROM - (FROM % DAY); d < NOW; d += DAY) {
    const v = value((d - MIDNIGHT) / DAY)
    if (v !== null) {
      out.push([d, v])
    }
  }
  return out
}

export const dayOf = (t: number) => Math.floor((t - MIDNIGHT) / DAY)

const route = (key: string) => {
  const [service, resource, status] = key.split('|')
  return [`service:${service}`, `resource_name:${resource}`, ...(status === undefined ? [] : [`http.status_class:${status}`])]
}

const fn = (key: string) => {
  const [service, name] = key.split('|')
  return [`service:${service}`, `functionname:${service}-${name}-prod`]
}

const TAGS: Record<MetricKey, (key: string) => string[]> = {
  api_count: (key) => [`name:${key}-prod`],
  api_5xx: (key) => [`name:${key}-prod`],
  api_4xx: (key) => [`name:${key}-prod`],
  api_p95: (key) => [`name:${key}-prod`],
  lambda_errors: (key) => [`service:${key}`],
  fn_invocations: fn,
  fn_errors: fn,
  apm_hits: route,
  apm_p95: route,
  apm_status: route,
  dlq: (key) => [`queuename:${key}`],
}

function seriesOf(key: MetricKey, over: KeyedMetrics): Series[] | null {
  const keyed = over[key]
  if (!keyed) {
    return null
  }
  return Object.entries(keyed).map(([k, points]) => ({ tag_set: TAGS[key](k), pointlist: points.map(([t, v]): [number, number] => [t * 1000, v]) }))
}

export function metrics(over: KeyedMetrics = {}): DatadogSnapshot['metrics'] {
  return {
    api_count: seriesOf('api_count', over),
    api_5xx: seriesOf('api_5xx', over),
    api_4xx: seriesOf('api_4xx', over),
    api_p95: seriesOf('api_p95', over),
    lambda_errors: seriesOf('lambda_errors', over),
    fn_invocations: seriesOf('fn_invocations', over),
    fn_errors: seriesOf('fn_errors', over),
    apm_hits: seriesOf('apm_hits', over),
    apm_p95: seriesOf('apm_p95', over),
    apm_status: seriesOf('apm_status', over),
    dlq: seriesOf('dlq', over),
  }
}

export function engineInput(over: Partial<EngineInput> = {}): EngineInput {
  return {
    now: NOW,
    from: FROM,
    metrics: metrics(),
    services: [{ name: 'svcplanning', repo: 'svc-planning' }],
    monitors: [],
    triggers: [],
    releases: [],
    ...over,
  }
}

export const monitor = (id: number, service: string, name: string, status = 'OK') => ({
  id,
  name: `[P2][${service}][prod] ${name}`,
  tags: ['env:prod', `service:${service}`],
  overall_state: status,
})

export const release = (repo: string, number: number, version: string, merged: number, changes: string[] = []) => ({
  repo,
  number,
  sha: `sha${number}`,
  title: `chore(main): release ${version}`,
  merged: new Date(merged * 1000).toISOString(),
  changes,
})
