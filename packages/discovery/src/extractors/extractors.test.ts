import { describe, it, expect } from 'vitest'
import { parseServerlessState, parseServerlessStatic, classifyStreamRef, stripTemplate } from './serverless'
import { classifyAwsUsage } from './aws-clients'
import { parseTerraform } from './terraform'
import { parseRoutesContent } from './rails-routes'
import { parseEnvServiceUrls } from './frontend'
import { classifyImports } from './typescript'
import { parseSdkSource } from './sdk-registry'

describe('parseSdkSource', () => {
  it('maps methods to inline-path HTTP calls (comms style)', () => {
    const src = `
class EmailRepository {
  createHighPriority(dtos) {
    return this.client.clientWithoutRetry.post('/email/high-priority', dtos);
  }
  getEmailDisplay(emailId) {
    return this.client.clientWithRetry.get(\`/email-display/\${emailId}\`);
  }
}`
    expect(parseSdkSource(src)).toEqual([
      { name: 'createHighPriority', httpMethod: 'POST', path: '/email/high-priority' },
      { name: 'getEmailDisplay', httpMethod: 'GET', path: '/email-display/{param}' },
    ])
  })

  it('maps methods using a url variable and generic type args (events style)', () => {
    const src = `
export class ActivityLogRepository extends BaseRepository {
  public async findAll(organisationId: string, params: P): Promise<R> {
    const url = \`\${organisationId}/activity-logs\`;
    const response = (
      await this.svcEventClient.client.post<CollectionWrapper<ActivityLogType>>(url, bodyParams, {})
    ).data;
    return response;
  }
}`
    expect(parseSdkSource(src)).toEqual([
      { name: 'findAll', httpMethod: 'POST', path: '{param}/activity-logs' },
    ])
  })
})

describe('classifyImports', () => {
  it('detects value imports', () => {
    expect(classifyImports(`import { SearchClient } from '@skelloapp/svc-search-sdk'`, '@skelloapp/svc-search-sdk')).toBe('value')
    expect(classifyImports(`const sdk = require('@skelloapp/svc-search-sdk')`, '@skelloapp/svc-search-sdk')).toBe('value')
    expect(classifyImports(`import x from '@skelloapp/svc-search-sdk/dist/client'`, '@skelloapp/svc-search-sdk')).toBe('value')
  })

  it('detects type-only imports', () => {
    expect(classifyImports(`import type { Shift } from '@skelloapp/svc-search-sdk'`, '@skelloapp/svc-search-sdk')).toBe('type-only')
  })

  it('value import wins over type-only in the same file', () => {
    const src = `import type { A } from '@skelloapp/x-sdk'\nimport { client } from '@skelloapp/x-sdk'`
    expect(classifyImports(src, '@skelloapp/x-sdk')).toBe('value')
  })

  it('returns none when the package is never imported', () => {
    expect(classifyImports(`import { z } from 'zod'`, '@skelloapp/x-sdk')).toBe('none')
  })
})

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
    expect(facts.endpoints).toContainEqual(
      expect.objectContaining({ method: 'GET', path: '/v1/things/{id}', functionName: 'GetThing' }),
    )
    expect(facts.endpoints).toContainEqual(
      expect.objectContaining({ method: 'POST', path: '/v1/things', functionName: 'Shorthand' }),
    )
    expect(facts.queueNames).toContain('svcThingsIngest')
    expect(facts.queueNames).toContain('svcThingsUpdate')
  })

  it('reads stream, s3, schedule events and owned resources', () => {
    const state = {
      service: {
        functions: {
          BusConsumer: { events: [{ stream: { arn: 'arn:aws:kinesis:eu-west-1:123:stream/skelloapp-bus-sdbx', batchSize: 25 } }] },
          TableConsumer: { events: [{ stream: { arn: 'arn:aws:dynamodb:eu-west-1:123:table/svcThing-sdbx/stream/2024', type: 'dynamodb' } }] },
          Dropzone: { events: [{ s3: { bucket: 'svc-thing-data-sdbx', event: 's3:ObjectCreated:*' } }] },
          Nightly: { events: [{ schedule: { name: 'thing-nightly', description: 'Nightly job', rate: ['cron(0 2 * * ? *)'] } }] },
          Shorthand: { events: [{ schedule: 'rate(5 minutes)' }] },
        },
        resources: {
          Resources: {
            ThingTable: { Type: 'AWS::DynamoDB::Table', Properties: { TableName: 'svcThing-sdbx' } },
            ThingBucket: { Type: 'AWS::S3::Bucket' },
          },
        },
      },
    }
    const facts = parseServerlessState(state)
    expect(facts.streamConsumers).toContainEqual(
      expect.objectContaining({ stream: 'skelloapp-bus-sdbx', kind: 'kinesis', functionName: 'BusConsumer' }),
    )
    expect(facts.streamConsumers).toContainEqual(
      expect.objectContaining({ stream: 'svcThing-sdbx', kind: 'dynamodb', functionName: 'TableConsumer' }),
    )
    expect(facts.s3Triggers).toEqual([{ bucket: 'svc-thing-data-sdbx', functionName: 'Dropzone' }])
    expect(facts.schedules).toContainEqual(
      expect.objectContaining({ name: 'thing-nightly', expressions: ['cron(0 2 * * ? *)'], description: 'Nightly job' }),
    )
    expect(facts.schedules).toContainEqual(
      expect.objectContaining({ expressions: ['rate(5 minutes)'], functionName: 'Shorthand' }),
    )
    expect(facts.ownedResources).toContainEqual({ cfType: 'AWS::DynamoDB::Table', name: 'svcThing-sdbx' })
    expect(facts.ownedResources).toContainEqual({ cfType: 'AWS::S3::Bucket', name: 'ThingBucket' })
  })
})

