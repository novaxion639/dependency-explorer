import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { readMachine } from './state-machine-source'

const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sfn-'))
const write = (rel: string, content: string) => {
  fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true })
  fs.writeFileSync(path.join(repo, rel), content)
}
write('tsconfig.json', '{ "compilerOptions": { "paths": { "~serverless/*": ["serverless/*"] } } }')
write('serverless/sfn/utils.ts', `export const errorStates = () => ({
  sfnErrorHandler: { Type: 'Task', Resource: { 'Fn::GetAtt': [formattedLambdaName('JobSfnErrorHandler'), 'Arn'] }, Next: 'sfnErrorHandlerFail' },
  sfnErrorHandlerFail: { Type: 'Fail' },
})
export const notificationError = (id: string) => ({
  [id]: { Type: 'Task', Resource: { 'Fn::GetAtt': [formattedLambdaName('JobSfnNotificationError'), 'Arn'] }, Next: \`\${id}Fail\` },
  [\`\${id}Fail\`]: { Type: 'Fail' },
})
export const retryProcess = (next = 'sfnErrorHandler') => ({
  Retry: [{ ErrorEquals: ['States.ALL'], MaxAttempts: 0 }],
  Catch: [{ ErrorEquals: ['States.ALL'], ResultPath: '$.Error', Next: next }],
})
`)
write('serverless/sfn/auto.ts', `import {errorStates, notificationError, retryProcess} from '~serverless/sfn/utils';
// a comment with Next: 'nowhere'
export const getAuto = () => ({
  AutoStepFunction: {
    definition: {
      StartAt: 'sfnFetch',
      States: {
        sfnFetch: { Type: 'Task', Resource: { 'Fn::GetAtt': [formattedLambdaName('JobSfnFetch'), 'Arn'] }, Next: 'EmptyCheck',
          Catch: [{ ErrorEquals: ['States.ALL'], ResultPath: '$.Error', Next: 'sfnErrorHandler' }] },
        EmptyCheck: { Type: 'Choice', Choices: [{ Variable: '$.a', IsPresent: false, Next: 'sfnDone' }], Default: 'MapState' },
        MapState: { Type: 'Map', MaxConcurrency: 10, ItemProcessor: { StartAt: 'sfnInner', States: { sfnInner: { Type: 'Task', Resource: { 'Fn::GetAtt': [formattedLambdaName('JobSfnInner'), 'Arn'] }, End: true } } }, Next: 'sfnDone', ...retryProcess() },
        sfnDone: { Type: 'Task', Resource: { 'Fn::GetAtt': [formattedLambdaName('JobSfnDone'), 'Arn'] }, Next: 'sfnSucceed' },
        sfnSucceed: { Type: 'Succeed' },
        ...errorStates(),
        ...notificationError('sfnNotify'),
      },
    },
  },
})
`)
write('serverless/sfn/dpae.ts', `export const getDpae = () => ({
  dpaeFollowUp: { definition: { StartAt: 'Init retry counter', States: {
    'Init retry counter': { Type: 'Pass', Next: 'Wait' },
    Wait: { Type: 'Wait', SecondsPath: '$.waitTime', Next: 'Is request pending?' },
    'Is request pending?': { Type: 'Choice', Choices: [{ Variable: '$.s', StringEquals: 'pending', Next: 'Wait' }], Default: 'Update' },
    Update: { Type: 'Task', Resource: 'arn:aws:states:::lambda:invoke', Parameters: { FunctionName: { 'Fn::GetAtt': ['UpdateSkelloDpaeStatusSfnJob', 'Arn'] } }, End: true },
  } } },
})
`)
write('serverless/sfn/par.ts', `import {missing} from './nowhere';
export const getPar = () => ({ ParMachine: { definition: { StartAt: 'Init', States: {
  Init: { Type: 'Parallel', Branches: [{ StartAt: 'A', States: { A: { Type: 'Task', Resource: { 'Fn::GetAtt': ['JobSfnA', 'Arn'] }, End: true } } }], Next: 'Done' },
  Done: { Type: 'Succeed' },
  ...missing(),
} } } })
`)

describe('readMachine', () => {
  const auto = readMachine(repo, 'serverless/sfn/auto.ts', 'AutoStepFunction')
  const names = (states: Array<{ name: string }> = []) => states.map(s => s.name)
  it('reads literal states, spread helpers and computed-key helpers', () => {
    expect(auto?.startAt).toBe('sfnFetch')
    expect(names(auto?.states)).toEqual(['sfnFetch', 'EmptyCheck', 'MapState', 'sfnDone', 'sfnSucceed', 'sfnErrorHandler', 'sfnErrorHandlerFail', 'sfnNotify', 'sfnNotifyFail'])
    expect(auto?.unresolved).toEqual([])
  })
  it('reads transitions, catches, concurrency and lambda keys at the state level only', () => {
    const fetch = auto?.states.find(s => s.name === 'sfnFetch')
    expect(fetch).toMatchObject({ type: 'Task', next: 'EmptyCheck', catchNexts: ['sfnErrorHandler'], lambdaKey: 'JobSfnFetch', end: false })
    expect(auto?.states.find(s => s.name === 'EmptyCheck')).toMatchObject({ type: 'Choice', choiceNexts: ['sfnDone'], default: 'MapState' })
    const map = auto?.states.find(s => s.name === 'MapState')
    expect(map).toMatchObject({ type: 'Map', maxConcurrency: 10, startAt: 'sfnInner', next: 'sfnDone', catchNexts: ['sfnErrorHandler'] })
    expect(map?.lambdaKey).toBeUndefined()
    expect(map?.states[0]).toMatchObject({ name: 'sfnInner', end: true, lambdaKey: 'JobSfnInner' })
    expect(auto?.states.find(s => s.name === 'sfnNotify')).toMatchObject({ type: 'Task', next: 'sfnNotifyFail', lambdaKey: 'JobSfnNotificationError' })
  })
  it('reads quoted state names and lambda:invoke function names', () => {
    const dpae = readMachine(repo, 'serverless/sfn/dpae.ts', 'dpaeFollowUp')
    expect(names(dpae?.states)).toEqual(['Init retry counter', 'Wait', 'Is request pending?', 'Update'])
    expect(dpae?.states.find(s => s.name === 'Is request pending?')).toMatchObject({ choiceNexts: ['Wait'], default: 'Update' })
    expect(dpae?.states.find(s => s.name === 'Update')).toMatchObject({ lambdaKey: 'UpdateSkelloDpaeStatusSfnJob', end: true })
  })
  it('reads parallel branches and reports an unresolved helper', () => {
    const par = readMachine(repo, 'serverless/sfn/par.ts', 'ParMachine')
    expect(par?.states[0]).toMatchObject({ type: 'Parallel', branchStarts: ['A'], next: 'Done' })
    expect(names(par?.states[0]?.states)).toEqual(['A'])
    expect(par?.unresolved).toEqual(['missing'])
  })
  it('is null for a missing file or machine', () => {
    expect(readMachine(repo, 'serverless/sfn/none.ts', 'X')).toBeNull()
    expect(readMachine(repo, 'serverless/sfn/auto.ts', 'Nope')).toBeNull()
  })
})
