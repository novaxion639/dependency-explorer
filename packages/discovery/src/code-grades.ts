import * as path from 'node:path'

export type Grade = 'graph' | 'constant' | 'import' | 'text' | 'none'

export interface RepoGraph {
  builtAt: string
  fileEdges: Map<string, Set<string>>
  classesIn: Map<string, string[]>
}

const STRUCTURAL = new Set(['calls', 'references', 'method', 'contains', 'inherits', 'mixes_in'])
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
  for (const l of graphJson.links) {
    if (!isRecord(l) || l.confidence !== 'EXTRACTED' || !STRUCTURAL.has(str(l.relation))) {
      continue
    }
    const a = fileOf.get(str(l.source)) ?? ''
    const b = fileOf.get(str(l.target)) ?? ''
    if (a && b && a !== b) {
      fileEdges.set(a, new Set([...(fileEdges.get(a) ?? []), b]))
    }
  }
  return { builtAt: str(graphJson.built_at_commit), fileEdges, classesIn }
}

export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"\\])\/\/.*$/gm, '$1')
    .replace(/(^|\s)#(?![{!]).*$/gm, '$1')
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function reachable(graph: RepoGraph, from: string, to: string): boolean {
  const first = graph.fileEdges.get(from) ?? new Set<string>()
  return first.has(to) || [...first].some(mid => graph.fileEdges.get(mid)?.has(to) ?? false)
}

function namesDeclared(source: string, declared: string[]): boolean {
  return declared.some(c => {
    const last = c.split('::').pop() ?? c
    return new RegExp(`\\b${escape(c)}\\b`).test(source) || (last.length > LAST_SEGMENT_MIN && new RegExp(`\\b${escape(last)}\\b`).test(source))
  })
}

function importsFile(source: string, calleePath: string): boolean {
  const stem = path.posix.basename(calleePath).replace(/\.[^.]+$/, '')
  return new RegExp(`(?:from|require\\(|import\\()\\s*['"][^'"]*\\b${escape(stem)}(?:\\.[a-z]+)?['"]`).test(source)
}

function longestToken(label: string): string | null {
  const tokens = label.replace(/#\w+.*$/, '').match(/[A-Z][A-Za-z0-9_]*(?:::[A-Z][A-Za-z0-9_]*)*/g) ?? []
  return tokens.reduce<string | null>((a, b) => (a && a.length >= b.length ? a : b), null)
}

export function gradeEdge(graph: RepoGraph, callerPath: string, calleePath: string, callerSource: string, calleeLabel: string): Grade {
  if (reachable(graph, callerPath, calleePath)) {
    return 'graph'
  }
  const code = stripComments(callerSource)
  if (namesDeclared(code, graph.classesIn.get(calleePath) ?? [])) {
    return 'constant'
  }
  if (importsFile(code, calleePath)) {
    return 'import'
  }
  const token = longestToken(calleeLabel)
  return token && new RegExp(`\\b${escape(token)}\\b`).test(code) ? 'text' : 'none'
}
