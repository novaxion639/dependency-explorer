export interface RouteRef { path: string; controllerFile: string }

interface UrlRef { absolute: boolean; segments: string[] }

const STRING_LITERAL = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g
const CONSTANT = /\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*['"`]([^'"`$\n]*)['"`]/g
const INTERPOLATION = /\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g
const URL_SEGMENT = /^[\w.-]+$/
const FORMAT_SUFFIX = /\(\.:format\)$/
const PARAM = ':p'
const SPECIFIER_LEAD = /(?:\bfrom|\bimport|\brequire\()\s*$/
const DOT_SEGMENT = /^\.{1,2}$/

function constantsIn(sources: string[]): Map<string, string> {
  return new Map(sources.flatMap(s => [...s.matchAll(CONSTANT)].map(m => [m[1] ?? '', m[2] ?? ''] as const)))
}

function urlRef(literal: string, constants: Map<string, string>): UrlRef | null {
  const expanded = literal.replace(INTERPOLATION, (whole, name: string) => constants.get(name) ?? whole)
  const pathPart = expanded.split(/[?#]/)[0] ?? ''
  if (!pathPart.includes('/') || /\s/.test(pathPart)) {
    return null
  }
  const segments = pathPart.split('/').filter(Boolean).map(s => (s.includes('${') ? PARAM : s))
  if (segments.length === 0 || !segments.every(s => s === PARAM || (URL_SEGMENT.test(s) && !DOT_SEGMENT.test(s)))) {
    return null
  }
  return { absolute: pathPart.startsWith('/'), segments }
}

function urlRefs(sources: string[]): UrlRef[] {
  const constants = constantsIn(sources)
  return sources.flatMap(s => [...s.matchAll(STRING_LITERAL)].flatMap(m => {
    const at = m.index ?? 0
    if (SPECIFIER_LEAD.test(s.slice(Math.max(0, at - 12), at))) {
      return []
    }
    const ref = urlRef(m[1] ?? m[2] ?? m[3] ?? '', constants)
    return ref ? [ref] : []
  }))
}

function routeSegments(routePath: string): string[] {
  return routePath.replace(FORMAT_SUFFIX, '').split('/').filter(Boolean).map(s => (s.startsWith(':') || s.startsWith('*') ? PARAM : s))
}

function matchesTail(route: string[], url: string[]): boolean {
  const tail = route.slice(Math.max(0, route.length - url.length))
  return tail.length === url.length && tail.every((s, i) => s === url[i])
}

export function routeGrade(sources: string[], calleePath: string, routes: ReadonlyArray<RouteRef>): 'import' | 'text' | null {
  const parsed = routes.map(r => ({ controllerFile: r.controllerFile, segments: routeSegments(r.path) }))
  const refs = urlRefs(sources)
  const fullPath = refs.some(u => u.absolute && parsed.some(r => r.controllerFile === calleePath && r.segments.length === u.segments.length && matchesTail(r.segments, u.segments)))
  if (fullPath) {
    return 'import'
  }
  const uniqueSuffix = refs.some(u => {
    const controllers = new Set(parsed.filter(r => r.segments.length > u.segments.length && matchesTail(r.segments, u.segments)).map(r => r.controllerFile))
    return controllers.size === 1 && controllers.has(calleePath)
  })
  return uniqueSuffix ? 'text' : null
}
