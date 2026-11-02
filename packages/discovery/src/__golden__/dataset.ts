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
        steps: [{ from: 'svc-alpha', to: 'svc-beta', action: 'creates a job' }],
        codeUnits: [
          { id: 'alpha-config', service: 'svc-alpha', kind: 'service', label: 'svc-alpha serverless config', path: 'serverless.ts' },
          { id: 'shift-model', service: 'skello-app', kind: 'model-callback', label: 'Shift', path: 'app/models/shift.rb' },
        ],
      },
    ],
    teams: [{ id: 'squad-alpha', name: 'Squad Alpha', githubTeams: ['@skelloapp/squad-alpha'] }],
  }),
  resources: ResourceSurfaceSchema.parse({ resources: [], relations: [] }),
  committedListeners: null,
}
