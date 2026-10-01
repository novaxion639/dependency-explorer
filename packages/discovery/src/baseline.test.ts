import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { stableDetail, findingKeys, diffBaseline, readBaseline, readBaselineRepos, writeBaseline } from './baseline'

describe('stableDetail', () => {
  it('drops hashes, numbers and line suffixes so keys survive re-runs', () => {
    const a = stableDetail('needs re-review — x.rb changed (re-stamp with sha256 3f2a9c0d1e2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e)')
    const b = stableDetail('needs re-review — x.rb changed (re-stamp with sha256 0000000000000000000000000000000000000000000000000000000000000000)')
    expect(a).toBe(b)
    expect(stableDetail('12 files at L35')).toBe(stableDetail('9 files at L102'))
  })
})

describe('findingKeys', () => {
  it('collects every findings section with a stable subject', () => {
    const keys = findingKeys({
      ruleCheck: { findings: [{ rule: 'r1', kind: 'rule-source-drift', detail: 'sha256 abcdefabcdef1234' }] },
      areaCheck: { findings: [{ subject: 'planning', kind: 'dead-glob', detail: 'x' }] },
      scannedRepos: ['a'],
    })
    expect(keys).toEqual(['areaCheck|dead-glob|planning|x', 'ruleCheck|rule-source-drift|r1|sha256 #'])
  })
})

it('keys connection-level drift by its edge', () => {
  const keys = findingKeys({
    stale: [{ from: 'svc-a', to: 'svc-b', sdkPackage: '@skelloapp/b' }],
    unknownTargets: [{ from: 'svc-a', evidence: 'line 12', normalizedTarget: 'svc-z' }],
    awsBindings: [{ from: 'svc-a', to: 'q' }],
  })
  expect(keys).toEqual(['stale||svc-a→svc-b|', 'unknownTargets||svc-a→svc-z|'])
})

it('takes the first non-empty subject field', () => {
  const keys = findingKeys({ codeGrades: { findings: [{ flow: '', subject: 'svc-punch', kind: 'stale-graph', detail: 'graph stale' }] } })
  expect(keys).toEqual(['codeGrades|stale-graph|svc-punch|graph stale'])
})

describe('diffBaseline', () => {
  it('splits new, resolved and carried', () => {
    expect(diffBaseline(['a', 'b'], ['b', 'c'])).toEqual({ added: ['a'], resolved: ['c'], carried: 1 })
  })
})

describe('baseline file', () => {
  it('records the scanned repo set beside the keys', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-')), 'baseline.json')
    writeBaseline(file, ['k1'], ['svc-b', 'common-dms-tf'])
    expect(readBaseline(file)).toEqual(['k1'])
    expect(readBaselineRepos(file)).toEqual(['common-dms-tf', 'svc-b'])
  })
})
