import { describe, expect, it } from 'vitest'
import { reportJson } from './report-json'

describe('reportJson', () => {
  it('serialises maps and keeps the bug keys of a Jira join out', () => {
    const json = reportJson({
      other: new Map([['svc-a', 1]]),
      jira: { join: { areaOfBug: new Map([['BR-4242', 'planning']]), teamsOfBug: new Map([['BR-4242', ['team-a']]]), findings: ['f'] } },
    })
    expect(json).not.toContain('BR-4242')
    expect(JSON.parse(json)).toEqual({ other: { 'svc-a': 1 }, jira: { join: { findings: ['f'] } } })
  })
})
