import { describe, it, expect } from 'vitest'
import { tableWriters, tableRelations } from './resource-relations'
import { loadRepoGraph } from './code-grades'
import type { Resource } from '@dependency-explorer/schema'

const models = [{ className: 'Shift', file: 'app/models/shift.rb', table: 'shifts', associations: [] }]
const files = [
  { file: 'app/services/create.rb', source: 'Shift.create!(attrs)\n' },
  { file: 'app/services/bulk.rb', source: 'Shift.where(shop_id: id).update_all(deleted: true)\n' },
  { file: 'app/services/commented.rb', source: '# Shift.delete_all\nShift.where(id: 1).first\n' },
  { file: 'app/services/other.rb', source: 'Shifts::Thing.create(x)\nShiftTemplate.create(y)\n' },
]

describe('tableWriters', () => {
  it('finds class-level write calls, including chained scopes, and ignores comments and other classes', () => {
    expect([...(tableWriters(files, models).get('shifts') ?? [])].sort()).toEqual(['app/services/bulk.rb', 'app/services/create.rb'])
  })
})

describe('tableRelations', () => {
  it('lists writers and graph readers once each', () => {
    const graph = loadRepoGraph({
      built_at_commit: 'x',
      nodes: [
        { id: 'm', label: 'Shift', source_file: 'app/models/shift.rb', _callable_class: true },
        { id: 'a', label: 'a', source_file: 'app/services/commented.rb' },
        { id: 'b', label: 'b', source_file: 'app/services/create.rb' },
      ],
      links: [
        { source: 'a', target: 'm', relation: 'calls', confidence: 'EXTRACTED' },
        { source: 'b', target: 'm', relation: 'calls', confidence: 'EXTRACTED' },
      ],
    })
    const shifts: Resource = { id: 'pg:skello_production.shifts', kind: 'table', store: 'postgresql', name: 'shifts', evidence: [], model: { file: 'app/models/shift.rb', className: 'Shift' } }
    const rels = tableRelations([shifts], models, files, graph).map(r => `${r.relation} ${r.file}`)
    expect(rels.sort()).toEqual(['reads app/services/commented.rb', 'writes app/services/bulk.rb', 'writes app/services/create.rb'])
  })
})
