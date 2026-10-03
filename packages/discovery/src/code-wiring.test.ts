import { describe, it, expect } from 'vitest'
import { parseInjections, injectionReach, parseViteAliases, resolveSpecifier, importsCallee, type WiredEdge } from './code-wiring'

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
