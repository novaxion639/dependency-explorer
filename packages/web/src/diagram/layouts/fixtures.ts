import { ServiceFlowSchema } from '@dependency-explorer/data'

const job = (id: string, service: string, label: string) => ({ id, service, kind: 'job', label, path: `src/${label}.ts` })

const autoMachine = {
  id: 'sm-auto', service: 'svc', machine: 'AutoStepFunction', label: 'AutoAssign state machine', file: 'sfn.ts', start: 'fetch', errorHandler: 'err',
  states: [
    { id: 'fetch', name: 'sfnFetch', type: 'task', label: 'fetch data', unit: 'u-fetch', catches: true, next: 'empty',
      stores: [{ store: 'jobs', label: 'job status', crud: ['update'] }, { store: 'ws', label: 'progress' }, { store: 's3', label: 'context', crud: ['create'] }] },
    { id: 'empty', name: 'EmptyCheck', type: 'choice', label: 'empty?', choices: [{ when: 'no batches', next: 'finish' }], default: 'filter' },
    { id: 'filter', name: 'sfnFilter', type: 'task', label: 'filter users', unit: 'u-filter', catches: true, next: 'filtered',
      stores: [{ store: 'jobs', label: 'job status', crud: ['update'] }, { store: 's3', label: 'context', crud: ['read', 'update'] }] },
    { id: 'filtered', name: 'PostFilterCheck', type: 'choice', label: 'all filtered?', choices: [{ when: 'pool emptied', next: 'assign' }], default: 'map' },
    { id: 'map', name: 'MapState', type: 'map', label: 'per batch', concurrency: 10, catches: true, next: 'agg',
      states: [{ id: 'elig', name: 'sfnEligibility', type: 'task', label: 'eligibility per batch', unit: 'u-elig', stores: [{ store: 'ws', label: 'progress' }, { store: 's3', label: 'context', crud: ['read', 'create'] }] }] },
    { id: 'agg', name: 'sfnAggregate', type: 'task', label: 'aggregate', unit: 'u-agg', catches: true, next: 'solve',
      stores: [{ store: 'jobs', label: 'job status', crud: ['update'] }, { store: 'ws', label: 'progress' }, { store: 's3', label: 'context', crud: ['read', 'create'] }] },
    { id: 'solve', name: 'sfnSolver', type: 'task', label: 'solve', unit: 'u-solve', catches: true, next: 'assign', stores: [{ store: 's3', label: 'context', crud: ['read', 'create'] }] },
    { id: 'assign', name: 'sfnAssign', type: 'task', label: 'assign shifts', unit: 'u-assign', catches: true, next: 'finish',
      stores: [{ store: 'jobs', label: 'job status', crud: ['update'] }, { store: 'ws', label: 'progress' }, { store: 's3', label: 'context', crud: ['read'] }] },
    { id: 'finish', name: 'sfnFinish', type: 'task', label: 'finish job', unit: 'u-finish', catches: true, stores: [{ store: 'jobs', label: 'job status', crud: ['update'] }, { store: 'ws', label: 'progress' }] },
    { id: 'err', name: 'sfnErrorHandler', type: 'task', label: 'error handler', unit: 'u-err' },
  ],
}

const autoBase = {
  id: 'auto', name: 'Auto', description: 'd', steps: [],
  codeUnits: [
    job('u-fetch', 'svc', 'Fetch'), job('u-filter', 'svc', 'Filter'), job('u-elig', 'svc', 'Eligibility'), job('u-agg', 'svc', 'Aggregate'),
    job('u-solve', 'svc', 'Solve'), job('u-assign', 'svc', 'Assign'), job('u-finish', 'svc', 'Finish'), job('u-err', 'svc', 'ErrorHandler'),
  ],
  infraNodes: [{ id: 'jobs', type: 'mongodb', label: 'jobs' }, { id: 'ws', type: 'sqs', label: 'websocket' }, { id: 's3', type: 's3', label: 'context' }],
  codeEdges: [{ from: 'svc', to: 'sm-auto', label: 'start AutoAssign', mode: 'async-job' }],
  stateMachines: [autoMachine],
}

export const autoFlow = ServiceFlowSchema.parse(autoBase)

export const autoFlowWithJob = ServiceFlowSchema.parse({
  ...autoBase,
  id: 'auto-job',
  codeUnits: [...autoBase.codeUnits, job('u-other-job', 'svc', 'OtherJob')],
  codeEdges: [...autoBase.codeEdges, { from: 'u-assign', to: 'u-other-job', label: 'enqueues', mode: 'async-job' }],
})

export const dpaeFlow = ServiceFlowSchema.parse({
  id: 'dpae', name: 'DPAE', description: 'd', steps: [],
  codeUnits: [job('u-check', 'emp', 'Check'), job('u-update', 'emp', 'Update')],
  codeEdges: [{ from: 'emp', to: 'sm-dpae', label: 'start follow-up', mode: 'async-job' }],
  stateMachines: [{
    id: 'sm-dpae', service: 'emp', machine: 'dpaeFollowUp', label: 'DPAE follow-up', file: 'sfn.ts', start: 'init',
    states: [
      { id: 'init', name: 'Init retry counter', type: 'pass', label: 'init counter', next: 'wait' },
      { id: 'wait', name: 'Wait', type: 'wait', label: 'wait', next: 'check' },
      { id: 'check', name: 'Check DPAE Status', type: 'task', label: 'check status', unit: 'u-check', next: 'pending' },
      { id: 'pending', name: 'Is request pending?', type: 'choice', label: 'pending?', choices: [{ when: 'pending', next: 'increment' }], default: 'update' },
      { id: 'increment', name: 'Increment retry counter', type: 'pass', label: 'increment counter', next: 'exhausted' },
      { id: 'exhausted', name: 'Choice', type: 'choice', label: 'retries exhausted?', choices: [{ when: 'counter ≥ max', next: 'clean' }], default: 'wait' },
      { id: 'clean', name: 'Remove fields', type: 'pass', label: 'clean fields', next: 'update' },
      { id: 'update', name: 'Update Skello DPAE status', type: 'task', label: 'update status', unit: 'u-update' },
    ],
  }],
})

export const machineFixtures = [autoFlow, autoFlowWithJob, dpaeFlow]
