import { connectivityMap, resourceSurface } from '@dependency-explorer/data'
import { pagePatch, type UrlState } from '../hooks/useUrlState'

export interface Crumb { label: string; patch: Partial<UrlState> | null }

const flowName = new Map(connectivityMap.flows.map(f => [f.id, f.name]))
const areaName = new Map((connectivityMap.areas ?? []).map(a => [a.id, a.name]))
const teamName = new Map((connectivityMap.teams ?? []).map(t => [t.id, t.name]))
const resourceName = new Map(resourceSurface.resources.map(r => [r.id, r.name]))

function linkAllButLast(crumbs: Array<{ label: string; patch: Partial<UrlState> }>): Crumb[] {
  return crumbs.map((c, i) => (i === crumbs.length - 1 ? { label: c.label, patch: null } : c))
}

export function breadcrumb(st: UrlState): Crumb[] {
  const root = (label: string, page: UrlState['page']) => ({ label, patch: pagePatch(page) })
  switch (st.page) {
    case 'home':
      return []
    case 'areas':
      return linkAllButLast([
        root('Product areas', 'areas'),
        ...(st.area ? [{ label: areaName.get(st.area) ?? st.area, patch: { ...pagePatch('areas'), area: st.area } }] : []),
        ...(st.term ? [{ label: st.term, patch: {} }] : []),
      ])
    case 'microservices':
      return linkAllButLast([
        root('Architecture', 'microservices'),
        root('Microservices', 'microservices'),
        ...(st.s ? [{ label: st.s, patch: {} }] : []),
      ])
    case 'monolith':
      return linkAllButLast([
        root('Architecture', 'microservices'),
        root('Monolith', 'monolith'),
        ...(st.s ? [{ label: 'Connections', patch: {} }] : []),
      ])
    case 'flows':
      return linkAllButLast([
        root('Flows', 'flows'),
        ...(st.flow ? [{ label: flowName.get(st.flow) ?? st.flow, patch: {} }] : []),
        ...(st.file ? [{ label: st.file, patch: {} }] : []),
        ...(st.flag ? [{ label: st.flag, patch: {} }] : []),
        ...(st.flows && !st.flow ? [{ label: st.flows, patch: {} }] : []),
      ])
    case 'resources':
      return linkAllButLast([
        root('Resources', 'resources'),
        ...(st.resource ? [{ label: resourceName.get(st.resource) ?? st.resource, patch: {} }] : []),
      ])
    case 'impact':
      return linkAllButLast([root('Impact', 'impact'), ...(st.blast ? [{ label: st.blast, patch: {} }] : [])])
    case 'ownership':
      return linkAllButLast([root('Ownership', 'ownership'), ...(st.team ? [{ label: teamName.get(st.team) ?? st.team, patch: {} }] : [])])
  }
}
