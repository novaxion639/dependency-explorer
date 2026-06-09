import { describe, it, expect } from 'vitest'
import { parseServerlessState, parseServerlessStatic } from './serverless'
import { parseRoutesContent } from './rails-routes'
import { parseEnvServiceUrls } from './frontend'

describe('parseServerlessState', () => {
  it('reads resolved httpApi events and sqs event sources', () => {
    const state = {
      service: {
        functions: {
          GetThing: { events: [{ httpApi: { resolvedMethod: 'GET', resolvedPath: '/v1/things/{id}' } }] },
          Shorthand: { events: [{ httpApi: 'POST /v1/things' }] },
          Consumer: { events: [{ sqs: { arn: { 'Fn::GetAtt': ['ThingQueue', 'Arn'] } } }] },
          ArnString: { events: [{ sqs: { arn: 'arn:aws:sqs:eu-west-1:123:svcThingsUpdate' } }] },
        },
        resources: {
          Resources: {
            ThingQueue: { Type: 'AWS::SQS::Queue', Properties: { QueueName: 'svcThingsIngest' } },
          },
        },
      },
    }
    const facts = parseServerlessState(state)
    expect(facts.endpoints).toContainEqual({ method: 'GET', path: '/v1/things/{id}' })
    expect(facts.endpoints).toContainEqual({ method: 'POST', path: '/v1/things' })
    expect(facts.queueNames).toContain('svcThingsIngest')
    expect(facts.queueNames).toContain('svcThingsUpdate')
  })
})

describe('parseServerlessStatic', () => {
  it('mines block-form httpApi method/path pairs', () => {
    const src = `
    ApiCreate: {
      events: [
        {
          httpApi: {
            method: 'POST',
            path: '/v1/absence-configs/bulk_create',
            authorizer: 'Jwt',
          },
        },
      ],
    },`
    const facts = parseServerlessStatic(src)
    expect(facts.endpoints).toEqual([{ method: 'POST', path: '/v1/absence-configs/bulk_create' }])
  })

  it('mines shorthand events and queue names with templates stripped', () => {
    const src = `
      httpApi: 'GET /health',
      QueueName: \`svcEmployeesUpdate-\${stage}\`,
    `
    const facts = parseServerlessStatic(src)
    expect(facts.endpoints).toEqual([{ method: 'GET', path: '/health' }])
    expect(facts.queueNames).toEqual(['svcEmployeesUpdate'])
  })
})

describe('parseRoutesContent', () => {
  it('joins namespace and scope prefixes onto verb routes', () => {
    const src = `
Rails.application.routes.draw do
  get '/health', to: 'health#check'
  namespace :api do
    namespace :v3 do
      post 'shifts/:id/publish' => 'shifts#publish'
    end
  end
  namespace :unemployment_report do
    post 'shops/:shop_id' => 'reports#single_shop'
  end
  resources :users
end`
    const facts = parseRoutesContent(src)
    expect(facts.routes).toContainEqual({ verb: 'GET', path: '/health' })
    expect(facts.routes).toContainEqual({ verb: 'POST', path: '/api/v3/shifts/:id/publish' })
    expect(facts.routes).toContainEqual({ verb: 'POST', path: '/unemployment_report/shops/:shop_id' })
    expect(facts.resourceDeclarations).toBe(1)
    expect(facts.byTopSegment['api']).toBe(1)
  })
})

describe('parseEnvServiceUrls', () => {
  it('extracts var name and svc host, never the value', () => {
    const env = `
LLL_SERVICE_URL=https://svc-labour-laws.sandbox.skello.io
DOCUMENTS_SERVICE_URL="https://svc-documents.sandbox.skello.io/api"
DATABASE_URL=postgres://user:secret@host/db
NOT_A_URL=hello
`
    const out = parseEnvServiceUrls(env)
    expect(out).toContainEqual({ varName: 'LLL_SERVICE_URL', service: 'svc-labour-laws' })
    expect(out).toContainEqual({ varName: 'DOCUMENTS_SERVICE_URL', service: 'svc-documents' })
    expect(out).toHaveLength(2)
    expect(JSON.stringify(out)).not.toContain('secret')
  })
})
