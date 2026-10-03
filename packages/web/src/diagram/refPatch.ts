import { EDGE_LIST_SEP, pagePatch, type UrlState } from '../hooks/useUrlState'
import type { DiagramRef } from './model'

export function refPatch(ref: DiagramRef): Partial<UrlState> {
  switch (ref.type) {
    case 'service':
      return { drawer: ref.name, ep: null, edge: null }
    case 'area':
      return { area: ref.id, drawer: null, ep: null, edge: null }
    case 'resource':
      return { ...pagePatch('resources'), resource: ref.id }
    case 'connections':
      return { edge: ref.keys.join(EDGE_LIST_SEP), drawer: null, ep: null }
    case 'unit':
      return { unit: ref.id }
  }
}

const PANEL_ONLY = new Set<DiagramRef['type']>(['unit', 'service', 'connections'])

export function selectPatch(ref: DiagramRef, present: boolean): Partial<UrlState> | null {
  return present && PANEL_ONLY.has(ref.type) ? null : refPatch(ref)
}