describe('classifyStreamRef', () => {
  it('classifies raw ARNs by service segment and strips templates from names', () => {
    expect(classifyStreamRef('arn:aws:kinesis:${awsRegion}:${config.awsAccountId}:stream/skelloapp-bus-${awsEnv}'))
      .toEqual({ stream: 'skelloapp-bus', kind: 'kinesis', raw: expect.any(String) })
    expect(classifyStreamRef('arn:aws:dynamodb:eu-west-1:123:table/svcThing-prod/stream/2024').kind).toBe('dynamodb')
  })

  it('classifies parameter references by the parameter NAME', () => {
    expect(classifyStreamRef('${self:custom.parameters.streamDynamodbSvcCommunicationsV2}'))
      .toEqual(expect.objectContaining({ stream: 'streamDynamodbSvcCommunicationsV2', kind: 'dynamodb' }))
    expect(classifyStreamRef('${ssm:/prod/svc-kpis-v2/SKELLO_APP_KINESIS_FULL_LOAD_AND_CDC_ARN}'))
      .toEqual(expect.objectContaining({ stream: 'SKELLO_APP_KINESIS_FULL_LOAD_AND_CDC_ARN', kind: 'kinesis' }))
    expect(classifyStreamRef('${self:custom.parameters.streamSvcDocumentsEsignature}').kind).toBe('unknown')
  })

  it('lets an explicit event type win over name heuristics', () => {
    expect(classifyStreamRef('${self:custom.parameters.someStream}', 'dynamodb').kind).toBe('dynamodb')
  })
})

describe('stripTemplate', () => {
  it('removes template parts and collapses separators', () => {
    expect(stripTemplate('skelloapp-bus-${awsEnv}')).toBe('skelloapp-bus')
    expect(stripTemplate('skello-app.temporary-assets.${awsRegion}.${id}.${awsEnv}')).toBe('skello-app.temporary-assets')
    expect(stripTemplate('${serviceName}-${stage}')).toBe('')
  })
})

