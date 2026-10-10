import { describe, it, expect } from 'vitest'
import { listenerSection } from './listeners-report'

describe('listenerSection', () => {
  it('prints the 👂 heading, the counts and each finding', () => {
    expect(listenerSection({ findings: [{ kind: 'unresolved-job', subject: 'GhostJob', detail: 'enqueued at app/x.rb:3' }], listeners: 90, writeSites: 400, feeds: 82, skipped: false })).toBe([
      '\n## 👂 Listener drift (1 findings)\n',
      '90 listener(s), 400 write site(s), 82 CDC feed(s) at the pinned commit.',
      '- [unresolved-job] **GhostJob**: enqueued at app/x.rb:3',
    ].join('\n'))
  })
  it('omits the CDC feeds clause when the count is unknown', () => {
    expect(listenerSection({ findings: [], listeners: 90, writeSites: 400, feeds: null, skipped: false })).toContain('90 listener(s), 400 write site(s) at the pinned commit.')
  })
  it('says when skello-app was not pinned', () => {
    expect(listenerSection({ findings: [], listeners: 0, writeSites: 0, feeds: 0, skipped: true })).toContain('Skipped: skello-app is not pinned.')
  })
})
