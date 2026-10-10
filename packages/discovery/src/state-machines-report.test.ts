import { describe, it, expect } from 'vitest'
import { machineSection } from './state-machines-report'

describe('machineSection', () => {
  it('prints the ⚙ heading, the verified count, skipped repos and each finding', () => {
    expect(machineSection({ findings: [{ flow: 'f', kind: 'state-machine-drift', subject: 'f#sm', detail: 'X: in code, not authored' }], verified: 3, skippedRepos: ['svc-x'] })).toBe([
      '\n## ⚙ State machines (1 findings)\n',
      '3 state(s) verified against their definitions. Skipped (repo not checked out): svc-x.',
      '- [state-machine-drift] **f#sm**: X: in code, not authored',
    ].join('\n'))
  })
})