describe('parseServerlessStatic', () => {
  it('mines block-form httpApi method/path pairs with function identity', () => {
    const src = `
    ApiCreate: {
      description: 'Bulk create AbsenceConfig',
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
    expect(facts.endpoints).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: '/v1/absence-configs/bulk_create',
        functionName: 'ApiCreate',
        description: 'Bulk create AbsenceConfig',
      }),
    ])
  })

  it('mines API Gateway V2 route resources (e.g. SQS-SendMessage integrations)', () => {
    const src = `
  BulkCreateHighPriorityEmailRoute: {
    Type: 'AWS::ApiGatewayV2::Route',
    Properties: {
      ApiId: {Ref: 'HttpApi'},
      RouteKey: 'POST /email/high-priority',
      AuthorizationType: 'CUSTOM',
    },
  },`
    const facts = parseServerlessStatic(src)
    expect(facts.endpoints).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: '/email/high-priority',
        functionName: 'BulkCreateHighPriorityEmailRoute',
      }),
    ])
  })

  it('mines shorthand events and queue names with templates stripped', () => {
    const src = `
      httpApi: 'GET /health',
      QueueName: \`svcEmployeesUpdate-\${stage}\`,
    `
    const facts = parseServerlessStatic(src)
    expect(facts.endpoints).toEqual([expect.objectContaining({ method: 'GET', path: '/health' })])
    expect(facts.queueNames).toEqual(['svcEmployeesUpdate'])
  })

  it('mines stream event sources without picking up nested destination arns', () => {
    const src = `
    TriggerJob: {
      events: [
        {
          stream: {
            arn: '\${self:custom.parameters.streamDynamodbSvcCommunicationsV2}',
            batchSize: 25,
            destinations: {
              onFailure: {
                arn: 'arn:aws:sqs:eu-west-1:123:wrong-pick',
              },
            },
          },
        },
      ],
    },
    BusConsumer: {
      events: [
        {
          stream: {
            arn: \`arn:aws:kinesis:\${awsRegion}:\${config.awsAccountId}:stream/skelloapp-bus-\${awsEnv}\`,
            startingPosition: 'LATEST',
          },
        },
      ],
    },`
    const facts = parseServerlessStatic(src)
    expect(facts.streamConsumers).toEqual([
      expect.objectContaining({ stream: 'streamDynamodbSvcCommunicationsV2', kind: 'dynamodb', functionName: 'TriggerJob' }),
      expect.objectContaining({ stream: 'skelloapp-bus', kind: 'kinesis', functionName: 'BusConsumer' }),
    ])
  })

  it('mines s3 triggers with the bucket template stripped', () => {
    const src = `
    HandleEvpReady: {
      events: [
        {
          s3: {
            bucket: \`svc-payroll-evp-data-\${stage}\`,
            event: 's3:ObjectCreated:*',
            rules: [{suffix: '.evp.json'}],
          },
        },
      ],
    },`
    expect(parseServerlessStatic(src).s3Triggers).toEqual([
      { bucket: 'svc-payroll-evp-data', functionName: 'HandleEvpReady' },
    ])
  })

  it('mines schedule shorthand and conditional block form; ignores type declarations', () => {
    const src = `
    SstRefresh: {
      events: [{schedule: 'cron(0 8 1 * ? *)'}],
    },
    GenerateSyncErrorReports: {
      events: [
        {
          schedule: {
            name: \`\${serviceName}-generate-sync-error-reports-\${stage}\`,
            description: 'Trigger Sync Errors generate at 12pm Paris time',
            enabled: true,
            rate: [
              awsEnv !== 'prod'
                ? 'cron(0 9-18 ? * 2-6 *)'
                : 'cron(0 12 * * ? *)',
            ],
          },
        },
      ],
    },
    type MapSchedule = {
      schedule: {
        name: string;
        description: string;
        rate: string;
      };
    };`
    const facts = parseServerlessStatic(src)
    expect(facts.schedules).toEqual([
      expect.objectContaining({ expressions: ['cron(0 8 1 * ? *)'], functionName: 'SstRefresh' }),
      expect.objectContaining({
        name: 'generate-sync-error-reports',
        expressions: ['cron(0 9-18 ? * 2-6 *)', 'cron(0 12 * * ? *)'],
        description: 'Trigger Sync Errors generate at 12pm Paris time',
      }),
    ])
  })

  it('mines owned CloudFormation resources of mapped types', () => {
    const src = `
    SvcPayrollEvpDataBucket: {
      Type: 'AWS::S3::Bucket',
      Properties: {
        BucketName: \`svc-payroll-evp-data-\${stage}\`,
      },
    },
    SomeQueue: {
      Type: 'AWS::SQS::Queue',
      Properties: {QueueName: 'ignoredHere'},
    },`
    expect(parseServerlessStatic(src).ownedResources).toEqual([
      { cfType: 'AWS::S3::Bucket', name: 'svc-payroll-evp-data' },
    ])
  })
})

