import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { parseInjections, injectionReach, parseViteAliases, resolveSpecifier, importsCallee, vuexNamespaceOf, usesVuexNamespace, emitsToCallee, parseAssociations, namesReceiverModel, loadWiring, wiredGrade, type WiredEdge } from './code-wiring'

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

describe('parseInjections', () => {
  const injects = parseInjections(container)

  it('follows constructor injection through an object literal two hops deep', () => {
    expect(injectionReach(injects, ['DocumentManager'], ['BedrockLlmProvider'])).toBe(true)
  })
  it('follows a Map literal of injected managers', () => {
    expect(injectionReach(injects, ['ProcessSkelloAppDataHandlerJob'], ['EmployeeSkelloAppManager'])).toBe(true)
  })
  it('ends a declaration at its semicolon', () => {
    expect([...(injects.get('UnrelatedManager') ?? [])]).toEqual([])
    expect(injectionReach(injects, ['DocumentManager'], ['UnrelatedManager'])).toBe(false)
  })
  it('stops at two hops', () => {
    expect(injectionReach(injects, ['A'], ['C'])).toBe(true)
    expect(injectionReach(injects, ['A'], ['D'])).toBe(false)
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
  ({ callerPath, calleePath, callerCode, calleeSource, callerClasses: [], calleeClasses: [] })

describe('imports', () => {
  it('reads Vite aliases relative to the config directory', () => {
    expect(aliases).toEqual([
      { prefix: '@app-js', dir: 'apps/vue-app/src' },
      { prefix: '@skello-utils', dir: 'apps/vue-app/src/shared/utils' },
      { prefix: '@app', dir: 'apps/vue-app/legacy' },
    ])
  })
  it('matches the longest alias at a path boundary', () => {
    expect(resolveSpecifier('@app-js/badgings/shared/utils', 'x.js', aliases)).toBe('apps/vue-app/src/badgings/shared/utils')
    expect(resolveSpecifier('@app/old', 'x.js', aliases)).toBe('apps/vue-app/legacy/old')
    expect(resolveSpecifier('@apps/x', 'x.js', aliases)).toBeNull()
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
  const associations = new Map(parseAssociations("class Contract < ApplicationRecord\n  has_many :amendments, class_name: 'ContractAmendment', dependent: :delete_all\n  belongs_to :user\nend\n"))

  it('reads association class names', () => {
    expect([...associations]).toEqual([['amendments', 'ContractAmendment']])
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
  const wiring = { aliases, injects: parseInjections(container), associations: new Map([['amendments', 'ContractAmendment']]) }
  const noFiles = () => null

  it('grades a container path graph and a resolved import import', () => {
    expect(wiredGrade(wiring, { ...edge('src/Manager/DocumentManager.ts', 'src/Client/Llm/BedrockLlmProvider.ts', ''), callerClasses: ['DocumentManager'], calleeClasses: ['BedrockLlmProvider'] }, noFiles)).toBe('graph')
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
    write('src/container.ts', container)
    write('app/models/hr/contract.rb', "has_many :amendments, class_name: 'ContractAmendment'\n")
    const w = loadWiring(dir)
    expect(w.aliases.map(a => a.prefix)).toEqual(['@app-js', '@skello-utils', '@app'])
    expect(injectionReach(w.injects, ['DocumentManager'], ['BedrockLlmProvider'])).toBe(true)
    expect(w.associations.get('amendments')).toBe('ContractAmendment')
  })
})
