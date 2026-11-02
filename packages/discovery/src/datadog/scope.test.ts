import { describe, expect, it } from 'vitest'
import { isProd, metricQueries, normaliseName, serviceOf } from './scope'

describe('scope', () => {
  it('reads production from env or environment, in any case', () => {
    expect([isProd(['env:prod']), isProd(['Environment:Prod']), isProd(['env:staging']), isProd([])]).toEqual([true, true, false, false])
  })

  it('names the service by its service tag, then its project tag, then its name', () => {
    expect(serviceOf({ tags: ['project:svc-b', 'service:svc-a'], name: '[svcC]' })).toBe('svc-a')
    expect(serviceOf({ tags: ['Project:svc-b'], name: '[svcC]' })).toBe('svc-b')
    expect(serviceOf({ tags: [], name: 'Errors [svcSearchMCP] high' })).toBe('svcSearch')
    expect(serviceOf({ tags: ['team:x'], name: 'no service' })).toBeNull()
  })

  it('folds case and punctuation', () => {
    expect([normaliseName('svc-Search'), normaliseName('svcsearch')]).toEqual(['svcsearch', 'svcsearch'])
  })

  it('scopes API Gateway to the prod stage names and Lambda and APM to the services', () => {
    const queries = metricQueries(['svc-a', 'svc-b'])
    expect(queries.api_5xx).toBe('sum:aws.apigateway.5xx{name IN (svc-a-prod,svc-b-prod)} by {name}.as_count().rollup(sum,3600)')
    expect(queries.fn_errors).toBe('sum:aws.lambda.errors{env:prod AND service IN (svc-a,svc-b)} by {service,functionname}.as_count().rollup(sum,86400)')
    expect(queries.dlq).toBe('max:aws.sqs.approximate_number_of_messages_visible{sqsdlq:true AND environment:prod} by {queuename}.rollup(max,3600)')
  })
})
