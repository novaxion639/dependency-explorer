import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ConnectivityMap } from '@dependency-explorer/schema'
import { importedFiles, loadWiring, readerFor, wiredGrade, type Wiring } from './code-wiring'
import { routeGrade, type RouteRef } from './route-grades'

export type Grade = 'graph' | 'constant' | 'import' | 'text' | 'none'

export interface RepoGraph {
  builtAt: string
  fileEdges: Map<string, Set<string>>
  importEdges: Map<string, Set<string>>
  classesIn: Map<string, string[]>
}

const STRUCTURAL = new Set(['calls', 'references', 'method', 'contains', 'inherits', 'mixes_in'])
const IMPORTS = new Set(['imports', 'imports_from', 're_exports'])
const LAST_SEGMENT_MIN = 8

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function loadRepoGraph(graphJson: unknown): RepoGraph | null {
  if (!isRecord(graphJson) || !Array.isArray(graphJson.nodes) || !Array.isArray(graphJson.links)) {
    return null
  }
  const fileOf = new Map<string, string>()
  const classesIn = new Map<string, string[]>()
  for (const n of graphJson.nodes) {
    if (!isRecord(n)) {
      continue
    }
    const file = str(n.source_file)
    fileOf.set(str(n.id), file)
    if (n._callable_class === true && file) {
      classesIn.set(file, [...(classesIn.get(file) ?? []), str(n.label)])
    }
  }
  const fileEdges = new Map<string, Set<string>>()
  const importEdges = new Map<string, Set<string>>()
  for (const l of graphJson.links) {
    if (!isRecord(l) || l.confidence !== 'EXTRACTED') {
      continue
    }
    const relation = str(l.relation)
    const edges = STRUCTURAL.has(relation) ? fileEdges : IMPORTS.has(relation) ? importEdges : null
    const a = fileOf.get(str(l.source)) ?? ''
    const b = fileOf.get(str(l.target)) ?? ''
    if (edges && a && b && a !== b) {
      edges.set(a, new Set([...(edges.get(a) ?? []), b]))
    }
  }
  return { builtAt: str(graphJson.built_at_commit), fileEdges, importEdges, classesIn }
}

const STRING_OR_COMMENT = /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|(^|[^:\\])\/\/.*$|(^|\s)#(?![{!]).*$/gm

export function stripComments(source: string): string {
  return source.replace(STRING_OR_COMMENT, (_whole, literal: string | undefined, slashLead: string | undefined, hashLead: string | undefined) => literal ?? slashLead ?? hashLead ?? '')
}

export function crossRepoGrade(grade: Grade): Grade {
  return grade === 'none' ? 'none' : 'text'
}

const GRADE_ORDER: Grade[] = ['graph', 'constant', 'import', 'text', 'none']

