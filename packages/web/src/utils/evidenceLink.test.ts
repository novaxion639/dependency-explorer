import { describe, it, expect } from 'vitest'
import { evidenceHref } from './evidenceLink'

const pins = { 'skello-app': 'abc123', 'svc-punch-tf': 'def456' }

describe('evidenceHref', () => {
  it('links a file to its blob at the pinned commit', () => {
    expect(evidenceHref('skello-app:db/schema.rb', pins)).toBe('https://github.com/skelloapp/skello-app/blob/abc123/db/schema.rb')
  })
  it('links a config declaration to the repo tree at the pinned commit', () => {
    expect(evidenceHref('svc-punch-tf:terraform', pins)).toBe('https://github.com/skelloapp/svc-punch-tf/tree/def456')
  })
  it('gives no link for dataset evidence or an unpinned repo', () => {
    expect(evidenceHref('dataset:svc-punch', pins)).toBeUndefined()
    expect(evidenceHref('svc-hris:serverless', pins)).toBeUndefined()
  })
})
