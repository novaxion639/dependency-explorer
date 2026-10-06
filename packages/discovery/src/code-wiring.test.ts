import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { associationMap, parseInjections, injectionReach, parseViteAliases, resolveSpecifier, importsCallee, vuexNamespaceOf, usesVuexNamespace, emitsToCallee, parseAssociations, namesReceiverModel, loadWiring, wiredGrade, parseTsconfigPaths, importedFiles, type WiredEdge } from './code-wiring'

const container = `
const llmProviders: LlmProviders = {
  [LlmUseCase.PAYSLIPS]: new BedrockLlmProvider(bedrockRuntimeClient, claudeHaiku45, logger),
};
const extractionManager = new ExtractionManager(llmProviders);
const documentManager = new DocumentManager(documentRepository, extractionManager, logger);
const employeeManager = new EmployeeSkelloAppManager(employeeRepository, logger);
const managerForTableName = new Map<string, SkelloAppManager>([
  ['users', employeeManager],
]);
export const processJob = new ProcessSkelloAppDataHandlerJob(managerForTableName, logger);
export const initMongo = async (name: string) => { await connect(name) };
const unrelated = new UnrelatedManager(logger);
function makeAudit() { return new AuditManager() }
const a = new A(b);
const b = new B(c);
const c = new C(d);
const d = new D();
`

const asFile = (cls: string) => `src/${cls}.ts`

describe('parseInjections', () => {
  const injects = parseInjections(container, asFile)

  it('follows constructor injection through an object literal two hops deep', () => {
    expect(injectionReach(injects, [asFile('DocumentManager')], [asFile('BedrockLlmProvider')])).toBe(true)
  })
  it('follows a Map literal of injected managers', () => {
    expect(injectionReach(injects, [asFile('ProcessSkelloAppDataHandlerJob')], [asFile('EmployeeSkelloAppManager')])).toBe(true)
  })
  it('ends a declaration at its semicolon', () => {
    expect([...(injects.get(asFile('UnrelatedManager')) ?? [])]).toEqual([])
    expect(injectionReach(injects, [asFile('DocumentManager')], [asFile('UnrelatedManager')])).toBe(false)
  })
  it('stops at two hops', () => {
    expect(injectionReach(injects, [asFile('A')], [asFile('C')])).toBe(true)
    expect(injectionReach(injects, [asFile('A')], [asFile('D')])).toBe(false)
  })
})

const viteConfig = `
    alias: {
        '@app-js': fileURLToPath(new URL('./src', import.meta.url)),
        '@skello-utils': fileURLToPath(
          new URL('./src/shared/utils', import.meta.url),
        ),
        '@app': fileURLToPath(new URL('./legacy/', import.meta.url)),
    },
`
const aliases = parseViteAliases(viteConfig, 'apps/vue-app')
const files = new Map([
  ['apps/vue-app/src/shared/utils/clients/index.js', "export { httpClient } from './http_client';\nexport { punchClient } from './punch_client';\n"],
])
const read = (p: string) => files.get(p) ?? null
const edge = (callerPath: string, calleePath: string, callerCode: string, calleeSource = ''): WiredEdge =>
  ({ callerPath, calleePath, callerCode, calleeSource, calleeClasses: [] })

