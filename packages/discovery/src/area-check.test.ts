import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { ProductAreaSchema, ExternalSystemSchema } from '@dependency-explorer/schema'
import { checkAreas } from './area-check'

let base = ''

function write(rel: string, content = '') {
  const p = path.join(base, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, content)
}

const planning = ProductAreaSchema.parse({
  id: 'planning', name: 'Planning', description: 'd', kind: 'product', color: '#6366f1',
  codeLocations: [{ repo: 'skello-app', platform: 'monolith', globs: ['app/services/shifts/**', 'app/models/shift.rb', 'app/services/gone/**'] }],
  readingPath: [],
  glossary: [
    { term: 'Shift', definition: 'd', anchor: { repo: 'skello-app', path: 'app/models/shift.rb', symbol: 'Shift' } },
    { term: 'Poste', definition: 'd', anchor: { repo: 'skello-app', path: 'app/models/poste.rb', symbol: 'Poste' } },
    { term: 'Ghost', definition: 'd', anchor: { repo: 'skello-app', path: 'app/models/shift.rb', symbol: 'Ghost' } },
  ],
})
const timeAttendance = ProductAreaSchema.parse({
  id: 'time-attendance', name: 'T&A', description: 'd', kind: 'product', color: '#f59e0b',
  codeLocations: [{ repo: 'skello-app', platform: 'monolith', globs: ['app/models/shift.rb'] }],
  readingPath: [{ flowId: 'employee-clock-in', why: 'w' }], glossary: [],
})
const absentRepoArea = ProductAreaSchema.parse({
  id: 'hiring', name: 'Hiring', description: 'd', kind: 'product', color: '#06b6d4',
  codeLocations: [{ repo: 'svc-hiring', platform: 'backend', globs: ['**'] }],
  readingPath: [{ flowId: 'x', why: 'w' }], glossary: [],
})
const externals = [
  ExternalSystemSchema.parse({ id: 'stripe', name: 'Stripe', description: 'd', category: 'payment',
    usedBy: [{ service: 'skello-app', evidence: { kind: 'gem', literal: 'stripe' } }] }),
  ExternalSystemSchema.parse({ id: 'yousign', name: 'Yousign', description: 'd', category: 'e-signature',
    usedBy: [{ service: 'skello-app', evidence: { kind: 'env', literal: 'YOUSIGN_API_KEY' } }] }),
]

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'area-check-'))
  write('skello-app/Gemfile', "gem 'stripe'\n")
  write('skello-app/app/models/shift.rb', 'class Shift < ApplicationRecord\nend\n')
  write('skello-app/app/services/shifts/create_service.rb', 'class CreateService\nend\n')
  write('skello-app/app/services/shifts/create_service_spec.rb', '')
  write('skello-app/app/services/payroll/export.rb', '')
  write('skello-app/app/services/payroll/build.rb', '')
  write('skello-app/node_modules/x/app/services/ignored.rb', '')
})

afterAll(() => fs.rmSync(base, { recursive: true, force: true }))

function run() {
  return checkAreas({
    areas: [planning, timeAttendance, absentRepoArea],
    externals,
    repoBase: base,
    coverageRoots: { 'skello-app': ['app/services/**/*.rb', 'app/models/**/*.rb'] },
  })
}

describe('checkAreas', () => {
  it('counts files per glob and flags dead globs with the closest live directory', () => {
    const r = run()
    expect(r.areaFiles.planning?.['skello-app:app/services/shifts/**']).toBe(2)
    expect(r.areaFiles.planning?.['skello-app:app/models/shift.rb']).toBe(1)
    const dead = r.findings.filter(f => f.kind === 'dead-glob')
    expect(dead).toHaveLength(1)
    expect(dead[0]?.detail).toContain('app/services/gone/**')
    expect(dead[0]?.detail).toContain('closest live directory: app/services')
  })

  it('computes coverage excluding test files and node_modules, listing unmapped dirs', () => {
    const cov = run().coverage['skello-app']
    expect(cov?.total).toBe(4)
    expect(cov?.mapped).toBe(2)
    expect(cov?.unmappedByDir).toEqual([{ dir: 'app/services/payroll', files: 2 }])
  })

  it('lists files claimed by two product areas as overlaps', () => {
    expect(run().overlaps).toEqual([{ repo: 'skello-app', file: 'app/models/shift.rb', areas: ['planning', 'time-attendance'] }])
  })

  it('verifies glossary anchors by path and declared symbol', () => {
    const r = run()
    expect(r.anchorsVerified).toBe(1)
    expect(r.findings.filter(f => f.kind === 'missing-anchor').map(f => f.subject)).toEqual(['planning:Poste'])
    expect(r.findings.filter(f => f.kind === 'anchor-symbol-absent').map(f => f.subject)).toEqual(['planning:Ghost'])
  })

  it('verifies external evidence literals and flags missing ones', () => {
    const r = run()
    expect(r.evidenceVerified).toBe(1)
    expect(r.findings.filter(f => f.kind === 'missing-external-evidence').map(f => f.subject)).toEqual(['yousign'])
  })

  it('reports product areas without reading path as backlog', () => {
    expect(run().findings.filter(f => f.kind === 'empty-reading-path').map(f => f.subject)).toEqual(['planning'])
  })

  it('skips repos that are not checked out without findings', () => {
    const r = run()
    expect(r.skippedRepos).toEqual(['svc-hiring'])
    expect(r.findings.some(f => f.detail.includes('svc-hiring'))).toBe(false)
  })
})
