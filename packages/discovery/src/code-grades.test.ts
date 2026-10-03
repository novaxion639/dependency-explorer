import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { ConnectivityMapSchema } from '@dependency-explorer/schema'
import { loadRepoGraph, gradeEdge, stripComments, checkCodeGrades, crossRepoGrade, bestGrade } from './code-grades'

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
  it('keeps comment markers inside string literals', () => {
    expect(stripComments("const g = 'src/**/*.ts'\nfoo() // x")).toBe("const g = 'src/**/*.ts'\nfoo() ")
    expect(stripComments('x = "foo #bar" # note')).toBe('x = "foo #bar" ')
  })
  it('grades a cross-repo edge text at best', () => {
    expect([crossRepoGrade('graph'), crossRepoGrade('import'), crossRepoGrade('text'), crossRepoGrade('none')]).toEqual(['text', 'text', 'text', 'none'])
  })
})


describe('gradeEdge through a barrel', () => {
  const barrel = loadRepoGraph({
    built_at_commit: 'abc123',
    nodes: [
      { id: 'api', label: 'api', source_file: 'src/modules/punch/api.ts' },
      { id: 'idx', label: 'index', source_file: 'src/plugins/clients/index.ts' },
      { id: 'pc', label: 'PunchClient', source_file: 'src/plugins/clients/PunchClient/PunchClient.ts', _callable_class: true },
      { id: 'ac', label: 'AuthClient', source_file: 'src/plugins/clients/AuthClient/AuthClient.ts', _callable_class: true },
    ],
    links: [
      { source: 'api', target: 'idx', relation: 'imports_from', confidence: 'EXTRACTED' },
      { source: 'idx', target: 'pc', relation: 're_exports', confidence: 'EXTRACTED' },
      { source: 'idx', target: 'ac', relation: 're_exports', confidence: 'EXTRACTED' },
    ],
  })
  if (!barrel) {
    throw new Error('barrel graph failed to load')
  }
  const source = "import { punchClient } from '@plugins/clients'\nexport const clockIn = () => punchClient.clockIn()"

  it('grades a re-exported callee the caller uses as import', () => {
    expect(gradeEdge(barrel, 'src/modules/punch/api.ts', 'src/plugins/clients/PunchClient/PunchClient.ts', source, 'PunchClient')).toBe('import')
  })
  it('does not credit every file the barrel re-exports', () => {
    expect(gradeEdge(barrel, 'src/modules/punch/api.ts', 'src/plugins/clients/AuthClient/AuthClient.ts', source, 'AuthClient')).toBe('none')
  })
})

describe('checkCodeGrades', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'grades-'))
  const write = (rel: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true })
    fs.writeFileSync(path.join(base, rel), content)
  }
  write('skello-app/graphify-out/graph.json', JSON.stringify(graphJson))
  write('skello-app/app/controllers/shifts_controller.rb', 'class ShiftsController\nend\n')
  const map = ConnectivityMapSchema.parse({
    services: [
      { name: 'skello-app', type: 'rails-monolith', description: 'd', endpoints: [] },
      { name: 'svc-x', type: 'typescript-microservice', description: 'd', endpoints: [] },
    ],
    connections: [],
    flows: [{
      id: 'f', name: 'F', description: 'd', steps: [],
      codeUnits: [
        { id: 'c', service: 'skello-app', kind: 'controller', label: 'ShiftsController', path: 'app/controllers/shifts_controller.rb' },
        { id: 'm', service: 'skello-app', kind: 'model-callback', label: 'Shift', path: 'app/models/shift.rb' },
        { id: 'u', service: 'skello-app', kind: 'model-callback', label: 'Unrelated', path: 'app/models/unrelated.rb' },
        { id: 'x', service: 'svc-x', kind: 'manager', label: 'XManager', path: 'src/x.ts' },
      ],
      codeEdges: [
        { from: 'c', to: 'm', label: 'save', mode: 'sync' },
        { from: 'c', to: 'u', label: 'noop', mode: 'sync' },
        { from: 'c', to: 'x', label: 'cross', mode: 'sync' },
      ],
    }],
  })

  it('grades same-repo edges, reports none as a finding and never grades cross-repo edges as verified', () => {
    const r = checkCodeGrades(map, base, () => 'abc123')
    expect(r.grades['f#c→m']).toBe('graph')
    expect(r.grades['f#c→u']).toBe('none')
    expect(['text', 'none']).toContain(r.grades['f#c→x'])
    expect(r.findings.filter(f => f.kind === 'ungraded-edge').map(f => f.subject)).toContain('f#c→u')
  })

  it('grades nothing in a repo that was not pinned', () => {
    const r = checkCodeGrades(map, base, () => null)
    expect(r.grades['f#c→m']).toBeUndefined()
    expect(r.distribution.graph).toBe(0)
  })

  it('refuses to grade a repo whose graph was built at another commit', () => {
    const r = checkCodeGrades(map, base, () => 'deadbeef')
    expect(r.grades['f#c→m']).toBeUndefined()
    expect(r.findings.filter(f => f.kind === 'stale-graph').map(f => f.detail)).toEqual(['graph stale — run graphify update at deadbeef'])
  })
})

describe('bestGrade', () => {
  it('keeps the better grade and never drops one', () => {
    expect(bestGrade('none', 'import')).toBe('import')
    expect(bestGrade('constant', 'text')).toBe('constant')
    expect(bestGrade('text', null)).toBe('text')
  })
})

