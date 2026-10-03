import { describe, it, expect } from 'vitest'
import { DiscoveredOverlaySchema } from '@dependency-explorer/schema'
import { connectivityMap, monolithRoutes, codeEdgeGrades, resourceSurface } from './index'
import { resourceNotes } from './resource-notes'
import { skelloAppEndpointNotes } from './services/skello-app.endpoint-notes'
import { getFlowAreas } from './areas-derive'
import { flowRefIds } from './flow-chapters'
import discoveredJson from './generated/discovered.json'

const { services, connections, flows, teams, rules, areas, externals } = connectivityMap

const serviceNames = new Set(services.map(s => s.name))
const teamIds = new Set((teams ?? []).map(t => t.id))

/**
 * Step nodes follow the conventions of docs/flow-authoring-guide.md:
 *   - a service name                       e.g. "svc-shifts"
 *   - an internal Step Functions step      e.g. "sfn-dataFetcher"
 *   - a role-qualified duplicate           e.g. "skello-app (data)"
 */
function isValidStepNode(name: string): boolean {
  if (serviceNames.has(name) || name.startsWith('sfn-')) return true
  const base = name.replace(/ \([^)]*\)$/, '')
  return serviceNames.has(base) || base.startsWith('sfn-')
}

describe('services', () => {
  it('have unique names', () => {
    expect(services.length).toBe(serviceNames.size)
  })

  it('have unique endpoint ids within each service', () => {
    for (const svc of services) {
      const ids = svc.endpoints.map(e => e.id)
      expect(new Set(ids).size, `duplicate endpoint id in ${svc.name}`).toBe(ids.length)
    }
  })

  it('reference existing teams when teamId is set', () => {
    for (const svc of services) {
      if (svc.teamId) {
        expect(teamIds.has(svc.teamId), `${svc.name} → unknown team ${svc.teamId}`).toBe(true)
      }
    }
  })
})

describe('connections', () => {
  it('reference existing services on both ends', () => {
    for (const conn of connections) {
      expect(serviceNames.has(conn.from), `unknown from-service ${conn.from}`).toBe(true)
      expect(serviceNames.has(conn.to), `unknown to-service ${conn.to}`).toBe(true)
    }
  })

  it('have unique from→to:protocol triples (multi-channel pairs are real — e.g. skello-app talks REST and shop-merge SNS to the same service)', () => {
    const triples = connections.map(c => `${c.from}→${c.to}:${c.protocol}`)
    expect(new Set(triples).size).toBe(triples.length)
  })

  it('only use endpoints that exist on the target service', () => {
    const endpointsByService = new Map(
      services.map(s => [s.name, new Set(s.endpoints.map(e => e.id))]),
    )
    for (const conn of connections) {
      const target = endpointsByService.get(conn.to)
      for (const ep of conn.usedEndpoints) {
        expect(target?.has(ep), `${conn.from}→${conn.to} uses unknown endpoint ${ep}`).toBe(true)
      }
    }
  })
})

