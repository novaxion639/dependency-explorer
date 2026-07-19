import { describe, it, expect } from 'vitest'
import { DiscoveredOverlaySchema } from '@dependency-explorer/schema'
import { connectivityMap } from './index'
import discoveredJson from './generated/discovered.json'

const { services, connections, flows, teams, domains, rules } = connectivityMap

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

describe('domains', () => {
  it('have unique ids', () => {
    const ids = (domains ?? []).map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only reference existing services', () => {
    for (const domain of domains ?? []) {
      for (const name of domain.serviceNames) {
        expect(serviceNames.has(name), `domain ${domain.id} → unknown service ${name}`).toBe(true)
      }
    }
  })

  it('cover every service in at least one domain', () => {
    const covered = new Set((domains ?? []).flatMap(d => d.serviceNames))
    for (const svc of services) {
      expect(covered.has(svc.name), `service ${svc.name} belongs to no domain`).toBe(true)
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
})