describe('classifyAwsUsage', () => {
  it('detects firehose producers (raw sdk and skello wrapper)', () => {
    const src = `
import {Firehose, PutRecordBatchInput} from '@aws-sdk/client-firehose';
export class FirehoseClient {
  public async putRecordBatch(events: unknown[]): Promise<void> {
    await this.client.putRecordBatch(input);
  }
}`
    expect(classifyAwsUsage(src)).toEqual([{ kind: 'firehose', operations: ['produce'] }])
  })

  it('detects s3 read/write/presign directions', () => {
    const src = `
import {AwsS3Client} from '@skelloapp/aws-sdk-lib';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
const a = await client.getObject({bucket, key});
await client.putObject({bucket, key, body});
const url = await getSignedUrl(raw, command);`
    expect(classifyAwsUsage(src)).toEqual([
      { kind: 's3', operations: ['read', 'write', 'presign'] },
    ])
  })

  it('detects dynamodb CRUD via command imports', () => {
    const src = `
import {GetCommand, QueryCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb';`
    expect(classifyAwsUsage(src)).toEqual([
      { kind: 'dynamodb', operations: ['read', 'query', 'update'] },
    ])
  })

  it('detects typeorm postgres coupling via @Entity', () => {
    const src = `
import {Column, Entity, PrimaryColumn} from 'typeorm';
@Entity({name: 'shops'})
export class ShopEntity {}`
    expect(classifyAwsUsage(src)).toEqual([{ kind: 'postgresql', operations: ['entity'] }])
  })

  it('never attributes an operation without the kind import in the same file', () => {
    const src = `await this.someOtherClient.putRecords(events);`
    expect(classifyAwsUsage(src)).toEqual([])
  })
})

describe('parseTerraform', () => {
  it('mines owned data resources with their name attribute', () => {
    const src = `
resource "aws_dynamodb_table" "table" {
  name         = "\${local.project}-\${local.workspace}"
  billing_mode = "PAY_PER_REQUEST"
}

resource "aws_s3_bucket" "evp_data" {
  bucket = "svc-payroll-evp-data-\${local.workspace}"
}

resource "aws_ssm_parameter" "ignored" {
  name = "/foo/bar"
}`
    const facts = parseTerraform(src)
    expect(facts.resources).toEqual([
      { tfType: 'aws_dynamodb_table', label: 'table', name: '${local.project}-${local.workspace}' },
      { tfType: 'aws_s3_bucket', label: 'evp_data', name: 'svc-payroll-evp-data-${local.workspace}' },
    ])
  })

  it('mines DMS replication tasks and endpoints (the CDC backbone proof)', () => {
    const src = `
resource "aws_dms_replication_task" "dms_replication_task" {
  migration_type           = "full-load"
  replication_task_id      = lower("skelloapp-\${local.project}-fullload-\${local.workspace}")
  source_endpoint_arn      = data.aws_dms_endpoint.aurora.endpoint_arn
  target_endpoint_arn      = aws_dms_endpoint.kinesis[0].endpoint_arn
}

resource "aws_dms_endpoint" "kinesis" {
  endpoint_id   = "skelloapp-\${lower(local.project)}-fullload-\${local.workspace}"
  endpoint_type = "target"
  engine_name   = "kinesis"
}`
    const facts = parseTerraform(src)
    expect(facts.dmsTasks).toEqual([
      expect.objectContaining({
        migrationType: 'full-load',
        source: 'data.aws_dms_endpoint.aurora.endpoint_arn',
        target: 'aws_dms_endpoint.kinesis[0].endpoint_arn',
      }),
    ])
    expect(facts.dmsEndpoints).toEqual([
      expect.objectContaining({ endpointType: 'target', engineName: 'kinesis' }),
    ])
  })

  it('collects recognized data-plane IAM actions', () => {
    const src = `
data "aws_iam_policy_document" "firehose" {
  statement {
    actions = ["s3:GetObject", "s3:PutObject", "kinesis:PutRecord", "sts:AssumeRole"]
  }
}`
    expect(parseTerraform(src).iamActions).toEqual(['kinesis:PutRecord', 's3:GetObject', 's3:PutObject'])
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
