import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { ConnectivityMapSchema } from '@dependency-explorer/schema'
import { checkBranches } from './branch-check'

describe('checkBranches', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'branches-'))
  fs.mkdirSync(path.join(base, 'skello-app/app/services'), { recursive: true })
  fs.writeFileSync(path.join(base, 'skello-app/app/services/x.rb'), 'raise PeriodLockedError # not :conflict\n')
  const map = ConnectivityMapSchema.parse({
    services: [], connections: [],
    flows: [{
      id: 'f', name: 'F', description: 'd', steps: [],
      codeUnits: [
        { id: 'x', service: 'skello-app', kind: 'service', label: 'X', path: 'app/services/x.rb' },
        { id: 'y', service: 'svc-absent', kind: 'manager', label: 'Y', path: 'src/y.ts' },
      ],
      branches: [
        { id: 'locked', at: 'x', when: 'period locked', outcome: '422', evidence: { literal: 'PeriodLockedError' } },
        { id: 'conflict', at: 'x', when: 'lock held', outcome: '409', evidence: { literal: ':conflict' } },
        { id: 'absent', at: 'y', when: 'w', outcome: 'o', evidence: { literal: 'anything' } },
      ],
    }],
  })

  it('verifies literals in comment-stripped source, flags comment-only ones, skips absent repos', () => {
    const r = checkBranches(map, base)
    expect(r.verified).toBe(1)
    expect(r.findings.map(f => f.subject)).toEqual(['f#conflict'])
    expect(r.skippedRepos).toEqual(['svc-absent'])
  })
})
