import { describe, it, expect } from 'vitest'
import { parseInjections, injectionReach } from './code-wiring'

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
