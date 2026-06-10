/**
 * Flow verification — checks the 23 curated business flows against the
 * reconciled dataset (map-internal consistency, no repo scanning):
 *
 *  1. Every service-to-service step should correspond to a connection in the
 *     map. A step in the REVERSE direction of a known connection is a
 *     response arrow (the authoring guide mandates explicit request/response
 *     pairs) and is fine. Anything else is flagged: either the flow is stale
 *     or the connections table is missing an edge.
 *  2. HTTP "METHOD /path" fragments inside step actions are matched against
 *     the target service's (code-verified) endpoints — catches paths that
 *     drifted, e.g. after the endpoint scaffold.
 *
 * sfn-* nodes are internal Step Functions steps; "service (qualifier)" nodes
 * resolve to their base service (authoring guide §2.1).
 */

import type { ConnectivityMap } from '@dependency-explorer/schema'
import { normalizeEndpoint, normalizeEndpointVersionless } from './endpoints'

export interface FlowFinding {
  flow: string
  kind: 'no-connection' | 'unknown-endpoint-path'
  detail: string
}

export interface FlowCheckResult {
  findings: FlowFinding[]
  stepsChecked: number
  responseSteps: number
  pathsChecked: number
}

const PATH_FRAGMENT_RE = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s,—()]+)/g

function stepBase(name: string, serviceNames: Set<string>): string | null {
  if (serviceNames.has(name)) return name
  if (name.startsWith('sfn-')) return null
  const base = name.replace(/ \([^)]*\)$/, '')
  if (serviceNames.has(base)) return base
  return null // sfn qualifier variants and other internal nodes
}

export function checkFlows(map: ConnectivityMap): FlowCheckResult {
  const serviceNames = new Set(map.services.map(s => s.name))
  const connectionKeys = new Set(map.connections.map(c => `${c.from}→${c.to}`))
  const endpointsByService = new Map(map.services.map(s => [
    s.name,
    {
      exact: new Set(s.endpoints.map(e => normalizeEndpoint(e.method, e.path))),
      versionless: new Set(s.endpoints.map(e => normalizeEndpointVersionless(e.method, e.path))),
      count: s.endpoints.length,
    },
  ]))

  const result: FlowCheckResult = { findings: [], stepsChecked: 0, responseSteps: 0, pathsChecked: 0 }

  for (const flow of map.flows) {
    for (const step of flow.steps) {
      const from = stepBase(step.from, serviceNames)
      const to = stepBase(step.to, serviceNames)

      // 1. connection existence (service-to-service steps only)
      if (from && to && from !== to) {
        result.stepsChecked++
        if (connectionKeys.has(`${from}→${to}`)) {
          // direct connection — fine
        } else if (connectionKeys.has(`${to}→${from}`)) {
          result.responseSteps++ // response arrow of a known connection
        } else {
          result.findings.push({
            flow: flow.id,
            kind: 'no-connection',
            detail: `step "${step.from} → ${step.to}" has no matching connection (either direction) — action: ${step.action.slice(0, 90)}`,
          })
        }
      }

      // 2. endpoint path fragments in the action, verified against the callee
      //    (skip response arrows: the path there belongs to the caller's API)
      const callee = to && (!from || !connectionKeys.has(`${to}→${from}`)) ? to : null
      if (!callee) continue
      const eps = endpointsByService.get(callee)
      if (!eps || eps.count === 0) continue // nothing to verify against (e.g. monolith)
      for (const m of step.action.matchAll(PATH_FRAGMENT_RE)) {
        result.pathsChecked++
        const ok = eps.exact.has(normalizeEndpoint(m[1]!, m[2]!))
          || eps.versionless.has(normalizeEndpointVersionless(m[1]!, m[2]!))
        if (!ok) {
          result.findings.push({
            flow: flow.id,
            kind: 'unknown-endpoint-path',
            detail: `"${m[1]} ${m[2]}" not found on ${callee} (step "${step.from} → ${step.to}")`,
          })
        }
      }
    }
  }

  return result
}
