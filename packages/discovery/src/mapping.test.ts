import { describe, it, expect } from 'vitest'
import { sdkToServiceName, RAILS_CLIENT_TARGETS, RAILS_CLIENT_DIR_TARGETS } from './mapping'

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
