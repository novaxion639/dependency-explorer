import * as path from 'node:path'

export type Alias = { prefix: string; dir: string }
export type Read = (repoPath: string) => string | null

export interface WiredEdge {
  callerPath: string
  calleePath: string
  callerCode: string
  calleeSource: string
  callerClasses: string[]
  calleeClasses: string[]
}

const DECLARATION = /^(?:export\s+)?const\s+(\w+)[^=\n]*=\s*/gm
const NEW_CLASS = /\bnew\s+([A-Z]\w*)/g
const CONSTRUCTED = /^new\s+([A-Z]\w*)/
const IDENTIFIER = /\b[A-Za-z_$][\w$]*\b/g
const NOT_INJECTABLE = new Set(['Map', 'Set', 'Array', 'Object', 'Date', 'Promise', 'URL', 'Error'])

function statementEnd(source: string, from: number, limit: number): number {
  let depth = 0
  for (let i = from; i < limit; i++) {
    const ch = source[i]
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--
    } else if (ch === ';' && depth === 0) {
      return i
    }
  }
  return limit
}

function newClasses(code: string): string[] {
  return [...code.matchAll(NEW_CLASS)].map(m => m[1] ?? '').filter(c => !NOT_INJECTABLE.has(c))
}

function constructedClass(init: string): string | null {
  const head = CONSTRUCTED.exec(init)?.[1]
  return head && !NOT_INJECTABLE.has(head) ? head : null
}

export function parseInjections(source: string): Map<string, Set<string>> {
  const starts = [...source.matchAll(DECLARATION)]
  const decls = new Map(starts.map((m, i) => {
    const from = (m.index ?? 0) + m[0].length
    return [m[1] ?? '', source.slice(from, statementEnd(source, from, starts[i + 1]?.index ?? source.length))]
  }))
  const refsIn = (code: string, self: string) => [...new Set(code.match(IDENTIFIER) ?? [])].filter(id => id !== self && decls.has(id))
  const holds = (name: string, seen: Set<string>): string[] => {
    const init = decls.get(name)
    if (init === undefined || seen.has(name)) {
      return []
    }
    const ctor = constructedClass(init)
    return ctor ? [ctor] : [...newClasses(init), ...refsIn(init, name).flatMap(r => holds(r, new Set([...seen, name])))]
  }
  const out = new Map<string, Set<string>>()
  for (const [name, init] of decls) {
    const ctor = constructedClass(init)
    if (!ctor) {
      continue
    }
    const args = init.replace(CONSTRUCTED, '')
    const injected = [...newClasses(args), ...refsIn(args, name).flatMap(r => holds(r, new Set([name])))]
    out.set(ctor, new Set([...(out.get(ctor) ?? []), ...injected]))
  }
  return out
}

export function injectionReach(injects: Map<string, Set<string>>, from: string[], to: string[]): boolean {
  const targets = new Set(to)
  const firstHop = from.flatMap(c => [...(injects.get(c) ?? [])])
  return firstHop.some(c => targets.has(c) || [...(injects.get(c) ?? [])].some(d => targets.has(d)))
}

const VITE_ALIAS = /['"](@[\w-]+)['"]\s*:\s*fileURLToPath\(\s*new URL\(\s*['"]\.\/([^'"]*)['"]/g
const IMPORT_FROM = /(?:\bfrom|\bimport|\brequire\()\s*['"]([^'"]+)['"]/g
const NAMED_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
const NAMED_REEXPORT = /export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
const RESOLVE_SUFFIXES = ['', '.js', '.ts', '.tsx', '.vue', '.mjs', '/index.js', '/index.ts']
const BARREL_SUFFIXES = ['/index.js', '/index.ts']

export function parseViteAliases(source: string, configDir: string): Alias[] {
  return [...source.matchAll(VITE_ALIAS)].map(m => ({ prefix: m[1] ?? '', dir: path.posix.join(configDir, m[2] ?? '').replace(/\/$/, '') }))
}

export function resolveSpecifier(spec: string, fromPath: string, aliases: Alias[]): string | null {
  if (spec.startsWith('./') || spec.startsWith('../')) {
    return path.posix.join(path.posix.dirname(fromPath), spec)
  }
  const alias = aliases.filter(a => spec === a.prefix || spec.startsWith(`${a.prefix}/`)).sort((a, b) => b.prefix.length - a.prefix.length)[0]
  return alias ? path.posix.join(alias.dir, spec.slice(alias.prefix.length)) : null
}

export function resolvesTo(base: string, file: string): boolean {
  return RESOLVE_SUFFIXES.some(s => `${base}${s}` === file)
}

function importedNames(list: string): string[] {
  return list.split(',').map(n => n.trim().split(/\s+as\s+/)[0]?.trim() ?? '').filter(Boolean)
}

function exportedNames(list: string): string[] {
  return list.split(',').map(n => n.trim().split(/\s+as\s+/).pop()?.trim() ?? '').filter(Boolean)
}

function importsFileDirectly(code: string, fromPath: string, target: string, aliases: Alias[]): boolean {
  return [...code.matchAll(IMPORT_FROM)].some(m => {
    const base = resolveSpecifier(m[1] ?? '', fromPath, aliases)
    return base !== null && resolvesTo(base, target)
  })
}

export function importsCallee(e: WiredEdge, aliases: Alias[], read: Read): boolean {
  if (importsFileDirectly(e.callerCode, e.callerPath, e.calleePath, aliases)) {
    return true
  }
  return [...e.callerCode.matchAll(NAMED_IMPORT)].some(m => {
    const base = resolveSpecifier(m[2] ?? '', e.callerPath, aliases)
    const barrelPath = base === null ? undefined : BARREL_SUFFIXES.map(s => `${base}${s}`).find(p => read(p) !== null)
    const barrel = barrelPath === undefined ? null : read(barrelPath)
    if (barrelPath === undefined || barrel === null) {
      return false
    }
    const wanted = new Set(importedNames(m[1] ?? ''))
    return [...barrel.matchAll(NAMED_REEXPORT)].some(r => {
      const target = resolveSpecifier(r[2] ?? '', barrelPath, aliases)
      return target !== null && resolvesTo(target, e.calleePath) && exportedNames(r[1] ?? '').some(n => wanted.has(n))
    })
  })
}
