import { ConnectivityMapSchema, ProductAreaSchema } from '@dependency-explorer/data'

const service = (name: string, type: string, extra: object = {}) => ({ name, type, description: name, endpoints: [], ...extra })
const connection = (from: string, to: string, protocol: string, usedEndpoints: string[] = []) => ({
  from, to, sdkPackage: `${to}-sdk`, description: `${from} calls ${to}`, usedEndpoints, communicationType: 'sync', protocol, authType: 'internal',
})
const endpoint = (id: string, method: string, path: string, extra: object = {}) => ({
  id, method, path, description: `${method} ${path}`, useCase: id, params: [], response: {}, ...extra,
})
const area = (id: string, name: string, kind: 'product' | 'platform', repo: string) => ({
  id, name, description: name, kind, color: '#336699', codeLocations: [{ repo, platform: 'backend', globs: ['**'] }], readingPath: [], glossary: [],
})

export const planningArea = ProductAreaSchema.parse(area('planning', 'Planning', 'product', 'svc-shifts'))

export const fixtureMap = ConnectivityMapSchema.parse({
  services: [
    service('skello-app', 'rails-monolith'),
    service('svc-shifts', 'typescript-microservice'),
    service('svc-search', 'typescript-microservice'),
    service('svc-punch', 'typescript-microservice', {
      teamId: 'team-cheese',
      endpoints: [
        endpoint('punch-clock-in', 'POST', '/v1/punches', { provenance: { source: 'discovered', lastVerified: '2026-11-01', evidence: 'src/handlers.ts' } }),
        endpoint('punch-list', 'GET', '/v1/shops/{shopId}/punches'),
      ],
    }),
  ],
  connections: [
    connection('skello-app', 'svc-punch', 'rest', ['punch-clock-in']),
    connection('svc-punch', 'svc-shifts', 'rest'),
    connection('svc-search', 'skello-app', 'cdc'),
    connection('svc-shifts', 'skello-app', 'cdc'),
  ],
  flows: [],
  teams: [{ id: 'team-anchovy', name: 'Team Anchovy' }, { id: 'team-cheese', name: 'Team Cheese' }],
  areas: [
    planningArea,
    area('time-attendance', 'Time & Attendance', 'product', 'svc-punch'),
    area('onboarding', 'Onboarding', 'product', 'svc-onboarding'),
    area('events', 'Events', 'platform', 'svc-events'),
  ],
  externals: [{ id: 'sentry', name: 'Sentry', description: 'Error tracking', category: 'other', usedBy: [{ service: 'skello-app', evidence: { kind: 'gem', literal: 'sentry-ruby' } }] }],
})
