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

function urlRefs(s: string, constants: Map<string, string>): UrlRef[] {
  return [...s.matchAll(STRING_LITERAL)].flatMap(m => {
    const at = m.index ?? 0
    if (SPECIFIER_LEAD.test(s.slice(Math.max(0, at - 12), at))) {
      return []
    }
    const ref = urlRef(m[1] ?? m[2] ?? m[3] ?? '', constants)
    return ref ? [ref] : []
  })
}

function routeSegments(routePath: string): string[] {
  return routePath.replace(FORMAT_SUFFIX, '').split('/').filter(Boolean).map(s => (s.startsWith(':') || s.startsWith('*') ? PARAM : s))
}

function matchesTail(route: string[], url: string[]): boolean {
  const tail = route.slice(Math.max(0, route.length - url.length))
  return tail.length === url.length && tail.every((s, i) => s === url[i])
}

export function routeGrade(callerCode: string, imported: string[], calleePath: string, routes: ReadonlyArray<RouteRef>): 'import' | 'text' | null {
  const parsed = routes.map(r => ({ controllerFile: r.controllerFile, segments: routeSegments(r.path) }))
  const fullPath = (u: UrlRef) => u.absolute && parsed.some(r => r.controllerFile === calleePath && r.segments.length === u.segments.length && matchesTail(r.segments, u.segments))
  const uniqueTail = (u: UrlRef) => {
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
