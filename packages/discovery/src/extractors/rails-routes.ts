import * as fs from 'node:fs'
import * as path from 'node:path'

export interface RailsRoute {
  verb: string
  path: string
}

export interface RailsRoutesFacts {
  routes: RailsRoute[]
  /** count of `resources :x` / `resource :x` declarations (each expands to several RESTful routes) */
  resourceDeclarations: number
  /** route count per top-level path segment */
  byTopSegment: Record<string, number>
}

const VERB_RE = /^\s*(get|post|put|patch|delete)\s+['"]([^'"]+)['"]/
const NAMESPACE_RE = /^\s*namespace\s+:(\w+)/
const SCOPE_PATH_RE = /^\s*scope\s+['"]\/?([\w/]+)['"]/
const RESOURCES_RE = /^\s*(resources|resource)\s+:(\w+)/
const BLOCK_OPEN_RE = /\bdo\s*(\|[^|]*\|)?\s*$/
const END_RE = /^\s*end\b/

/**
 * Best-effort static parser for the Rails routing DSL — handles the regular
 * subset (namespace / scope "path" / resources / verb declarations) which
 * covers the overwhelming majority of routes.rb. Exported for tests.
 */
export function parseRoutesContent(content: string): RailsRoutesFacts {
  const routes: RailsRoute[] = []
  let resourceDeclarations = 0
  const stack: Array<{ depth: number; segment: string }> = []
  let depth = 0

  const currentPrefix = () => stack.map(s => s.segment).join('/')

  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/#.*$/, '') // strip comments
    if (!line.trim()) continue

    if (END_RE.test(line)) {
      depth = Math.max(0, depth - 1)
      while (stack.length && stack[stack.length - 1]!.depth === depth) stack.pop()
      continue
    }

    const ns = line.match(NAMESPACE_RE)
    if (ns) {
      if (BLOCK_OPEN_RE.test(line)) {
        stack.push({ depth, segment: ns[1]! })
        depth++
      }
      continue
    }

    const scope = line.match(SCOPE_PATH_RE)
    if (scope && BLOCK_OPEN_RE.test(line)) {
      stack.push({ depth, segment: scope[1]! })
      depth++
      continue
    }

    const res = line.match(RESOURCES_RE)
    if (res) {
      resourceDeclarations++
      if (BLOCK_OPEN_RE.test(line)) {
        stack.push({ depth, segment: res[2]! })
        depth++
      }
      continue
    }

    const verb = line.match(VERB_RE)
    if (verb) {
      const prefix = currentPrefix()
      const routePath = verb[2]!.replace(/^\//, '')
      const full = '/' + [prefix, routePath].filter(Boolean).join('/')
      routes.push({ verb: verb[1]!.toUpperCase(), path: full })
      // a verb line can itself open a block (rare); fall through to block check
    }

    if (BLOCK_OPEN_RE.test(line)) {
      depth++
    }
  }

  const byTopSegment: Record<string, number> = {}
  for (const r of routes) {
    const top = r.path.split('/').filter(Boolean)[0] ?? '(root)'
    byTopSegment[top] = (byTopSegment[top] ?? 0) + 1
  }

  return { routes, resourceDeclarations, byTopSegment }
}

/** Parse config/routes.rb plus all files under config/routes/. */
export function extractRailsRoutes(repoBase: string, repo = 'skello-app'): RailsRoutesFacts | null {
  const configDir = path.join(repoBase, repo, 'config')
  const files: string[] = []
  const main = path.join(configDir, 'routes.rb')
  if (fs.existsSync(main)) files.push(main)
  const extraDir = path.join(configDir, 'routes')
  if (fs.existsSync(extraDir)) {
    for (const f of fs.readdirSync(extraDir)) {
      if (f.endsWith('.rb')) files.push(path.join(extraDir, f))
    }
  }
  if (!files.length) return null

  const merged: RailsRoutesFacts = { routes: [], resourceDeclarations: 0, byTopSegment: {} }
  for (const file of files) {
    const parsed = parseRoutesContent(fs.readFileSync(file, 'utf-8'))
    merged.routes.push(...parsed.routes)
    merged.resourceDeclarations += parsed.resourceDeclarations
    for (const [seg, n] of Object.entries(parsed.byTopSegment)) {
      merged.byTopSegment[seg] = (merged.byTopSegment[seg] ?? 0) + n
    }
  }
  return merged
}