describe('imports', () => {
  it('reads Vite aliases relative to the config directory', () => {
    expect(aliases).toEqual([
      { prefix: '@app-js', dir: 'apps/vue-app/src', scope: 'apps/vue-app' },
      { prefix: '@skello-utils', dir: 'apps/vue-app/src/shared/utils', scope: 'apps/vue-app' },
      { prefix: '@app', dir: 'apps/vue-app/legacy', scope: 'apps/vue-app' },
    ])
  })
  it('matches the longest alias at a path boundary', () => {
    expect(resolveSpecifier('@app-js/badgings/shared/utils', 'apps/vue-app/src/x.js', aliases)).toBe('apps/vue-app/src/badgings/shared/utils')
    expect(resolveSpecifier('@app/old', 'apps/vue-app/src/x.js', aliases)).toBe('apps/vue-app/legacy/old')
    expect(resolveSpecifier('@apps/x', 'apps/vue-app/src/x.js', aliases)).toBeNull()
    expect(resolveSpecifier('./api', 'src/modules/shifts/connector.ts', aliases)).toBe('src/modules/shifts/api')
  })
  it('credits an aliased directory import to its index file', () => {
    const code = "import { matchBadgings } from '@app-js/badgings/shared/utils';"
    expect(importsCallee(edge('apps/vue-app/src/shared/store/modules/timeclock/badgings.js', 'apps/vue-app/src/badgings/shared/utils/index.js', code), aliases, read)).toBe(true)
  })
  it('credits a barrel re-export only for the names the caller imports', () => {
    const code = "import {\n  punchClient,\n} from '@skello-utils/clients';"
    const caller = 'apps/vue-app/src/shared/store/modules/timeclock/badgings.js'
    expect(importsCallee(edge(caller, 'apps/vue-app/src/shared/utils/clients/punch_client.js', code), aliases, read)).toBe(true)
    expect(importsCallee(edge(caller, 'apps/vue-app/src/shared/utils/clients/http_client.js', code), aliases, read)).toBe(false)
  })
})

const storeFiles = new Map([
  ['apps/vue-app/src/shared/store/modules/index.js', [
    "export { default as badgings } from './timeclock/badgings.js';",
    "export { default as timeclockOnboarding } from './timeclock/onboarding.js';",
    "export { default as onboarding } from './onboarding.js';",
  ].join('\n')],
])
const readStore = (p: string) => storeFiles.get(p) ?? null

describe('vuex and events', () => {
  it('names the namespace a store module is registered under', () => {
    expect(vuexNamespaceOf('apps/vue-app/src/shared/store/modules/timeclock/badgings.js', readStore)).toBe('badgings')
    expect(vuexNamespaceOf('apps/vue-app/src/shared/store/modules/onboarding.js', readStore)).toBe('onboarding')
    expect(vuexNamespaceOf('apps/vue-app/src/badgings/Badgings.vue', readStore)).toBeNull()
  })
  it('matches the namespace exactly', () => {
    expect(usesVuexNamespace("...mapState('onboarding', ['currentShop'])", 'onboarding')).toBe(true)
    expect(usesVuexNamespace("this.$store.dispatch('onboarding/save')", 'onboarding')).toBe(true)
    expect(usesVuexNamespace("...mapState('timeclockOnboarding', ['x'])", 'onboarding')).toBe(false)
    expect(usesVuexNamespace("dispatch('onboardingX/save')", 'onboarding')).toBe(false)
  })
  it('credits an emitted event the importing parent listens to', () => {
    const modal = "this.$emit('download');"
    const toolbar = "<StaffRegisterModal @download=\"downloadStaffRegister\" />\nimport StaffRegisterModal from './StaffRegisterModal';"
    const e = edge('apps/vue-app/src/users/shared/components/StaffRegisterModal.vue', 'apps/vue-app/src/users/shared/components/Toolbar.vue', modal, toolbar)
    expect(emitsToCallee(e, aliases)).toBe(true)
    expect(emitsToCallee({ ...e, calleeSource: '<StaffRegisterModal @close="x" />\nimport StaffRegisterModal from \'./StaffRegisterModal\';' }, aliases)).toBe(false)
  })
})

