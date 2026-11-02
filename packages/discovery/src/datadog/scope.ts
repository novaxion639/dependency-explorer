const SERVICE_IN_NAME = /\[(svc[A-Za-z0-9]+?)(?:MCP)?\]/

export const METRIC_KEYS = [
  'api_count',
  'api_5xx',
  'api_4xx',
  'api_p95',
  'lambda_errors',
  'fn_invocations',
  'fn_errors',
  'apm_hits',
  'apm_p95',
  'apm_status',
  'dlq',
] as const

export type MetricKey = (typeof METRIC_KEYS)[number]

type Scope = { names: string; services: string }

const PROD = '-prod'
const HOURLY = 'as_count().rollup(sum,3600)'
const DAILY = 'as_count().rollup(sum,86400)'

const lambdaScope = (s: Scope) => `env:prod AND service IN (${s.services})`
const apiScope = (s: Scope) => `name IN (${s.names})`

export function metricQueries(services: string[]): Record<MetricKey, string> {
  const s: Scope = { names: services.map((service) => `${service}${PROD}`).join(','), services: services.join(',') }
  return {
    api_count: `sum:aws.apigateway.count{${apiScope(s)}} by {name}.${HOURLY}`,
    api_5xx: `sum:aws.apigateway.5xx{${apiScope(s)}} by {name}.${HOURLY}`,
    api_4xx: `sum:aws.apigateway.4xx{${apiScope(s)}} by {name}.${HOURLY}`,
    api_p95: `avg:aws.apigateway.latency.p95{${apiScope(s)}} by {name}.rollup(max,3600)`,
    lambda_errors: `sum:aws.lambda.errors{${lambdaScope(s)}} by {service}.${HOURLY}`,
    fn_invocations: `sum:aws.lambda.invocations{${lambdaScope(s)}} by {service,functionname}.${DAILY}`,
    fn_errors: `sum:aws.lambda.errors{${lambdaScope(s)}} by {service,functionname}.${DAILY}`,
    apm_hits: `sum:trace.aws.httpapi.hits{${lambdaScope(s)}} by {service,resource_name}.${DAILY}`,
    apm_p95: `p95:trace.aws.httpapi{${lambdaScope(s)}} by {service,resource_name}.rollup(86400)`,
    apm_status: `sum:trace.aws.httpapi.hits.by_http_status{${lambdaScope(s)}} by {service,resource_name,http.status_class}.${DAILY}`,
    dlq: 'max:aws.sqs.approximate_number_of_messages_visible{sqsdlq:true AND environment:prod} by {queuename}.rollup(max,3600)',
  }
}

export const isProd = (tags: string[]): boolean =>
  tags.some((tag) => ['env:prod', 'environment:prod'].includes(tag.toLowerCase()))

const tagValue = (tags: string[], name: string): string | null => {
  const tag = tags.find((t) => t.toLowerCase().startsWith(`${name}:`))
  return tag === undefined ? null : tag.slice(name.length + 1)
}

export function serviceOf(monitor: { tags: string[]; name: string }): string | null {
  return tagValue(monitor.tags, 'service') ?? tagValue(monitor.tags, 'project') ?? SERVICE_IN_NAME.exec(monitor.name)?.[1] ?? null
}

export const normaliseName = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')
