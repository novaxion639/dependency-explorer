import { ConnectivityMapSchema, ResourceSurfaceSchema } from '@dependency-explorer/schema'
import type { Dataset } from '../discovery-run'

const endpoint = (id: string, method: string, path: string) => ({
  id, method, path, description: id, useCase: id, params: [], response: {},
})

export const goldenDataset: Dataset = {
  map: ConnectivityMapSchema.parse({
    services: [
      { name: 'skello-app', type: 'rails-monolith', description: 'Fictitious monolith', endpoints: [] },
      { name: 'svc-alpha', type: 'typescript-microservice', description: 'Fictitious alpha service', endpoints: [endpoint('list-items', 'GET', '/alpha/items')] },
      { name: 'svc-beta', type: 'typescript-microservice', description: 'Fictitious beta service', endpoints: [endpoint('create-job', 'POST', '/beta/jobs')] },
    ],
    connections: [
      { from: 'svc-alpha', to: 'svc-beta', sdkPackage: '@skelloapp/svc-beta-client', description: 'Alpha creates beta jobs', usedEndpoints: ['create-job'], communicationType: 'sync', protocol: 'rest', authType: 'internal' },
      { from: 'svc-beta', to: 'svc-alpha', sdkPackage: '@skelloapp/svc-alpha-client', description: 'Beta lists alpha items', usedEndpoints: ['list-items'], communicationType: 'sync', protocol: 'rest', authType: 'internal' },
    ],
    flows: [
      {
        id: 'alpha-jobs',
        name: 'Alpha jobs',
        description: 'Alpha hands a job to beta',
        trigger: { actor: 'manager' },
        primaryArea: 'scheduling',
        chapters: [{ title: 'Alpha hands a job to beta', summary: 'svc-alpha creates a job that svc-beta runs.', refs: ['svc-alpha', 'svc-beta'] }],
        steps: [{ from: 'svc-alpha', to: 'svc-beta', action: 'creates a job' }],
        codeUnits: [
          { id: 'alpha-config', service: 'svc-alpha', kind: 'service', label: 'svc-alpha serverless config', path: 'serverless.ts', flags: [{ name: 'ALPHA_JOBS_ENABLED', kind: 'dev' }] },
          { id: 'shift-model', service: 'skello-app', kind: 'model-callback', label: 'Shift', path: 'app/models/shift.rb' },
          { id: 'shift-job', service: 'skello-app', kind: 'job', label: 'ShiftSyncJob', path: 'app/jobs/shift_sync_job.rb' },
        ],
        codeEdges: [
          { from: 'shift-model', to: 'shift-job', mode: 'async-job', label: 'sync_shift' },
          { from: 'shift-job', to: 'svc-alpha', mode: 'async-event', label: 'alpha job', failure: { queue: 'alphaJobs', dlq: 'alphaJobsDlq' } },
          { from: 'alpha-config', to: 'svc-beta', mode: 'sync', label: 'create job', auth: { authorizer: 'betaAuthorizer' }, contractRefs: ['POST /beta/jobs'] },
        ],
        branches: [{ id: 'on-create', at: 'shift-model', when: 'a shift is created', outcome: 'the sync job is enqueued', evidence: { literal: 'perform_later' } }],
      },
    ],
    rules: [{ id: 'shift-sync', title: 'Shift sync', statement: 'A created shift is synced to alpha', sourcePaths: ['skello-app/app/models/shift.rb'] }],
    areas: [{
      id: 'scheduling',
      name: 'Scheduling',
      description: 'Fictitious scheduling area',
      kind: 'product',
      color: '#336699',
      codeLocations: [{ repo: 'skello-app', platform: 'monolith', globs: ['app/models/**'] }],
      readingPath: [],
      glossary: [],
    }],
    teams: [{ id: 'squad-alpha', name: 'Squad Alpha', githubTeams: ['@skelloapp/squad-alpha'] }],
  }),
  resources: ResourceSurfaceSchema.parse({ resources: [], relations: [] }),
  committedListeners: null,
}