describe('rails receivers', () => {
  const associations = associationMap(parseAssociations("class Contract < ApplicationRecord\n  has_many :amendments, class_name: 'ContractAmendment', dependent: :delete_all\n  belongs_to :user\nend\n"))

  it('reads association class names', () => {
    expect([...associations].map(([k, v]) => [k, [...v]])).toEqual([['amendments', ['ContractAmendment']]])
  })
  it('maps a receiver to the model its name singularizes to', () => {
    expect(namesReceiverModel('@badgings.each do |badging|', ['Badging'], associations)).toBe(true)
    expect(namesReceiverModel('shift.destroy!', ['Shift'], associations)).toBe(true)
    expect(namesReceiverModel('companies.each(&:touch)', ['Company'], associations)).toBe(true)
  })
  it('maps an association receiver through its class name', () => {
    expect(namesReceiverModel('new_amendment = @contract.amendments.build(', ['ContractAmendment'], associations)).toBe(true)
  })
  it('ignores receivers that name another model', () => {
    expect(namesReceiverModel('params.require(:shift)', ['Shift'], associations)).toBe(false)
  })
})

describe('wiredGrade', () => {
  const wiring = { aliases, injects: parseInjections(container, asFile), associations: associationMap([['amendments', 'ContractAmendment']]) }
  const noFiles = () => null

  it('grades a container path graph and a resolved import import', () => {
    expect(wiredGrade(wiring, edge(asFile('DocumentManager'), asFile('BedrockLlmProvider'), ''), noFiles)).toBe('graph')
    expect(wiredGrade(wiring, edge('apps/vue-app/src/badgings/Badgings.vue', 'apps/vue-app/src/shared/store/modules/timeclock/badgings.js', "...mapState('badgings', ['users'])"), readStore)).toBe('import')
  })
  it('grades a Rails receiver text and ignores it outside Ruby', () => {
    expect(wiredGrade(wiring, { ...edge('app/services/v3/shifts/destroy_service.rb', 'app/models/shift.rb', 'shift.destroy!'), calleeClasses: ['Shift'] }, noFiles)).toBe('text')
    expect(wiredGrade(wiring, { ...edge('src/shifts.ts', 'app/models/shift.rb', 'shift.destroy()'), calleeClasses: ['Shift'] }, noFiles)).toBeNull()
  })
})

describe('loadWiring', () => {
  it('loads empty wiring for a bare repo', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiring-'))
    const w = loadWiring(dir)
    expect(w.aliases).toEqual([])
    expect(w.injects.size).toBe(0)
    expect(w.associations.size).toBe(0)
  })
  it('reads app vite configs, the container and model associations', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiring-'))
    const write = (rel: string, content: string) => {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
      fs.writeFileSync(path.join(dir, rel), content)
    }
    write('apps/vue-app/vite.config.mjs', viteConfig)
    write('tsconfig.json', '{ "compilerOptions": { "paths": { "~/*": ["src/*"] } } }')
    write('src/container.ts', "import {ExtractionManager} from './Manager/ExtractionManager';\nimport {DocumentManager} from '~/Manager/DocumentManager';\nimport BedrockLlmProvider from '~/Client/Llm/BedrockLlmProvider';\n" + container)
    write('src/Manager/ExtractionManager.ts', 'export class ExtractionManager {}\n')
    write('src/Manager/DocumentManager.ts', 'export class DocumentManager {}\n')
    write('src/Client/Llm/BedrockLlmProvider.ts', 'export default class BedrockLlmProvider {}\n')
    write('app/models/hr/contract.rb', "has_many :amendments, class_name: 'ContractAmendment'\n")
    const w = loadWiring(dir)
    expect(w.aliases.map(a => a.prefix)).toEqual(['~', '@app-js', '@skello-utils', '@app'])
    expect(injectionReach(w.injects, ['src/Manager/DocumentManager.ts'], ['src/Client/Llm/BedrockLlmProvider.ts'])).toBe(true)
    expect([...(w.associations.get('amendments') ?? [])]).toEqual(['ContractAmendment'])
  })
})

