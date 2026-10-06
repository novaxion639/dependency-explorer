import * as fs from 'node:fs'
import * as path from 'node:path'
import { readerFor, RESOLVE_SUFFIXES, resolveSpecifier, stripComments, type Alias, type Read } from './code-wiring'

export interface VueRoute { name: string; componentFile: string }

const DEFAULT_IMPORT = /\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g
const STRING = /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g
const COMPONENT_KEY = /\bcomponent\s*:/g
const COMPONENT_VALUE = /^\s*(?:([A-Za-z_$][\w$]*)\s*[,}\n]|\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\))/
const NAME_VALUE = /^name\s*:\s*(['"])([^'"]+)\1/
const OPENERS = '{[('
const CLOSERS = '}])'
const ROUTE_FILE = /routes?\.(?:js|ts)$/i
const NOT_SOURCE = /(?:^|\/)(?:node_modules|__tests__)\/|\.(?:test|spec)\./
const NAVIGATES = /\$?router\.(?:push|replace)\s*\(|<router-link\b/

function maskStrings(source: string): string {
  return source.replace(STRING, s => `${s[0] ?? ''}${' '.repeat(Math.max(0, s.length - 2))}${s[s.length - 1] ?? ''}`)
}

function enclosingObject(masked: string, at: number): [number, number] | null {
  let depth = 0
  let open = -1
  for (let i = at - 1; i >= 0; i--) {
    const c = masked[i] ?? ''
    if (CLOSERS.includes(c)) {
      depth += 1
    } else if (OPENERS.includes(c)) {
      if (depth === 0) {
        open = c === '{' ? i : -1
        break
      }
      depth -= 1
    }
  }
  if (open < 0) {
    return null
  }
  depth = 0
  for (let i = open + 1; i < masked.length; i++) {
    const c = masked[i] ?? ''
    if (OPENERS.includes(c)) {
      depth += 1
    } else if (CLOSERS.includes(c)) {
      if (depth === 0) {
        return [open, i]
      }
      depth -= 1
    }
  }
  return null
}

function ownName(source: string, masked: string, [open, close]: [number, number]): string | null {
  let depth = 0
  for (let i = open + 1; i < close; i++) {
    const c = masked[i] ?? ''
    if (OPENERS.includes(c)) {
      depth += 1
    } else if (CLOSERS.includes(c)) {
      depth -= 1
    } else if (depth === 0 && masked.startsWith('name', i) && !/[\w$]/.test(masked[i - 1] ?? '')) {
      const m = source.slice(i).match(NAME_VALUE)
      if (m) {
        return m[2] ?? null
      }
    }
  }
  return null
}

function resolveFile(spec: string, fromPath: string, aliases: Alias[], read: Read): string | null {
  const base = resolveSpecifier(spec, fromPath, aliases)
  return base === null ? null : RESOLVE_SUFFIXES.map(s => `${base}${s}`).find(p => read(p) !== null) ?? null
}

export function parseVueRoutes(raw: string, fromPath: string, aliases: Alias[], read: Read): VueRoute[] {
  const source = stripComments(raw)
  const bindings = new Map([...source.matchAll(DEFAULT_IMPORT)].map(m => [m[1] ?? '', m[2] ?? '']))
  const masked = maskStrings(source)
  return [...masked.matchAll(COMPONENT_KEY)].flatMap(m => {
    const at = m.index ?? 0
    const value = source.slice(at + m[0].length).match(COMPONENT_VALUE)
    const spec = value?.[2] ?? bindings.get(value?.[1] ?? '')
    const object = enclosingObject(masked, at)
    const name = object ? ownName(source, masked, object) : null
    const componentFile = spec === undefined ? null : resolveFile(spec, fromPath, aliases, read)
    return name !== null && componentFile !== null ? [{ name, componentFile }] : []
  })
}

const STORE_CALL_LEAD = /\b(?:map\w+|dispatch|commit)\(\s*$/
const ROUTE_NAME_COMPARED_LEAD = /\$route\.name\s*[!=]==?\s*$/
const ROUTE_NAME_COMPARED_TAIL = /^\s*[!=]==?\s*(?:this\.)?\$route\.name\b/

function namesLiteral(code: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [...code.matchAll(new RegExp(`(['"\`])${escaped}\\1`, 'g'))].some(m => {
    const at = m.index ?? 0
    const before = code.slice(Math.max(0, at - 40), at)
    const after = code.slice(at + m[0].length, at + m[0].length + 40)
    return !STORE_CALL_LEAD.test(before) && !ROUTE_NAME_COMPARED_LEAD.test(before) && !ROUTE_NAME_COMPARED_TAIL.test(after)
  })
}

export function routerGrade(callerCode: string, imported: string[], calleePath: string, routes: ReadonlyArray<VueRoute>): 'import' | 'text' | null {
  if (!NAVIGATES.test(callerCode)) {
    return null
  }
  const names = routes.filter(r => r.componentFile === calleePath).map(r => r.name)
  if (names.some(n => namesLiteral(callerCode, n))) {
    return 'import'
  }
  return names.some(n => imported.some(s => namesLiteral(s, n))) ? 'text' : null
}

function sourceRoots(repoDir: string): string[] {
  const appsDir = path.join(repoDir, 'apps')
  const apps = fs.existsSync(appsDir) ? fs.readdirSync(appsDir).map(a => path.posix.join('apps', a, 'src')) : []
  return [...apps, 'src'].filter(root => fs.existsSync(path.join(repoDir, root)))
}

export function loadVueRoutes(repoDir: string, aliases: Alias[]): VueRoute[] {
  const read = readerFor(repoDir)
  return sourceRoots(repoDir).flatMap(root => fs.readdirSync(path.join(repoDir, root), { recursive: true, encoding: 'utf-8' })
    .map(f => path.posix.join(root, f.split(path.sep).join('/')))
    .filter(f => ROUTE_FILE.test(f) && !NOT_SOURCE.test(f))
    .flatMap(f => parseVueRoutes(read(f) ?? '', f, aliases, read)))
}
