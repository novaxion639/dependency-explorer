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

import * as fs from 'node:fs'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
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

// ── Code-layer verification (flows with codeUnits/codeEdges) ─────────────────
// The code layer is human-authored but cannot silently drift:
//  1. every codeUnit.path must exist in the checked-out repo (repo dir = service name)
//  2. every unit→unit codeEdge's callee constant must be referenced from the
//     caller's file (longest Constant-like token of the callee label)
//  3. every codeEdge endpoint must resolve to a unit, a service, or an infra node

export interface CodeLayerFinding {
  flow: string
  kind: 'missing-code-path' | 'unreferenced-callee' | 'unknown-code-edge-endpoint' | 'unknown-unit-service'
  detail: string
}

export interface CodeLayerCheckResult {
  findings: CodeLayerFinding[]
  flowsWithCodeLayer: number
  pathsVerified: number
  edgesVerified: number
  /** services whose repo is not checked out — their paths/edges are skipped, not failed */
  skippedRepos: string[]
}

/** Longest Constant-like token of a label — "V3::Shifts::CreateService", or "Shift" from "Shift callbacks (…)". */
function calleeToken(label: string): string | null {
  const base = label.replace(/#\w+.*$/, '') // strip "#create" action suffixes
  const tokens = base.match(/[A-Z][A-Za-z0-9_]*(?:::[A-Z][A-Za-z0-9_]*)*/g) ?? []
  if (!tokens.length) return null
  return tokens.reduce((a, b) => (b.length > a.length ? b : a))
}

export function checkFlowCodeLayers(map: ConnectivityMap, repoBase: string): CodeLayerCheckResult {
  const serviceNames = new Set(map.services.map(s => s.name))
  const result: CodeLayerCheckResult = {
    findings: [], flowsWithCodeLayer: 0, pathsVerified: 0, edgesVerified: 0, skippedRepos: [],
  }
  const skipped = new Set<string>()
  const fileCache = new Map<string, string | null>()
  const readUnitFile = (service: string, relPath: string): string | null => {
    const key = `${service}:${relPath}`
    if (!fileCache.has(key)) {
      try {
        fileCache.set(key, fs.readFileSync(path.join(repoBase, service, relPath), 'utf-8'))
      } catch {
        fileCache.set(key, null)
      }
    }
    return fileCache.get(key)!
  }

  for (const flow of map.flows) {
    const units = flow.codeUnits ?? []
    if (!units.length) continue
    result.flowsWithCodeLayer++
    const unitById = new Map(units.map(u => [u.id, u]))
    const infraIds = new Set((flow.infraNodes ?? []).map(n => n.id))

    for (const unit of units) {
      if (!serviceNames.has(unit.service)) {
        result.findings.push({
          flow: flow.id, kind: 'unknown-unit-service',
          detail: `codeUnit ${unit.id} declares service "${unit.service}" which is not in the map`,
        })
        continue
      }
      if (!unit.path) continue
      if (!fs.existsSync(path.join(repoBase, unit.service))) {
        skipped.add(unit.service)
        continue
      }
      if (fs.existsSync(path.join(repoBase, unit.service, unit.path))) {
        result.pathsVerified++
      } else {
        result.findings.push({
          flow: flow.id, kind: 'missing-code-path',
          detail: `codeUnit ${unit.id} (${unit.label}): ${unit.service}/${unit.path} does not exist`,
        })
      }
    }

    for (const edge of flow.codeEdges ?? []) {
      for (const end of [edge.from, edge.to]) {
        if (!unitById.has(end) && !serviceNames.has(end) && !infraIds.has(end)) {
          result.findings.push({
            flow: flow.id, kind: 'unknown-code-edge-endpoint',
            detail: `codeEdge "${edge.from} → ${edge.to}": "${end}" is neither a code unit, a service, nor an infra node`,
          })
        }
      }

      const fromUnit = unitById.get(edge.from)
      const toUnit = unitById.get(edge.to)
      if (!fromUnit?.path || !toUnit) continue
      if (skipped.has(fromUnit.service) || !serviceNames.has(fromUnit.service)) continue
      const token = calleeToken(toUnit.label)
      if (!token) continue
      const content = readUnitFile(fromUnit.service, fromUnit.path)
      if (content === null) continue // missing path already reported above
      if (content.includes(token)) {
        result.edgesVerified++
      } else {
        result.findings.push({
          flow: flow.id, kind: 'unreferenced-callee',
          detail: `codeEdge "${edge.from} → ${edge.to}": "${token}" not referenced in ${fromUnit.service}/${fromUnit.path}`,
        })
      }
    }
  }

  result.skippedRepos = [...skipped].sort()
  return result
}

// ── Feature-flag verification (🚩) ───────────────────────────────────────────
// Typed flag refs cannot silently point at flags the code no longer checks:
// a flag on a code UNIT must appear literally in that unit's source; a flag
// on a code EDGE must appear in the caller's or the callee's source (the FF
// wrap can live on either side of the call). Kind stays authored — it is a
// call-site property (can_access? vs dev_flag_activated?), not a name rule.

export interface FlagCheckFinding {
  flow: string
  kind: 'flag-not-in-source'
  detail: string
}

export interface FlagCheckResult {
  findings: FlagCheckFinding[]
  refsChecked: number
  refsVerified: number
  distinctFlags: number
  /** repos not checked out — their refs are skipped, not failed */
  skippedRepos: string[]
}

export function checkFeatureFlags(map: ConnectivityMap, repoBase: string): FlagCheckResult {
  const result: FlagCheckResult = { findings: [], refsChecked: 0, refsVerified: 0, distinctFlags: 0, skippedRepos: [] }
  const skipped = new Set<string>()
  const distinct = new Set<string>()
  const readFile = (service: string, relPath: string): string | null => {
    try {
      return fs.readFileSync(path.join(repoBase, service, relPath), 'utf-8')
    } catch {
      return null
    }
  }
  const repoMissing = (service: string): boolean => {
    if (fs.existsSync(path.join(repoBase, service))) return false
    skipped.add(service)
    return true
  }

  for (const flow of map.flows) {
    const unitById = new Map((flow.codeUnits ?? []).map(u => [u.id, u]))

    for (const unit of flow.codeUnits ?? []) {
      for (const flag of unit.flags ?? []) {
        distinct.add(flag.name)
        if (!unit.path || repoMissing(unit.service)) continue
        result.refsChecked++
        const content = readFile(unit.service, unit.path)
        if (content?.includes(flag.name)) {
          result.refsVerified++
        } else {
          result.findings.push({
            flow: flow.id, kind: 'flag-not-in-source',
            detail: `unit ${unit.id}: "${flag.name}" not in ${unit.service}/${unit.path}`,
          })
        }
      }
    }

    for (const edge of flow.codeEdges ?? []) {
      for (const flag of edge.flags ?? []) {
        distinct.add(flag.name)
        const candidates = [edge.from, edge.to]
          .map(id => unitById.get(id))
          .filter((u): u is NonNullable<typeof u> => !!u?.path && !repoMissing(u.service))
        if (!candidates.length) continue
        result.refsChecked++
        const hit = candidates.some(u => readFile(u.service, u.path!)?.includes(flag.name))
        if (hit) {
          result.refsVerified++
        } else {
          result.findings.push({
            flow: flow.id, kind: 'flag-not-in-source',
            detail: `edge "${edge.from} → ${edge.to}": "${flag.name}" in neither ${candidates.map(u => `${u.service}/${u.path}`).join(' nor ')}`,
          })
        }
      }
    }
  }

  result.distinctFlags = distinct.size
  result.skippedRepos = [...skipped].sort()
  return result
}

// ── Domain-rule verification (📐) ────────────────────────────────────────────
// Rule statements are human-owned meaning; what the scanner CAN verify:
//  1. every sourcePath ("<repo>/<path>") still exists in the sibling checkouts
//  2. every sourceHash stamp still matches the file's sha256 — a mismatch
//     means the source changed since the rule was authored, so the statement
//     needs a human re-review (and a re-stamp with the printed hash)

export interface RuleCheckFinding {
  rule: string
  kind: 'missing-rule-source' | 'rule-source-drift'
  detail: string
}

export interface RuleCheckResult {
  findings: RuleCheckFinding[]
  rulesChecked: number
  pathsVerified: number
  hashesVerified: number
  /** repos not checked out — their paths are skipped, not failed */
  skippedRepos: string[]
}

export function checkDomainRules(map: ConnectivityMap, repoBase: string): RuleCheckResult {
  const result: RuleCheckResult = { findings: [], rulesChecked: 0, pathsVerified: 0, hashesVerified: 0, skippedRepos: [] }
  const skipped = new Set<string>()
  for (const rule of map.rules ?? []) {
    result.rulesChecked++
    const stampByPath = new Map((rule.sourceHashes ?? []).map(h => [h.path, h.sha256]))
    for (const sourcePath of rule.sourcePaths) {
      const [repo, ...rest] = sourcePath.split('/')
      if (!repo || !rest.length) {
        result.findings.push({
          rule: rule.id, kind: 'missing-rule-source',
          detail: `sourcePath "${sourcePath}" is not "<repo>/<path>"-shaped`,
        })
        continue
      }
      if (!fs.existsSync(path.join(repoBase, repo))) {
        skipped.add(repo)
        continue
      }
      if (!fs.existsSync(path.join(repoBase, sourcePath))) {
        result.findings.push({
          rule: rule.id, kind: 'missing-rule-source',
          detail: `${sourcePath} does not exist`,
        })
        continue
      }
      result.pathsVerified++

      const stamp = stampByPath.get(sourcePath)
      if (!stamp) continue // unstamped path — integrity tests enforce stamp completeness
      const actual = createHash('sha256')
        .update(fs.readFileSync(path.join(repoBase, sourcePath)))
        .digest('hex')
      if (actual === stamp) {
        result.hashesVerified++
      } else {
        result.findings.push({
          rule: rule.id, kind: 'rule-source-drift',
          detail: `needs re-review — ${sourcePath} changed since authoring (re-stamp with sha256 ${actual})`,
        })
      }
    }
  }
  result.skippedRepos = [...skipped].sort()
  return result
}

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
