import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { ConnectivityMapSchema } from '@dependency-explorer/schema'
import { checkStateMachines, handlerFileOf } from './state-machine-check'

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sfn-check-'))
const repo = path.join(base, 'svc')
const write = (rel: string, content: string) => {
  fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true })
  fs.writeFileSync(path.join(repo, rel), content)
}
write('tsconfig.json', '{ "compilerOptions": { "paths": { "~/*": ["src/*"] } } }')
write('serverless/functions/sfn.ts', `export const sfnFunctions = () => ({
  JobSfnFetch: { handler: 'src/handlers.fetch', timeout: 30 },
  JobSfnLazy: { handler: 'src/handlers.lazy' },
  JobSfnSolver: { handler: 'solver/handler.lambda_handler' },
  JobSfnError: { handler: 'src/handlers.sfnError' },
})
`)
write('src/handlers.ts', `import {fetchHandler} from '~/container';
export const fetch = async (e) => { await initMongoConnection(); return fetchHandler.handle(e) };
export const lazy = async (e) => {
  const handler = await cache('lazy', async () => { const { getLazyHandler } = await import('~/container'); return getLazyHandler() });
  return handler.handle(e);
};
export const sfnError = async (e) => {
  try { await initMongoConnection() } catch (error) { logger.error('failed', { error }) }
  const handler = await cache('err', async () => { const { getSfnErrorHandlerJob } = await import('~/container'); return getSfnErrorHandlerJob() });
  return handler.handle(e);
};
`)
write('src/container.ts', `import {FetchHandler} from '~/Handler/FetchHandler';
export const fetchHandler = new FetchHandler(repo);
import {Logger} from '@skelloapp/logger';
export const logger = new Logger(config);
export const getSfnErrorHandlerJob = async () => {
  const { SfnErrorHandlerJob } = await import('~/Handler/Error/SfnErrorHandlerJob');
  return new SfnErrorHandlerJob(jobs);
};
export const getLazyHandler = async () => {
  const { LazyHandler } = await import('~/Handler/Lazy/LazyHandler');
  return new LazyHandler(manager);
};
`)
write('src/Handler/FetchHandler.ts', 'export class FetchHandler {}')
write('src/Handler/Lazy/LazyHandler.ts', 'export class LazyHandler {}')
write('src/Handler/Error/SfnErrorHandlerJob.ts', 'export class SfnErrorHandlerJob {}')
write('solver/handler.py', 'def lambda_handler(event, context): pass')
write('serverless/sfn/auto.ts', `export const getAuto = () => ({
  AutoStepFunction: { definition: { StartAt: 'sfnFetch', States: {
    sfnFetch: { Type: 'Task', Resource: { 'Fn::GetAtt': [formattedLambdaName('JobSfnFetch'), 'Arn'] }, Next: 'EmptyCheck',
      Catch: [{ ErrorEquals: ['States.ALL'], Next: 'sfnErrorHandler' }] },
    EmptyCheck: { Type: 'Choice', Choices: [{ Variable: '$.a', IsPresent: false, Next: 'sfnDone' }], Default: 'MapState' },
    MapState: { Type: 'Map', MaxConcurrency: 10, ItemProcessor: { StartAt: 'sfnInner', States: { sfnInner: { Type: 'Task', Resource: { 'Fn::GetAtt': [formattedLambdaName('JobSfnLazy'), 'Arn'] }, End: true } } }, Next: 'sfnDone' },
    sfnDone: { Type: 'Task', Resource: { 'Fn::GetAtt': [formattedLambdaName('JobSfnSolver'), 'Arn'] }, Next: 'sfnSucceed' },
    sfnSucceed: { Type: 'Succeed' },
    sfnErrorHandler: { Type: 'Task', Resource: { 'Fn::GetAtt': [formattedLambdaName('JobSfnFetch'), 'Arn'] }, Next: 'sfnErrorHandlerFail' },
    sfnErrorHandlerFail: { Type: 'Fail' },
    sfnNotify: { Type: 'Task', Resource: { 'Fn::GetAtt': [formattedLambdaName('JobSfnFetch'), 'Arn'] }, End: true },
  } } },
})
`)

