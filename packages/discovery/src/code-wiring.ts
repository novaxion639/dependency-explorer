import * as fs from 'node:fs'
import * as path from 'node:path'

export type Alias = { prefix: string; dir: string }
export type Read = (repoPath: string) => string | null

export interface WiredEdge {
  callerPath: string
  calleePath: string
  callerCode: string
  calleeSource: string
  calleeClasses: string[]
}

const DECLARATION = /^(?:export\s+)?const\s+(\w+)[^=\n]*=\s*/gm
const NEW_CALL = /\bnew\s+([A-Z]\w*)\s*(?:<[^>()]*>)?\s*\(/g
const IDENTIFIER = /\b[A-Za-z_$][\w$]*\b/g
const NOT_INJECTABLE = new Set(['Map', 'Set', 'Array', 'Object', 'Date', 'Promise', 'URL', 'Error'])

interface Construction { cls: string; args: string; start: number; end: number }

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

function closingParen(code: string, open: number): number {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === '(') {
      depth++
    } else if (code[i] === ')') {
      depth--
      if (depth === 0) {
        return i
      }
    }
  }
  return code.length
}

function outerConstructions(code: string): Construction[] {
  const out: Construction[] = []
  const call = new RegExp(NEW_CALL.source, 'g')
  for (let m = call.exec(code); m !== null; m = call.exec(code)) {
    const open = m.index + m[0].length - 1
    const close = closingParen(code, open)
    out.push({ cls: m[1] ?? '', args: code.slice(open + 1, close), start: m.index, end: close + 1 })
    call.lastIndex = close + 1
  }
  return out
}

function blankSpans(code: string, spans: Construction[]): string {
  return spans.reduceRight((acc, s) => `${acc.slice(0, s.start)}${' '.repeat(s.end - s.start)}${acc.slice(s.end)}`, code)
}

export function parseInjections(source: string, fileOf: (cls: string) => string | null): Map<string, Set<string>> {
  const starts = [...source.matchAll(DECLARATION)]
  const decls = new Map(starts.map((m, i) => {
    const from = (m.index ?? 0) + m[0].length
    return [m[1] ?? '', source.slice(from, statementEnd(source, from, starts[i + 1]?.index ?? source.length))]
  }))
  const out = new Map<string, Set<string>>()
  const refsIn = (code: string, self: string) => [...new Set(code.match(IDENTIFIER) ?? [])].filter(id => id !== self && decls.has(id))
  const provides = (code: string, self: string, seen: Set<string>): string[] => {
    const spans = outerConstructions(code)
    const constructed = spans.flatMap(n => {
      if (NOT_INJECTABLE.has(n.cls)) {
        return provides(n.args, self, seen)
      }
      const file = fileOf(n.cls)
      const deps = provides(n.args, self, seen)
      if (file === null) {
        return []
      }
      out.set(file, new Set([...(out.get(file) ?? []), ...deps]))
      return [file]
    })
    return [...constructed, ...refsIn(blankSpans(code, spans), self).flatMap(r => holds(r, seen))]
  }
  const holds = (name: string, seen: Set<string>): string[] => {
    const init = decls.get(name)
    if (init === undefined || seen.has(name)) {
      return []
    }
    return provides(init, name, new Set([...seen, name]))
  }
  for (const [name, init] of decls) {
    provides(init, name, new Set([name]))
  }
  return out
}

export function injectionReach(injects: Map<string, Set<string>>, from: string[], to: string[]): boolean {
  const targets = new Set(to)
  const firstHop = from.flatMap(c => [...(injects.get(c) ?? [])])
  return firstHop.some(c => targets.has(c) || [...(injects.get(c) ?? [])].some(d => targets.has(d)))
}

const TSCONFIG_PATH = /"((?:~|@[\w-]+))\/\*"\s*:\s*\[\s*"([^"*]*)\*"/g
const DEFAULT_IMPORT = /import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s*from\s*['"]([^'"]+)['"]/g
const VITE_ALIAS = /['"](@[\w-]+)['"]\s*:\s*fileURLToPath\(\s*new URL\(\s*['"]\.\/([^'"]*)['"]/g
const IMPORT_FROM = /(?:\bfrom|\bimport|\brequire\()\s*['"]([^'"]+)['"]/g
const NAMED_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
const NAMED_REEXPORT = /export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
const RESOLVE_SUFFIXES = ['', '.js', '.ts', '.tsx', '.vue', '.mjs', '/index.js', '/index.ts']
const BARREL_SUFFIXES = ['/index.js', '/index.ts']

export function parseViteAliases(source: string, configDir: string): Alias[] {
  return [...source.matchAll(VITE_ALIAS)].map(m => ({ prefix: m[1] ?? '', dir: path.posix.join(configDir, m[2] ?? '').replace(/\/$/, '') }))
}

export function parseTsconfigPaths(source: string, configDir: string): Alias[] {
  return [...source.matchAll(TSCONFIG_PATH)].map(m => ({ prefix: m[1] ?? '', dir: path.posix.join(configDir, m[2] ?? '').replace(/\/$/, '') }))
}

export function readerFor(repoDir: string): Read {
  return rel => {
    const file = path.join(repoDir, rel)
    return fs.statSync(file, { throwIfNoEntry: false })?.isFile() ? fs.readFileSync(file, 'utf-8') : null
  }
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

function boundNames(list: string): string[] {
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
      return target !== null && resolvesTo(target, e.calleePath) && boundNames(r[1] ?? '').some(n => wanted.has(n))
    })
  })
}

