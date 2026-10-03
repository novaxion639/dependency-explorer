import { pagePatch, type UrlState } from '../hooks/useUrlState'

export const HOME_TILES: Array<{ title: string; blurb: string; patch: Partial<UrlState> }> = [
  { title: 'The monolith', blurb: 'skello-app by product area — what lives where', patch: pagePatch('monolith') },
  { title: 'The microservices', blurb: 'Every service, grouped by area and how they talk', patch: pagePatch('microservices') },
  { title: 'Key flows', blurb: 'Curated reading paths, one per area', patch: pagePatch('flows') },
  { title: 'Change impact', blurb: "I'm changing a table, a queue or a service", patch: pagePatch('impact') },
]

export const EXAMPLES = ['who writes shifts', 'svc-punch', 'svc-requests', 'shift creation']