export function bestGrade(a: Grade, b: Grade | null): Grade {
  return b !== null && GRADE_ORDER.indexOf(b) < GRADE_ORDER.indexOf(a) ? b : a
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function reachable(edges: Map<string, Set<string>>, from: string, to: string): boolean {
  const first = edges.get(from) ?? new Set<string>()
  return first.has(to) || [...first].some(mid => edges.get(mid)?.has(to) ?? false)
}

function stemOf(filePath: string): string {
  return path.posix.basename(filePath).replace(/\.[^.]+$/, '')
}

function namesDeclared(source: string, declared: string[]): boolean {
  return declared.some(c => {
    const last = c.split('::').pop() ?? c
    return new RegExp(`\\b${escape(c)}\\b`).test(source) || (last.length > LAST_SEGMENT_MIN && new RegExp(`\\b${escape(last)}\\b`).test(source))
  })
}

function importsFile(source: string, calleePath: string): boolean {
  const stem = stemOf(calleePath)
  return new RegExp(`(?:from|require\\(|import\\()\\s*['"][^'"]*\\b${escape(stem)}(?:\\.[a-z]+)?['"]`).test(source)
}

function longestToken(label: string): string | null {
  const tokens = label.replace(/#\w+.*$/, '').match(/[A-Z][A-Za-z0-9_]*(?:::[A-Z][A-Za-z0-9_]*)*/g) ?? []
  return tokens.reduce<string | null>((a, b) => (a && a.length >= b.length ? a : b), null)
}

export function gradeEdge(graph: RepoGraph, callerPath: string, calleePath: string, callerSource: string, calleeLabel: string): Grade {
  if (reachable(graph.fileEdges, callerPath, calleePath)) {
    return 'graph'
  }
  const code = stripComments(callerSource)
  if (namesDeclared(code, graph.classesIn.get(calleePath) ?? [])) {
    return 'constant'
  }
  const importedAndUsed = reachable(graph.importEdges, callerPath, calleePath) && new RegExp(`\\b${escape(stemOf(calleePath))}\\b`, 'i').test(code)
  if (importedAndUsed || importsFile(code, calleePath)) {
    return 'import'
  }
  const token = longestToken(calleeLabel)
  return token && new RegExp(`\\b${escape(token)}\\b`).test(code) ? 'text' : 'none'
}


export interface GradeFinding { flow: string; kind: 'ungraded-edge' | 'stale-graph'; subject: string; detail: string }

const MONOLITH = 'skello-app'

export function checkCodeGrades(map: ConnectivityMap, repoBase: string, headOf: (repo: string) => string | null, routes: ReadonlyArray<RouteRef> = []) {
  const findings: GradeFinding[] = []
  const grades: Record<string, Grade> = {}
  const distribution: Record<Grade, number> = { graph: 0, constant: 0, import: 0, text: 0, none: 0 }
  const backlog: string[] = []
  const graphs = new Map<string, RepoGraph | null>()
  const graphFor = (repo: string): RepoGraph | null => {
    if (!graphs.has(repo)) {
      const file = path.join(repoBase, repo, 'graphify-out', 'graph.json')
      const graph = fs.existsSync(file) ? loadRepoGraph(JSON.parse(fs.readFileSync(file, 'utf-8'))) : null
      const head = headOf(repo)
      if (!head) {
        graphs.set(repo, null)
      } else if (graph && graph.builtAt !== head) {
        findings.push({ flow: '', kind: 'stale-graph', subject: repo, detail: `graph stale — run graphify update at ${head}` })
        graphs.set(repo, null)
      } else {
        graphs.set(repo, graph)
      }
    }
    return graphs.get(repo) ?? null
  }
  const wirings = new Map<string, Wiring>()
  const wiringFor = (repo: string): Wiring => {
    const cached = wirings.get(repo)
    if (cached) {
      return cached
    }
    const wiring = loadWiring(path.join(repoBase, repo))
    wirings.set(repo, wiring)
    return wiring
  }
  const record = (key: string, flow: string, grade: Grade, detail: string) => {
    grades[key] = grade
    distribution[grade]++
    if (grade === 'text') {
      backlog.push(`${key} — ${detail}`)
    }
    if (grade === 'none') {
      findings.push({ flow, kind: 'ungraded-edge', subject: key, detail })
    }
  }
  for (const flow of map.flows) {
    const units = new Map((flow.codeUnits ?? []).map(u => [u.id, u]))
    for (const edge of flow.codeEdges ?? []) {
      const from = units.get(edge.from)
      const to = units.get(edge.to)
      if (!from?.path || !to?.path) {
        continue
      }
      const key = `${flow.id}#${edge.from}→${edge.to}`
      const callerFile = path.join(repoBase, from.service, from.path)
      const source = fs.existsSync(callerFile) ? fs.readFileSync(callerFile, 'utf-8') : ''
      if (!headOf(from.service)) {
        continue
      }
      if (from.service !== to.service) {
        const empty: RepoGraph = { builtAt: '', fileEdges: new Map(), importEdges: new Map(), classesIn: new Map() }
        const textGrade = crossRepoGrade(gradeEdge(empty, from.path, to.path, source, to.label))
        const callerCode = stripComments(source)
        const callerRead = readerFor(path.join(repoBase, from.service))
        const sources = [callerCode, ...importedFiles(callerCode, from.path, wiringFor(from.service).aliases, callerRead).map(f => stripComments(callerRead(f) ?? ''))]
        const routed = to.service === MONOLITH ? routeGrade(sources, to.path, routes) : null
        record(key, flow.id, bestGrade(textGrade, routed), `${from.service}/${from.path} → ${to.service}/${to.path} (cross-repo)`)
        continue
      }
      const graph = graphFor(from.service)
      if (!graph) {
        continue
      }
      const repoDir = path.join(repoBase, from.service)
      const read = readerFor(repoDir)
      const base = gradeEdge(graph, from.path, to.path, source, to.label)
      const wired = base === 'graph' ? null : wiredGrade(wiringFor(from.service), {
        callerPath: from.path,
        calleePath: to.path,
        callerCode: stripComments(source),
        calleeSource: read(to.path) ?? '',
        calleeClasses: graph.classesIn.get(to.path) ?? [],
      }, read)
      record(key, flow.id, bestGrade(base, wired), `${from.service}/${from.path} → ${to.path}`)
    }
  }
  return { findings, grades, distribution, backlog }
}
