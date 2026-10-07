import { escapeRegExp } from './code-wiring'
export interface RouteRef { path: string; controllerFile: string }

type UrlSegment = string | RegExp

interface UrlRef { absolute: boolean; segments: UrlSegment[] }

const STRING_LITERAL = /'((?:\\[\s\S]|[^'\\\n])*)'|"((?:\\[\s\S]|[^"\\\n])*)"|`((?:\\[\s\S]|[^`\\])*)`/g
const CONSTANT = /\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*['"`]([^'"`$\n]*)['"`]/g
const LINE_CONTINUATION = /\\\r?\n/g
const INTERPOLATION = /\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g
const URL_SEGMENT = /^[\w.-]+$/
const PATH_PART = /^(?:\$\{[^}]*\}|[^?#])*/
const FORMAT_EXTENSION = /\.(?:json|csv|pdf|xlsx?|xml|zip|ics)$/
const FORMAT_SUFFIX = /\(\.:format\)$/
const PARAM = ':p'
const SPECIFIER_LEAD = /(?:\bfrom|\bimport\s*\(?|\brequire(?:\.resolve)?\s*\(|\b(?:vi|jest)\.(?:mock|doMock|importActual|requireActual)\s*\()\s*$/
const SPECIFIER_WINDOW = 40
const ANY_INTERPOLATION = /\$\{[^}]*\}/
const DOT_SEGMENT = /^\.{1,2}$/
const NAMED_IMPORT = /import\s*\{([^}]*)\}\s*from/g

function constantsIn(source: string): Array<readonly [string, string]> {
  return [...source.matchAll(CONSTANT)].map(m => [m[1] ?? '', m[2] ?? ''] as const)
}

function importBindings(code: string): Map<string, string> {
  return new Map([...code.matchAll(NAMED_IMPORT)].flatMap(m => (m[1] ?? '').split(',').flatMap(entry => {
    const [exported, local] = entry.trim().split(/\s+as\s+/).map(n => n.trim())
    return exported ? [[exported, local ?? exported] as const] : []
  })))
}

function callerConstants(callerCode: string, imported: string[]): Map<string, string> {
  const bindings = importBindings(callerCode)
  const fromImports = imported.flatMap(constantsIn).flatMap(([name, value]) => {
    const local = bindings.get(name)
    return local === undefined ? [] : [[local, value] as const]
  })
  return new Map([...fromImports, ...constantsIn(callerCode)])
}

function urlSegment(s: string): UrlSegment | null {
  if (!ANY_INTERPOLATION.test(s)) {
    return URL_SEGMENT.test(s) && !DOT_SEGMENT.test(s) ? s : null
  }
  const pieces = s.split(ANY_INTERPOLATION)
  if (pieces.every(p => p === '')) {
    return PARAM
  }
  return pieces.every(p => p === '' || URL_SEGMENT.test(p)) ? new RegExp(`^${pieces.map(escapeRegExp).join('.*')}$`) : null
}

function urlRef(literal: string, constants: Map<string, string>): UrlRef | null {
  const expanded = literal.replace(LINE_CONTINUATION, '').replace(INTERPOLATION, (whole, name: string) => constants.get(name) ?? whole)
  const pathPart = (PATH_PART.exec(expanded)?.[0] ?? '').replace(FORMAT_EXTENSION, '')
  if (!pathPart.includes('/') || /\s/.test(pathPart)) {
    return null
  }
  const segments = pathPart.split('/').filter(Boolean).map(urlSegment)
  if (segments.length === 0 || segments.some(s => s === null)) {
    return null
  }
  return { absolute: pathPart.startsWith('/'), segments: segments.filter(s => s !== null) }
}

function urlRefs(s: string, constants: Map<string, string>): UrlRef[] {
  return [...s.matchAll(STRING_LITERAL)].flatMap(m => {
    const at = m.index ?? 0
    if (SPECIFIER_LEAD.test(s.slice(Math.max(0, at - SPECIFIER_WINDOW), at))) {
      return []
    }
    const ref = urlRef(m[1] ?? m[2] ?? m[3] ?? '', constants)
    return ref ? [ref] : []
  })
}

function routeSegments(routePath: string): string[] {
  return routePath.replace(FORMAT_SUFFIX, '').split('/').filter(Boolean).map(s => (s.startsWith(':') || s.startsWith('*') ? PARAM : s))
}

function segmentMatches(route: string, url: UrlSegment | undefined): boolean {
  return url instanceof RegExp ? route !== PARAM && url.test(route) : route === url
}

function matchesTail(route: string[], url: UrlSegment[]): boolean {
  const tail = route.slice(Math.max(0, route.length - url.length))
  return tail.length === url.length && tail.every((s, i) => segmentMatches(s, url[i]))
}

export function routeGrade(callerCode: string, imported: string[], calleePath: string, routes: ReadonlyArray<RouteRef>): 'import' | 'text' | null {
  const parsed = routes.map(r => ({ controllerFile: r.controllerFile, segments: routeSegments(r.path) }))
  const fullMatch = (u: UrlRef, r: { segments: string[] }) => u.absolute && r.segments.length === u.segments.length && matchesTail(r.segments, u.segments)
  const fullPath = (u: UrlRef) => {
    const owners = new Set(parsed.filter(r => fullMatch(u, r)).map(r => r.controllerFile))
    return owners.has(calleePath) && (owners.size === 1 || !u.segments.some(s => s instanceof RegExp))
  }
  const uniqueTail = (u: UrlRef) => {
    if (parsed.some(r => fullMatch(u, r))) {
      return false
    }
    const controllers = new Set(parsed.filter(r => r.segments.length > u.segments.length && matchesTail(r.segments, u.segments)).map(r => r.controllerFile))
    return controllers.size === 1 && controllers.has(calleePath)
  }
  const own = urlRefs(callerCode, callerConstants(callerCode, imported))
  if (own.some(fullPath)) {
    return 'import'
  }
  const borrowed = imported.flatMap(s => urlRefs(s, new Map(constantsIn(s))))
  return [...own, ...borrowed].some(u => fullPath(u) || uniqueTail(u)) ? 'text' : null
}