const STORE_MODULES = /^(.*\/store\/modules)\//
const MODULE_REGISTRATION = /export\s*\{\s*default\s+as\s+(\w+)\s*\}\s*from\s*['"]([^'"]+)['"]/g
const EMITTED = /\$emit\(\s*['"]([\w:-]+)['"]/g

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function vuexNamespaceOf(calleePath: string, read: Read): string | null {
  const root = STORE_MODULES.exec(calleePath)?.[1]
  const registry = root === undefined ? null : read(`${root}/index.js`)
  if (root === undefined || registry === null) {
    return null
  }
  return [...registry.matchAll(MODULE_REGISTRATION)].find(m => resolvesTo(path.posix.join(root, m[2] ?? ''), calleePath))?.[1] ?? null
}

export function usesVuexNamespace(code: string, ns: string): boolean {
  const n = escape(ns)
  return new RegExp(`\\bmap(?:State|Getters|Actions|Mutations)\\(\\s*['"]${n}['"]|\\b(?:dispatch|commit)\\(\\s*['"\`]${n}/|\\[\\s*['"]${n}/`).test(code)
}

export function emitsToCallee(e: WiredEdge, aliases: Alias[]): boolean {
  const events = [...e.callerCode.matchAll(EMITTED)].map(m => m[1] ?? '')
  return events.length > 0
    && importsFileDirectly(e.calleeSource, e.calleePath, e.callerPath, aliases)
    && events.some(ev => new RegExp(`(?:@|v-on:)${escape(ev)}=`).test(e.calleeSource))
}

const RECEIVER = /(?:@|\b)([a-z_][a-z0-9_]*)\.(?=[a-z_])/g
const ASSOCIATION = /\b(?:has_many|has_one|belongs_to)\s+:(\w+)[^\n]*?class_name:\s*['"]([\w:]+)['"]/g

function singular(word: string): string {
  if (word.endsWith('ies')) {
    return `${word.slice(0, -3)}y`
  }
  if (word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1)
  }
  return word
}

function camelize(word: string): string {
  return word.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

export function parseAssociations(source: string): Array<[string, string]> {
  return [...source.matchAll(ASSOCIATION)].map(m => [m[1] ?? '', m[2] ?? ''])
}

export function namesReceiverModel(callerCode: string, calleeClasses: string[], associations: Map<string, string>): boolean {
  const declared = new Set(calleeClasses.flatMap(c => [c, c.split('::').pop() ?? c]))
  return [...callerCode.matchAll(RECEIVER)].some(m => {
    const word = m[1] ?? ''
    return declared.has(camelize(singular(word))) || declared.has(associations.get(word) ?? '')
  })
}

const VITE_CONFIGS = ['vite.config.mjs', 'vite.config.ts', 'vite.config.js']
const CONTAINER = 'src/container.ts'

function containerFileOf(source: string, aliases: Alias[], read: Read): (cls: string) => string | null {
  const specOf = new Map<string, string>([
    ...[...source.matchAll(NAMED_IMPORT)].flatMap(m => boundNames(m[1] ?? '').map(n => [n, m[2] ?? ''] as const)),
    ...[...source.matchAll(DEFAULT_IMPORT)].map(m => [m[1] ?? '', m[2] ?? ''] as const),
  ])
  return cls => {
    const spec = specOf.get(cls)
    const base = spec === undefined ? null : resolveSpecifier(spec, CONTAINER, aliases)
    return base === null ? null : RESOLVE_SUFFIXES.map(suffix => `${base}${suffix}`).find(p => read(p) !== null) ?? null
  }
}

export interface Wiring {
  aliases: Alias[]
  injects: Map<string, Set<string>>
  associations: Map<string, string>
}

export function loadWiring(repoDir: string): Wiring {
  const read = readerFor(repoDir)
  const appsDir = path.join(repoDir, 'apps')
  const configDirs = ['', ...(fs.existsSync(appsDir) ? fs.readdirSync(appsDir).map(a => `apps/${a}`) : [])]
  const aliases = configDirs.flatMap(dir => {
    const tsconfig = read(path.posix.join(dir, 'tsconfig.json'))
    return [
      ...(tsconfig === null ? [] : parseTsconfigPaths(tsconfig, dir)),
      ...VITE_CONFIGS.flatMap(name => {
        const source = read(path.posix.join(dir, name))
        return source === null ? [] : parseViteAliases(source, dir)
      }),
    ]
  })
  const container = read(CONTAINER)
  const modelsDir = path.join(repoDir, 'app', 'models')
  const models = fs.existsSync(modelsDir) ? fs.readdirSync(modelsDir, { recursive: true, encoding: 'utf-8' }).filter(f => f.endsWith('.rb')) : []
  return {
    aliases,
    injects: container === null ? new Map() : parseInjections(container, containerFileOf(container, aliases, read)),
    associations: new Map(models.flatMap(f => parseAssociations(fs.readFileSync(path.join(modelsDir, f), 'utf-8')))),
  }
}

export function wiredGrade(w: Wiring, e: WiredEdge, read: Read): 'graph' | 'import' | 'text' | null {
  if (injectionReach(w.injects, [e.callerPath], [e.calleePath])) {
    return 'graph'
  }
  const ns = vuexNamespaceOf(e.calleePath, read)
  if (importsCallee(e, w.aliases, read) || (ns !== null && usesVuexNamespace(e.callerCode, ns)) || emitsToCallee(e, w.aliases)) {
    return 'import'
  }
  if (e.callerPath.endsWith('.rb') && namesReceiverModel(e.callerCode, e.calleeClasses, w.associations)) {
    return 'text'
  }
  return null
}