describe('checkCodeGrades with container wiring', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wired-'))
  const write = (rel: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true })
    fs.writeFileSync(path.join(base, rel), content)
  }
  write('svc-x/graphify-out/graph.json', JSON.stringify({
    built_at_commit: 'abc123',
    nodes: [
      { id: 'd', label: 'DocumentManager', source_file: 'src/Manager/DocumentManager.ts', _callable_class: true },
      { id: 'b', label: 'BedrockLlmProvider', source_file: 'src/Client/Llm/BedrockLlmProvider.ts', _callable_class: true },
    ],
    links: [],
  }))
  write('svc-x/src/Manager/DocumentManager.ts', 'export class DocumentManager {}\n')
  write('svc-x/src/Manager/ExtractionManager.ts', 'export class ExtractionManager {}\n')
  write('svc-x/src/Client/Llm/BedrockLlmProvider.ts', 'export class BedrockLlmProvider {}\n')
  write('svc-x/src/container.ts', "import {DocumentManager} from './Manager/DocumentManager';\nimport {ExtractionManager} from './Manager/ExtractionManager';\nimport {BedrockLlmProvider} from './Client/Llm/BedrockLlmProvider';\nconst extractionManager = new ExtractionManager(new BedrockLlmProvider(client));\nconst documentManager = new DocumentManager(extractionManager);\n")
  const map = ConnectivityMapSchema.parse({
    services: [{ name: 'svc-x', type: 'typescript-microservice', description: 'd', endpoints: [] }],
    connections: [],
    flows: [{
      id: 'f', name: 'F', description: 'd', steps: [],
      codeUnits: [
        { id: 'd', service: 'svc-x', kind: 'manager', label: 'DocumentManager', path: 'src/Manager/DocumentManager.ts' },
        { id: 'b', service: 'svc-x', kind: 'service', label: 'BedrockLlmProvider', path: 'src/Client/Llm/BedrockLlmProvider.ts' },
      ],
      codeEdges: [{ from: 'd', to: 'b', label: 'extraction', mode: 'sync' }],
    }],
  })

  it('grades an edge the container wires but the graph cannot see', () => {
    expect(checkCodeGrades(map, base, () => 'abc123').grades['f#d→b']).toBe('graph')
  })
})

describe('checkCodeGrades across repos through monolith routes', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'routes-'))
  const write = (rel: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true })
    fs.writeFileSync(path.join(base, rel), content)
  }
  const SHIFTS = 'app/controllers/v3/api/plannings/shifts_controller.rb'
  const ORGS = 'app/controllers/v3/api/billing_automation/organisations_controller.rb'
  write('front/src/store/shifts.js', "import { ENDPOINT_NAMESPACE } from './api/shift';\nimport { util } from './helpers';\nexport const load = () => fetchInChunks(params, `${ENDPOINT_NAMESPACE}`);\n")
  write('front/src/store/api/shift.js', "export const ENDPOINT_NAMESPACE = '/v3/api/plannings/shifts';\n")
  write('front/src/store/helpers/index.js', 'export const util = 1;\n')
  write('billing/tsconfig.json', '{ "compilerOptions": { "paths": { "~/*": ["src/*"] } } }')
  write('billing/src/Manager/SkelloManager.ts', "import {SkelloRepository} from '~/Repository/SkelloRepository';\n")
  write('billing/src/Repository/SkelloRepository.ts', "export class SkelloRepository { upsert() { return this.put('/organisations/upsert', {}) } }\n")
  const map = ConnectivityMapSchema.parse({
    services: [
      { name: 'skello-app', type: 'rails-monolith', description: 'd', endpoints: [] },
      { name: 'front', type: 'typescript-microservice', description: 'd', endpoints: [] },
      { name: 'billing', type: 'typescript-microservice', description: 'd', endpoints: [] },
    ],
    connections: [],
    flows: [{
      id: 'f', name: 'F', description: 'd', steps: [],
      codeUnits: [
        { id: 'store', service: 'front', kind: 'service', label: 'shifts store', path: 'src/store/shifts.js' },
        { id: 'shifts', service: 'skello-app', kind: 'controller', label: 'ShiftsController', path: SHIFTS },
        { id: 'mgr', service: 'billing', kind: 'manager', label: 'SkelloManager', path: 'src/Manager/SkelloManager.ts' },
        { id: 'orgs', service: 'skello-app', kind: 'controller', label: 'OrganisationsController', path: ORGS },
      ],
      codeEdges: [
        { from: 'store', to: 'shifts', label: 'GET shifts', mode: 'sync' },
        { from: 'mgr', to: 'orgs', label: 'upserts', mode: 'sync' },
        { from: 'store', to: 'orgs', label: 'none', mode: 'sync' },
      ],
    }],
  })
  const routes = [
    { path: '/v3/api/plannings/shifts', controllerFile: SHIFTS },
    { path: '/v3/api/billing_automation/organisations/upsert', controllerFile: ORGS },
  ]

  it('grades cross-repo edges through monolith routes', () => {
    const { grades } = checkCodeGrades(map, base, () => 'abc123', routes)
    expect(grades['f#store→shifts']).toBe('import')
    expect(grades['f#mgr→orgs']).toBe('text')
    expect(grades['f#store→orgs']).toBe('none')
  })
})