describe('container injection by file', () => {
  const files = new Map([
    ['SkelloAppEmployeeRepository', 'src/Repository/SkelloAppEmployeeRepository.ts'],
    ['LLMResponseRepository', 'src/Repository/DynamoDb/LLMResponseRepository.ts'],
    ['LLMResponseManager', 'src/Manager/LLMResponseManager.ts'],
    ['ImplementationProviderRegistry', 'src/Registry/ImplementationProviderRegistry.ts'],
    ['AdditionImplementationProvider', 'src/Provider/AdditionImplementationProvider.ts'],
    ['AdditionRepository', 'src/Repository/AdditionRepository.ts'],
    ['IntegrationManager', 'src/Manager/IntegrationManager.ts'],
  ])
  const fileOf = (name: string) => files.get(name) ?? null
  const injects = parseInjections(`
const httpClient = new HttpClient(config);
const employeeRepository = new SkelloAppEmployeeRepository(httpClient);
const llmResponseRepository = new LLMResponseRepository(table);
const llmResponseManager = new LLMResponseManager(llmResponseRepository);
const registry = new ImplementationProviderRegistry({ ADDITION: new AdditionImplementationProvider(additionRepository) });
const additionRepository = new AdditionRepository();
const integrationManager = new IntegrationManager(registry);
`, fileOf)

  it('credits the file the container imports, never a same-named class elsewhere', () => {
    expect(injectionReach(injects, ['src/Repository/SkelloAppEmployeeRepository.ts'], ['src/Client/HttpClient/index.ts'])).toBe(false)
    expect(injectionReach(injects, ['src/Manager/LLMResponseManager.ts'], ['src/Repository/Mongo/LLMResponseRepository.ts'])).toBe(false)
    expect(injectionReach(injects, ['src/Manager/LLMResponseManager.ts'], ['src/Repository/DynamoDb/LLMResponseRepository.ts'])).toBe(true)
  })
  it('gives a nested construction only its class, never its arguments', () => {
    expect(injectionReach(injects, ['src/Registry/ImplementationProviderRegistry.ts'], ['src/Provider/AdditionImplementationProvider.ts'])).toBe(true)
    expect(injectionReach(injects, ['src/Manager/IntegrationManager.ts'], ['src/Provider/AdditionImplementationProvider.ts'])).toBe(true)
    expect(injectionReach(injects, ['src/Manager/IntegrationManager.ts'], ['src/Repository/AdditionRepository.ts'])).toBe(false)
  })
})

describe('imported files', () => {
  const tsconfig = `{
  "compilerOptions": {
    // path aliases
    "paths": {
      "~/*": ["src/*"],
      "@test/*": ["test/*"]
    }
  }
}`
  const repo = new Map([
    ['src/Repository/Skello/SkelloRepository.ts', 'export class SkelloRepository {}'],
    ['apps/vue-app/src/shared/store/modules/plannings/api/shift.js', "export const ENDPOINT_NAMESPACE = '/v3/api/plannings/shifts';"],
  ])
  const readRepo = (p: string) => repo.get(p) ?? null

  it('lists the repo files a caller imports, skipping packages', () => {
    const manager = "import {SkelloRepository} from '~/Repository/Skello/SkelloRepository';\nimport {AxiosError} from 'axios';"
    expect(importedFiles(manager, 'src/Manager/SkelloManager.ts', parseTsconfigPaths(tsconfig, ''), readRepo)).toEqual(['src/Repository/Skello/SkelloRepository.ts'])
    const store = "import {\n  ENDPOINT_NAMESPACE,\n} from './api/shift';"
    expect(importedFiles(store, 'apps/vue-app/src/shared/store/modules/plannings/shifts.js', [], readRepo)).toEqual(['apps/vue-app/src/shared/store/modules/plannings/api/shift.js'])
  })
})

