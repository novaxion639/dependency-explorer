import type { UrlState } from '../hooks/useUrlState'

export const HOME_TILES: Array<{ title: string; blurb: string; patch: Partial<UrlState> }> = [
  { title: 'The monolith', blurb: 'skello-app by product area — what lives where', patch: { page: 'monolith' } },
  { title: 'The microservices', blurb: 'Every service, grouped by area and how they talk', patch: { page: 'microservices', s: null } },
  { title: 'Key flows', blurb: 'Curated reading paths, one per area', patch: { page: 'flows', flows: null } },
  { title: 'Change impact', blurb: "I'm changing a table, a queue or a service", patch: { page: 'impact', blast: null } },
]

export const EXAMPLES = ['who writes shifts', 'svc-punch', 'svc-requests', 'shift creation']