describe('flows', () => {
  it('have unique ids', () => {
    const ids = flows.map(f => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only reference valid step nodes', () => {
    for (const flow of flows) {
      for (const step of flow.steps) {
        expect(isValidStepNode(step.from), `${flow.id}: unknown step node "${step.from}"`).toBe(true)
        expect(isValidStepNode(step.to), `${flow.id}: unknown step node "${step.to}"`).toBe(true)
      }
    }
  })

  it('have unique infra node ids within each flow', () => {
    for (const flow of flows) {
      const ids = (flow.infraNodes ?? []).map(n => n.id)
      expect(new Set(ids).size, `duplicate infra node id in ${flow.id}`).toBe(ids.length)
    }
  })

  it('connect infra edges to known step nodes or infra nodes of the same flow', () => {
    for (const flow of flows) {
      const stepNodes = new Set(flow.steps.flatMap(s => [s.from, s.to]))
      const infraIds = new Set((flow.infraNodes ?? []).map(n => n.id))
      for (const edge of flow.infraEdges ?? []) {
        const fromOk = stepNodes.has(edge.from) || infraIds.has(edge.from)
        const toOk = stepNodes.has(edge.to) || infraIds.has(edge.to)
        expect(fromOk, `${flow.id}: infra edge from unknown node "${edge.from}"`).toBe(true)
        expect(toOk, `${flow.id}: infra edge to unknown node "${edge.to}"`).toBe(true)
      }
    }
  })
})

describe('rules', () => {
  const ruleIds = new Set((rules ?? []).map(r => r.id))
  const codeUnitIds = new Set(flows.flatMap(f => (f.codeUnits ?? []).map(u => u.id)))

  it('have unique ids', () => {
    expect((rules ?? []).length).toBe(ruleIds.size)
  })

  it('are referenced by steps and code units that resolve', () => {
    for (const flow of flows) {
      const refs = [
        ...flow.steps.flatMap(s => s.ruleRefs ?? []),
        ...(flow.codeUnits ?? []).flatMap(u => u.ruleRefs ?? []),
      ]
      for (const ref of refs) {
        expect(ruleIds.has(ref), `${flow.id} references unknown rule ${ref}`).toBe(true)
      }
    }
  })

  it('are each referenced by at least one flow (no orphan rules)', () => {
    const referenced = new Set(flows.flatMap(f => [
      ...f.steps.flatMap(s => s.ruleRefs ?? []),
      ...(f.codeUnits ?? []).flatMap(u => u.ruleRefs ?? []),
    ]))
    for (const rule of rules ?? []) {
      expect(referenced.has(rule.id), `rule ${rule.id} is referenced by no flow`).toBe(true)
    }
  })

  it('stamp every sourcePath with exactly one sourceHash (and no stray stamps)', () => {
    for (const rule of rules ?? []) {
      const paths = new Set(rule.sourcePaths)
      const stamped = (rule.sourceHashes ?? []).map(h => h.path)
      expect(new Set(stamped).size, `rule ${rule.id}: duplicate sourceHash paths`).toBe(stamped.length)
      for (const p of stamped) {
        expect(paths.has(p), `rule ${rule.id}: sourceHash for unknown path ${p}`).toBe(true)
      }
      for (const p of rule.sourcePaths) {
        expect(new Set(stamped).has(p), `rule ${rule.id}: sourcePath ${p} has no staleness stamp`).toBe(true)
      }
    }
  })

  it('point sourceOfTruth and divergence codeUnitRefs at existing code units', () => {
    for (const rule of rules ?? []) {
      if (rule.sourceOfTruth) {
        expect(codeUnitIds.has(rule.sourceOfTruth), `rule ${rule.id}: unknown sourceOfTruth ${rule.sourceOfTruth}`).toBe(true)
      }
      for (const div of rule.divergences ?? []) {
        if (div.codeUnitRef) {
          expect(codeUnitIds.has(div.codeUnitRef), `rule ${rule.id}: unknown codeUnitRef ${div.codeUnitRef}`).toBe(true)
        }
      }
    }
  })
})

describe('feature-flag refs', () => {
  it('use one consistent kind per flag name across the whole dataset', () => {
    const kinds = new Map<string, string>()
    for (const flow of flows) {
      const refs = [
        ...(flow.codeUnits ?? []).flatMap(u => u.flags ?? []),
        ...(flow.codeEdges ?? []).flatMap(e => e.flags ?? []),
      ]
      for (const ref of refs) {
        const seen = kinds.get(ref.name)
        if (seen) {
          expect(seen, `flag ${ref.name} declared as both "${seen}" and "${ref.kind}"`).toBe(ref.kind)
        } else {
          kinds.set(ref.name, ref.kind)
        }
      }
    }
  })
})

describe('flow links', () => {
  const flowIds = new Set(flows.map(f => f.id))

  it('resolve to existing flows and never self-link', () => {
    for (const flow of flows) {
      for (const link of flow.links ?? []) {
        expect(flowIds.has(link.to), `${flow.id} links to unknown flow ${link.to}`).toBe(true)
        expect(link.to, `${flow.id} links to itself`).not.toBe(flow.id)
      }
    }
  })

  it('author each relationship in one direction only (reverse is derived)', () => {
    const pairs = new Set<string>()
    for (const flow of flows) {
      for (const link of flow.links ?? []) {
        const forward = `${flow.id}→${link.to}`
        const backward = `${link.to}→${flow.id}`
        expect(pairs.has(backward), `both directions authored for ${forward}`).toBe(false)
        pairs.add(forward)
      }
    }
  })
})

describe('auth context', () => {
  it('every flow states its trigger (who can initiate it)', () => {
    for (const flow of flows) {
      expect(flow.trigger?.actor, `flow ${flow.id} has no trigger`).toBeTruthy()
    }
  })

  it('auth refs carry at least one fact (tokenType, gate, authorizer, or authAbsent)', () => {
    for (const flow of flows) {
      for (const edge of flow.codeEdges ?? []) {
        if (edge.auth) {
          const { tokenType, gate, authorizer, authAbsent } = edge.auth
          expect(
            !!(tokenType || gate || authorizer || authAbsent),
            `${flow.id}: empty auth ref on "${edge.from} → ${edge.to}"`,
          ).toBe(true)
        }
      }
    }
  })
})

describe('contract refs', () => {
  it('are "METHOD /path"-shaped and point at svc-* targets', () => {
    for (const flow of flows) {
      for (const edge of flow.codeEdges ?? []) {
        for (const ref of edge.contractRefs ?? []) {
          expect(/^(GET|POST|PUT|PATCH|DELETE) \//.test(ref), `${flow.id}: malformed contractRef "${ref}"`).toBe(true)
          expect(edge.to.startsWith('svc-'), `${flow.id}: contractRef on non-svc target ${edge.to} (the monolith has no generated spec)`).toBe(true)
        }
      }
    }
  })
})

describe('failure layer', () => {
  it('only annotates async edges, never sync ones', () => {
    for (const flow of flows) {
      for (const edge of flow.codeEdges ?? []) {
        if (edge.failure) {
          expect(
            edge.mode === 'async-job' || edge.mode === 'async-event',
            `${flow.id}: failure on non-async edge "${edge.from} → ${edge.to}"`,
          ).toBe(true)
        }
      }
    }
  })

  it('never carries both a dlq fact and a confirmed-missing waiver', () => {
    for (const flow of flows) {
      for (const edge of flow.codeEdges ?? []) {
        if (edge.failure?.dlq && edge.failure?.dlqAbsent) {
          expect.fail(`${flow.id}: edge "${edge.from} → ${edge.to}" claims both a dlq and dlqAbsent`)
        }
      }
    }
  })
})

describe('product areas', () => {
  const list = areas ?? []
  const areaById = new Map(list.map(a => [a.id, a]))
  const flowIds = new Set(flows.map(f => f.id))

  it('exist and have unique ids', () => {
    expect(list.filter(a => a.kind === 'product').length).toBe(14)
    expect(areaById.size).toBe(list.length)
  })

  it('give every product area at least one code location', () => {
    for (const area of list.filter(a => a.kind === 'product')) {
      expect(area.codeLocations.length, `${area.id} has no code location`).toBeGreaterThan(0)
    }
  })

  it('point code locations at existing services with supported wildcards only', () => {
    for (const area of list) {
      for (const loc of area.codeLocations) {
        expect(serviceNames.has(loc.repo), `${area.id} → unknown repo ${loc.repo}`).toBe(true)
        for (const glob of loc.globs) {
          expect(/[{}[\]!]/.test(glob), `${area.id}: unsupported glob syntax in ${glob}`).toBe(false)
        }
      }
    }
  })

  it('keep glossary terms unique within an area', () => {
    for (const area of list) {
      const terms = area.glossary.map(g => g.term.toLowerCase())
      expect(new Set(terms).size, `${area.id} repeats a glossary term`).toBe(terms.length)
    }
  })

  it('resolve reading-path entries to flows, once per area', () => {
    for (const area of list) {
      const ids = area.readingPath.map(r => r.flowId)
      expect(new Set(ids).size, `${area.id} repeats a reading-path flow`).toBe(ids.length)
      for (const id of ids) {
        expect(flowIds.has(id), `${area.id} → unknown flow ${id}`).toBe(true)
      }
    }
  })

  it('resolve owners to teams', () => {
    for (const area of list) {
      for (const owner of area.owners ?? []) {
        expect(teamIds.has(owner), `${area.id} → unknown team ${owner}`).toBe(true)
      }
    }
  })

  it('give every flow a primaryArea among its derived areas', () => {
    for (const flow of flows) {
      const derived = getFlowAreas(flow, list).map(a => a.id)
      const unitPaths = (flow.codeUnits ?? []).map(u => `${u.service}:${u.path ?? '-'}`).join(', ')
      expect(flow.primaryArea, `flow ${flow.id} has no primaryArea`).toBeTruthy()
      expect(areaById.has(flow.primaryArea ?? ''), `flow ${flow.id} → unknown area ${flow.primaryArea}`).toBe(true)
      expect(derived, `flow ${flow.id}: primaryArea ${flow.primaryArea} not derived — unit paths: ${unitPaths}`).toContain(flow.primaryArea)
    }
  })

  it('use a product area as primaryArea whenever the flow touches one', () => {
    for (const flow of flows) {
      const derived = getFlowAreas(flow, list)
      if (derived.some(a => a.kind === 'product')) {
        expect(areaById.get(flow.primaryArea ?? '')?.kind, `flow ${flow.id} primaryArea must be a product area`).toBe('product')
      }
    }
  })
})

describe('external systems', () => {
  const list = externals ?? []

  it('exist and have unique ids', () => {
    expect(list.length).toBeGreaterThan(0)
    expect(new Set(list.map(e => e.id)).size).toBe(list.length)
  })

  it('are used by existing services', () => {
    for (const ext of list) {
      for (const use of ext.usedBy) {
        expect(serviceNames.has(use.service), `${ext.id} → unknown service ${use.service}`).toBe(true)
      }
    }
  })
})

describe('discovered overlay', () => {
  const overlay = DiscoveredOverlaySchema.parse(discoveredJson)

  it('only annotates services that exist in the manual layer', () => {
    for (const name of Object.keys(overlay.services)) {
      expect(serviceNames.has(name), `overlay enriches unknown service ${name}`).toBe(true)
    }
  })

  it('only stamps connections that exist in the manual layer', () => {
    const keys = new Set(connections.map(c => `${c.from}→${c.to}`))
    for (const key of Object.keys(overlay.connections)) {
      expect(keys.has(key), `overlay stamps unknown connection ${key}`).toBe(true)
    }
  })

  it('assigns only known teamIds', () => {
    for (const [name, facts] of Object.entries(overlay.services)) {
      if (facts.teamId) {
        expect(teamIds.has(facts.teamId), `overlay gives ${name} unknown team ${facts.teamId}`).toBe(true)
      }
    }
  })

  it('only stamps endpoints that exist in the manual layer', () => {
    const endpointKeys = new Set(
      services.flatMap(s => s.endpoints.map(e => `${s.name}#${e.id}`)),
    )
    for (const key of Object.keys(overlay.endpoints ?? {})) {
      expect(endpointKeys.has(key), `overlay stamps unknown endpoint ${key}`).toBe(true)
    }
  })

  it('only records area facts for declared areas, globs and services', () => {
    const areaById = new Map((areas ?? []).map(a => [a.id, a]))
    for (const [areaId, files] of Object.entries(overlay.areaFiles ?? {})) {
      const area = areaById.get(areaId)
      expect(area, `overlay area ${areaId} is not declared`).toBeDefined()
      const declared = new Set((area?.codeLocations ?? []).flatMap(l => l.globs.map(g => `${l.repo}:${g}`)))
      for (const key of Object.keys(files)) {
        expect(declared.has(key), `${areaId}: overlay glob ${key} is not declared`).toBe(true)
      }
    }
    for (const repo of Object.keys(overlay.areaCoverage ?? {})) {
      expect(serviceNames.has(repo), `coverage for unknown service ${repo}`).toBe(true)
    }
  })

  it('records area facts once areas exist', () => {
    expect(Object.keys(overlay.areaFiles ?? {}).length).toBe((areas ?? []).length)
  })
})

describe('monolith surface', () => {
  it('has unique route ids', () => {
    const ids = monolithRoutes.map(r => `${r.verb} ${r.path}`)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('only annotates routes that exist', () => {
    const ids = new Set(monolithRoutes.map(r => `${r.verb} ${r.path}`))
    for (const id of Object.keys(skelloAppEndpointNotes)) {
      expect(ids.has(id), `note for unknown route ${id}`).toBe(true)
    }
  })
})

describe('code-edge grades', () => {
  it('grade only declared unit-to-unit code edges', () => {
    const declared = new Set(flows.flatMap(f => (f.codeEdges ?? []).map(e => `${f.id}#${e.from}→${e.to}`)))
    for (const key of Object.keys(codeEdgeGrades)) {
      expect(declared.has(key), `grade for undeclared edge ${key}`).toBe(true)
    }
  })
})
describe('flow branches', () => {
  it('anchor to a code unit of the same flow, with unique ids', () => {
    for (const flow of flows) {
      const units = new Set((flow.codeUnits ?? []).map(u => u.id))
      const ids = (flow.branches ?? []).map(b => b.id)
      expect(new Set(ids).size, `${flow.id} repeats a branch id`).toBe(ids.length)
      for (const b of flow.branches ?? []) {
        expect(units.has(b.at), `${flow.id}: branch ${b.id} anchors to unknown unit ${b.at}`).toBe(true)
      }
    }
  })
  it('exist on the backfilled flows', () => {
    for (const id of ['leave-request-approval', 'shift-creation']) {
      expect(flows.find(f => f.id === id)?.branches?.length, `${id} has no branches`).toBeGreaterThan(0)
    }
  })
})

describe('resource surface', () => {
  const ids = resourceSurface.resources.map(r => r.id)
  it('has unique ids', () => {
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('relations and related tables point at known resources', () => {
    const known = new Set(ids)
    for (const rel of resourceSurface.relations) {
      expect(known.has(rel.resource), `relation on unknown ${rel.resource}`).toBe(true)
      if (rel.target) {
        expect(known.has(rel.target), `relation target unknown ${rel.target}`).toBe(true)
      }
    }
    for (const r of resourceSurface.resources) {
      for (const t of r.related ?? []) {
        expect(known.has(t), `${r.id} relates to unknown ${t}`).toBe(true)
      }
    }
  })
  it('only annotates resources that exist', () => {
    const known = new Set(ids)
    for (const id of Object.keys(resourceNotes)) {
      expect(known.has(id), `note for unknown resource ${id}`).toBe(true)
    }
  })
})

describe('flow infra nodes', () => {
  const known = new Set(resourceSurface.resources.map(r => r.id))
  it('resolve to registry resources, except on-device sqlite queues', () => {
    for (const flow of flows) {
      for (const node of flow.infraNodes ?? []) {
        if (node.type === 'sqlite') {
          continue
        }
        expect(node.resources?.length, `${flow.id}/${node.id} has no resources`).toBeGreaterThan(0)
        for (const id of node.resources ?? []) {
          expect(known.has(id), `${flow.id}/${node.id} → unknown ${id}`).toBe(true)
        }
      }
    }
  })
})

describe('flow chapters', () => {
  const authored = flows.filter(f => f.chapters)
  it('reference only ids of their own flow', () => {
    for (const flow of authored) {
      const ids = flowRefIds(flow)
      for (const c of flow.chapters ?? []) {
        for (const ref of c.refs) {
          expect(ids.has(ref), `${flow.id}: chapter "${c.title}" refs unknown id ${ref}`).toBe(true)
        }
      }
    }
  })
  it('count 3 to 7 chapters with short titles and one-line summaries', () => {
    for (const flow of authored) {
      const chapters = flow.chapters ?? []
      expect(chapters.length, `${flow.id} chapter count`).toBeGreaterThanOrEqual(3)
      expect(chapters.length, `${flow.id} chapter count`).toBeLessThanOrEqual(7)
      for (const c of chapters) {
        expect(c.title.length, `${flow.id}: "${c.title}"`).toBeLessThanOrEqual(40)
        expect(c.summary.length, `${flow.id}: "${c.title}" summary`).toBeLessThanOrEqual(160)
        expect(c.summary, `${flow.id}: "${c.title}" summary`).not.toMatch(/\n/)
      }
    }
  })
  it('cover every code unit and store of the flow', () => {
    for (const flow of authored) {
      const covered = new Set((flow.chapters ?? []).flatMap(c => c.refs))
      for (const id of [...(flow.codeUnits ?? []).map(u => u.id), ...(flow.infraNodes ?? []).map(n => n.id)]) {
        expect(covered.has(id), `${flow.id}: no chapter covers ${id}`).toBe(true)
      }
    }
  })
})