describe('parseInjections precision', () => {
  const asFile = (cls: string) => `src/${cls}.ts`
  it('never splits or wires through strings and comments', () => {
    const container = [
      "const a = new A('x; new B(')",
      '// const c = new C(a)',
      'const d = new D(a /* ; new E() */)',
    ].join('\n')
    const injects = parseInjections(container, asFile)
    expect([...injects.keys()].sort()).toEqual(['src/A.ts', 'src/D.ts'])
    expect([...(injects.get('src/D.ts') ?? [])]).toEqual(['src/A.ts'])
  })
  it('reads object values, not keys, as dependencies', () => {
    const container = [
      'const documentManager = new DocumentManager()',
      'const other = new Other()',
      'const x = new X({ documentManager: other })',
      'const y = new Y({ documentManager })',
    ].join('\n')
    const injects = parseInjections(container, asFile)
    expect([...(injects.get('src/X.ts') ?? [])]).toEqual(['src/Other.ts'])
    expect([...(injects.get('src/Y.ts') ?? [])]).toEqual(['src/DocumentManager.ts'])
  })
  it('reads declarations indented inside an initContainer function', () => {
    const container = [
      'export const initContainer = async (env) => {',
      '  const repo = new Repo(env)',
      '  const manager = new Manager(repo)',
      '  return { manager }',
      '}',
    ].join('\n')
    expect([...(parseInjections(container, asFile).get('src/Manager.ts') ?? [])]).toEqual(['src/Repo.ts'])
  })
})

describe('resolveSpecifier scopes', () => {
  const aliases = [
    ...parseViteAliases("'@environment': fileURLToPath(new URL('./src/environment', import.meta.url))", 'apps/base-app'),
    ...parseViteAliases("'@environment': fileURLToPath(new URL('./src/env', import.meta.url))", 'apps/vue-app'),
    ...parseTsconfigPaths('"~/*": ["src/*"]', ''),
  ]
  it('resolves an app alias inside its own app only', () => {
    expect(resolveSpecifier('@environment/urls', 'apps/base-app/src/a.ts', aliases)).toBe('apps/base-app/src/environment/urls')
    expect(resolveSpecifier('@environment/urls', 'apps/vue-app/src/a.js', aliases)).toBe('apps/vue-app/src/env/urls')
    expect(resolveSpecifier('@environment/urls', 'packages/x/a.ts', aliases)).toBeNull()
  })
  it('applies a repo-root alias everywhere', () => {
    expect(resolveSpecifier('~/Manager/A', 'apps/vue-app/src/a.js', aliases)).toBe('src/Manager/A')
  })
})

describe('emitsToCallee scoping', () => {
  const e = (calleeSource: string): WiredEdge => ({
    callerPath: 'apps/vue-app/src/Child.vue', calleePath: 'apps/vue-app/src/Parent.vue',
    callerCode: "this.$emit('saved')", calleeSource, calleeClasses: [],
  })
  const imp = "import Child from './Child';\nimport Other from './Other';\n"
  it('credits the event bound on the tag that renders the caller', () => {
    expect(emitsToCallee(e(`${imp}<Child @saved="x" />`), [])).toBe(true)
    expect(emitsToCallee(e(`${imp}<child v-on:saved="x"></child>`), [])).toBe(true)
    expect(emitsToCallee(e(`${imp}<component :is="Child" @saved="x" />`), [])).toBe(true)
  })
  it('never credits a binding on another element or inside an HTML comment', () => {
    expect(emitsToCallee(e(`${imp}<Child /><Other @saved="x" />`), [])).toBe(false)
    expect(emitsToCallee(e(`${imp}<!-- <Child @saved="x" /> --><Child />`), [])).toBe(false)
  })
})

describe('associations across models', () => {
  it('keeps every class an association name points to', () => {
    const associations = associationMap([
      ...parseAssociations("has_many :items, class_name: 'OrderItem'"),
      ...parseAssociations("has_many :items, class_name: 'CartItem'"),
    ])
    expect(namesReceiverModel('@items.each', ['OrderItem'], associations)).toBe(true)
    expect(namesReceiverModel('@items.each', ['CartItem'], associations)).toBe(true)
  })
})

describe('loadWiring on unexpected files', () => {
  it('treats an apps or app/models file as absent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiring-files-'))
    fs.writeFileSync(path.join(dir, 'apps'), '')
    fs.mkdirSync(path.join(dir, 'app'))
    fs.writeFileSync(path.join(dir, 'app', 'models'), '')
    expect(loadWiring(dir).associations.size).toBe(0)
  })
})
