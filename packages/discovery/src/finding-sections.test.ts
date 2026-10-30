import { describe, it, expect } from 'vitest'
import { listenerSection, machineSection } from './finding-sections'

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

describe('machineSection', () => {
  it('prints the ⚙ heading, the verified count, skipped repos and each finding', () => {
    expect(machineSection({ findings: [{ flow: 'f', kind: 'state-machine-drift', subject: 'f#sm', detail: 'X: in code, not authored' }], verified: 3, skippedRepos: ['svc-x'] })).toBe([
      '\n## ⚙ State machines (1 findings)\n',
      '3 state(s) verified against their definitions. Skipped (repo not checked out): svc-x.',
      '- [state-machine-drift] **f#sm**: X: in code, not authored',
    ].join('\n'))
  })
})