const soundMachine = {
  id: 'sm', service: 'svc', machine: 'AutoStepFunction', label: 'Auto', file: 'serverless/sfn/auto.ts', start: 'fetch', errorHandler: 'error',
  states: [
    { id: 'fetch', name: 'sfnFetch', type: 'task', label: 'fetch', unit: 'u-fetch', catches: true, next: 'empty' },
    { id: 'empty', name: 'EmptyCheck', type: 'choice', label: 'empty?', choices: [{ when: 'none', next: 'done' }], default: 'map' },
    { id: 'map', name: 'MapState', type: 'map', label: 'per batch', concurrency: 10, next: 'done', states: [{ id: 'inner', name: 'sfnInner', type: 'task', label: 'inner', unit: 'u-lazy' }] },
    { id: 'done', name: 'sfnDone', type: 'task', label: 'done', unit: 'u-solver' },
    { id: 'error', name: 'sfnErrorHandler', type: 'task', label: 'error' },
    { id: 'notify', name: 'sfnNotify', type: 'task', label: 'notify' },
  ],
}
const driftedMachine = {
  ...soundMachine, start: 'done',
  states: [
    { ...soundMachine.states[0], next: 'map', unit: 'u-wrong' },
    { id: 'empty', name: 'EmptyCheck', type: 'pass', label: 'empty?' },
    { ...soundMachine.states[2], concurrency: 5 },
    { ...soundMachine.states[3], catches: true },
    soundMachine.states[4],
  ],
}
const mapWith = (machine: unknown) => ConnectivityMapSchema.parse({
  services: [{ name: 'svc', type: 'typescript-microservice', description: 'd', endpoints: [] }],
  connections: [],
  flows: [{
    id: 'f', name: 'F', description: 'd', steps: [],
    codeUnits: [
      { id: 'u-fetch', service: 'svc', kind: 'job', label: 'Fetch', path: 'src/Handler/FetchHandler.ts' },
      { id: 'u-lazy', service: 'svc', kind: 'job', label: 'Lazy', path: 'src/Handler/Lazy/LazyHandler.ts' },
      { id: 'u-solver', service: 'svc', kind: 'job', label: 'Solver', path: 'solver/handler.py' },
      { id: 'u-wrong', service: 'svc', kind: 'job', label: 'Wrong', path: 'src/Wrong.ts' },
      { id: 'u-absent', service: 'absent', kind: 'job', label: 'Absent', path: 'src/X.ts' },
    ],
    stateMachines: [machine],
  }],
})

describe('handlerFileOf', () => {
  it('resolves a lambda key to its handler class file, through an instance, a lazy factory, or a Python module', () => {
    expect(handlerFileOf(repo, 'JobSfnFetch')).toBe('src/Handler/FetchHandler.ts')
    expect(handlerFileOf(repo, 'JobSfnLazy')).toBe('src/Handler/Lazy/LazyHandler.ts')
    expect(handlerFileOf(repo, 'JobSfnSolver')).toBe('solver/handler.py')
    expect(handlerFileOf(repo, 'JobSfnError')).toBe('src/Handler/Error/SfnErrorHandlerJob.ts')
    expect(handlerFileOf(repo, 'JobSfnNope')).toBeNull()
  })
})

describe('checkStateMachines', () => {
  it('passes a machine that matches its definition', () => {
    const result = checkStateMachines(mapWith(soundMachine), base)
    expect(result.findings).toEqual([])
    expect(result.verified).toBe(7)
  })
  it('reports start, transition, handler, type, concurrency, catch and completeness drift', () => {
    expect(checkStateMachines(mapWith(driftedMachine), base).findings.map(f => f.detail)).toEqual([
      'start is sfnFetch in code, sfnDone authored',
      'sfnFetch: next EmptyCheck in code, MapState authored',
      'sfnFetch: handler src/Handler/FetchHandler.ts in code, src/Wrong.ts authored',
      'EmptyCheck: type Choice in code, pass authored',
      'MapState: concurrency 10 in code, 5 authored',
      'sfnDone: catches nothing in code, catches authored',
      'sfnNotify: in code, not authored',
    ])
  })
  it('skips a service that is not checked out', () => {
    const absent = { ...soundMachine, service: 'absent', states: [{ id: 'x', name: 'X', type: 'task', label: 'x', unit: 'u-absent' }], start: 'x', errorHandler: undefined }
    expect(checkStateMachines(mapWith(absent), base).skippedRepos).toEqual(['absent'])
  })
})
