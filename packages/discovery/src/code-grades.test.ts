import { describe, it, expect } from 'vitest'
import { loadRepoGraph, gradeEdge, stripComments } from './code-grades'

const graphJson = {
  built_at_commit: 'abc123',
  nodes: [
    { id: 'c1', label: 'ShiftsController', source_file: 'app/controllers/shifts_controller.rb', _callable_class: true },
    { id: 'c1m', label: 'create', source_file: 'app/controllers/shifts_controller.rb' },
    { id: 's1', label: 'V3::Shifts::CreateService', source_file: 'app/services/v3/shifts/create_service.rb', _callable_class: true },
    { id: 'h1', label: 'helper', source_file: 'app/services/helper.rb' },
    { id: 'm1', label: 'Shift', source_file: 'app/models/shift.rb', _callable_class: true },
    { id: 'x1', label: 'Unrelated', source_file: 'app/models/unrelated.rb', _callable_class: true },
  ],
  links: [
    { source: 'c1m', target: 'h1', relation: 'calls', confidence: 'EXTRACTED' },
    { source: 'h1', target: 'm1', relation: 'calls', confidence: 'EXTRACTED' },
    { source: 'c1m', target: 'x1', relation: 'semantically_similar_to', confidence: 'INFERRED' },
  ],
}

describe('gradeEdge', () => {
  const g = loadRepoGraph(graphJson)
  if (!g) {
    throw new Error('fixture graph failed to load')
  }

  it('grades a two-hop extracted path as graph', () => {
    expect(gradeEdge(g, 'app/controllers/shifts_controller.rb', 'app/models/shift.rb', '', 'Shift')).toBe('graph')
  })
  it('never counts inferred relations', () => {
    expect(gradeEdge(g, 'app/controllers/shifts_controller.rb', 'app/models/unrelated.rb', '', 'Unrelated')).toBe('none')
  })
  it('grades a qualified constant declared in the callee as constant', () => {
    expect(gradeEdge(g, 'app/controllers/shifts_controller.rb', 'app/services/v3/shifts/create_service.rb', 'V3::Shifts::CreateService.new(params).call', 'CreateService')).toBe('constant')
  })
  it('grades an import that resolves to the callee as import', () => {
    expect(gradeEdge(g, 'src/a.ts', 'src/lib/punch_client.ts', "import { x } from './lib/punch_client'", 'PunchClient')).toBe('import')
  })
  it('grades comment-only evidence as text at best, never graph', () => {
    expect(gradeEdge(g, 'src/store.js', 'app/controllers/shifts_controller.rb', '// calls ShiftsController\nconst y = ShiftsControllerX', 'ShiftsController')).toBe('none')
  })
  it('grades a bare token match as text', () => {
    expect(gradeEdge(g, 'src/store.js', 'src/other.js', 'const x = OtherThing', 'OtherThing')).toBe('text')
  })
  it('strips ruby, js line and block comments', () => {
    expect(stripComments('a # ruby\nb // js\n/* c */ d')).toBe('a \nb \n d')
  })
})
