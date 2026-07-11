import { describe, it, expect } from 'vitest'
import { sdkToServiceName, streamSourceService, RAILS_CLIENT_TARGETS, RAILS_CLIENT_DIR_TARGETS } from './mapping'

describe('streamSourceService', () => {
  const services = ['skello-app', 'svc-pos', 'svc-kpis', 'svc-kpis-v2', 'svc-documents-v2', 'svc-documents-esignature', 'svc-search', 'svc-users']

  it('maps the DMS CDC backbone (skelloapp-bus + fullload streams) to the monolith', () => {
    expect(streamSourceService('skelloapp-bus', 'svc-punch', services)).toBe('skello-app')
    expect(streamSourceService('skelloapp-bus-sdbx', 'svc-kpis-v2', services)).toBe('skello-app')
    expect(streamSourceService('svcRequests-fullload', 'svc-requests', services)).toBe('skello-app')
    expect(streamSourceService('SKELLO_APP_KINESIS_FULL_LOAD_AND_CDC_ARN', 'svc-kpis-v2', services)).toBe('skello-app')
  })

  it('classifies own-table and own-stream identities as self', () => {
    expect(streamSourceService('streamDynamodbSvcCommunicationsV2', 'svc-communications-v2', services)).toBe('self')
    expect(streamSourceService('dynamodbStreamUsers', 'svc-users', services)).toBe('self')
    expect(streamSourceService('streamDynamodb', 'svc-documents-v2', services)).toBe('self')
    expect(streamSourceService('${serviceName}-${stage}', 'svc-requests', services)).toBe('self')
  })

  it('resolves foreign-service parameter names, longest token wins', () => {
    expect(streamSourceService('posDynamoDBStream', 'svc-search', services)).toBe('svc-pos')
    expect(streamSourceService('streamSvcDocumentsEsignature', 'svc-documents-v2', services)).toBe('svc-documents-esignature')
  })

  it('returns null for unresolvable identities instead of guessing', () => {
    expect(streamSourceService('(non-literal arn)', 'svc-websockets-v2', services)).toBeNull()
  })
})

describe('sdkToServiceName', () => {
  it('normalizes conventional sdk and client packages', () => {
    expect(sdkToServiceName('@skelloapp/svc-events-sdk')).toBe('svc-events')
    expect(sdkToServiceName('@skelloapp/svc-employees-client')).toBe('svc-employees')
    expect(sdkToServiceName('@skelloapp/svc-documents-v2-client')).toBe('svc-documents-v2')
  })

  it('adds the svc- prefix when missing', () => {
    expect(sdkToServiceName('@skelloapp/websockets-v2-sdk')).toBe('svc-websockets-v2')
  })

  it('applies explicit overrides for non-conventional names', () => {
    expect(sdkToServiceName('@skelloapp/skello-app-sdk')).toBe('skello-app')
    expect(sdkToServiceName('@skelloapp/svc-esignature-sdk')).toBe('svc-documents-esignature')
    expect(sdkToServiceName('@skelloapp/workload-plan-sdk')).toBe('svc-workload-plan')
  })

  it('returns null for shared libraries and external platforms', () => {
    expect(sdkToServiceName('@skelloapp/aws-sdk-lib')).toBeNull()
    expect(sdkToServiceName('@skelloapp/skello-auth-client')).toBeNull()
    expect(sdkToServiceName('@skelloapp/data-platform-svc-ingestion-sdk')).toBeNull()
  })
})

describe('rails client mappings', () => {
  it('only map to svc-* or skello-app targets', () => {
    const targets = [
      ...Object.values(RAILS_CLIENT_TARGETS),
      ...Object.values(RAILS_CLIENT_DIR_TARGETS),
    ].filter((t): t is string => t !== null)
    for (const t of targets) {
      expect(t.startsWith('svc-') || t === 'skello-app', `unexpected target ${t}`).toBe(true)
    }
  })
})
